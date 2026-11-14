-- KNX — clés d'accès du module de jeu (userscript) et envois en attente de validation.
--
-- Le module envoie le relevé du jour par l'API Vercel (/api/v1/releves), qui appelle
-- ingest_snapshot avec la clé anon publique. Toute la sécurité vit ici : la clé du module est
-- hachée (sha256) et comparée en base, jamais stockée en clair.
--
-- Un envoi du module reste « pending » : ses lignes attendent dans snapshots.pending_rows, sans
-- créer d'entreprise, jusqu'à ce qu'un administrateur le publie ou le rejette depuis /releves.

create extension if not exists pgcrypto with schema extensions;

create table public.api_keys (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 60),
  -- Début de la clé (« knx_3f9a1c2e »), pour la reconnaître sans la révéler.
  prefix text not null,
  key_hash bytea not null unique,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  last_used_at timestamptz,
  revoked_at timestamptz
);

-- Aucune policy : la table n'est lisible qu'à travers les fonctions ci-dessous.
alter table public.api_keys enable row level security;
revoke all on public.api_keys from anon, authenticated;

alter table public.snapshots
  add column api_key_id bigint references public.api_keys (id) on delete set null,
  add column pending_rows jsonb,
  add constraint snapshots_pending_rows_check check (pending_rows is null or status = 'pending');

-- ---------------------------------------------------------------------------------------------
-- Fonctions internes
-- ---------------------------------------------------------------------------------------------

-- Entier JSON dans [p_min, p_max] ; null accepté seulement si p_nullable.
create function public.jsonb_integer_ok(
  p_value jsonb,
  p_min numeric,
  p_max numeric,
  p_nullable boolean
) returns boolean
language plpgsql immutable set search_path = public as $$
declare
  v numeric;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return p_nullable;
  end if;
  if jsonb_typeof(p_value) <> 'number' then
    return false;
  end if;
  v := p_value::numeric;
  return v = trunc(v)
    and (p_min is null or v >= p_min)
    and (p_max is null or v <= p_max);
end;
$$;

-- Forme d'un relevé envoyé par le module, vérifiée dans l'ordre (aucun cast avant le type).
-- p_rows : [{ "name": text, "rank": int|null, "chiffre": int, "capital": int|null, "employees": int|null }]
create function public.snapshot_rows_valid(p_rows jsonb) returns boolean
language plpgsql immutable set search_path = public as $$
declare
  v_row jsonb;
  v_name text;
  v_names text[] := '{}';
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    return false;
  end if;
  if jsonb_array_length(p_rows) not between 1 and 200 or octet_length(p_rows::text) > 65536 then
    return false;
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(v_row) <> 'object' or jsonb_typeof(v_row -> 'name') is distinct from 'string' then
      return false;
    end if;
    v_name := v_row ->> 'name';
    if v_name <> btrim(v_name) or char_length(v_name) not between 1 and 100 or v_name = any (v_names) then
      return false;
    end if;
    v_names := v_names || v_name;

    if not (
      public.jsonb_integer_ok(v_row -> 'rank', 1, 2147483647, true)
      and public.jsonb_integer_ok(v_row -> 'chiffre', 0, 9007199254740991, false)
      and public.jsonb_integer_ok(v_row -> 'capital', -9007199254740991, 9007199254740991, true)
      and public.jsonb_integer_ok(v_row -> 'employees', 0, 2147483647, true)
    ) then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

-- Identifie une clé active et note son usage ; null si la clé est inconnue ou révoquée.
create function public.api_key_touch(p_key text) returns bigint
language sql volatile security definer set search_path = public as $$
  update public.api_keys
     set last_used_at = now()
   where key_hash = extensions.digest(p_key, 'sha256')
     and revoked_at is null
  returning id;
$$;

create function public.api_key_json(p_key public.api_keys) returns jsonb
language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'id', p_key.id,
    'name', p_key.name,
    'prefix', p_key.prefix,
    'createdAt', p_key.created_at,
    'lastUsedAt', p_key.last_used_at,
    'revokedAt', p_key.revoked_at
  );
$$;

revoke all on function public.jsonb_integer_ok from public, anon, authenticated;
revoke all on function public.snapshot_rows_valid from public, anon, authenticated;
revoke all on function public.api_key_touch from public, anon, authenticated;
revoke all on function public.api_key_json from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- API du module (appelées par la fonction Vercel avec la clé anon)
-- ---------------------------------------------------------------------------------------------

-- Dépose le relevé du jour en attente de validation. Les cas attendus sont renvoyés, pas levés,
-- pour garder la trace d'usage de la clé :
--   unauthorized | invalid | published | unchanged | pending_other_key | busy | replaced | created
create function public.ingest_snapshot(p_key text, p_taken_on date, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_key_id bigint;
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_existing public.snapshots%rowtype;
  v_id bigint;
begin
  v_key_id := public.api_key_touch(p_key);
  if v_key_id is null then
    return jsonb_build_object('outcome', 'unauthorized');
  end if;

  if p_taken_on is null
     or p_taken_on > v_today + 1
     or p_taken_on < v_today - 7
     or not public.snapshot_rows_valid(p_rows) then
    return jsonb_build_object('outcome', 'invalid');
  end if;

  select * into v_existing from public.snapshots where taken_on = p_taken_on for update;
  if found then
    if v_existing.status = 'published' then
      return jsonb_build_object('outcome', 'published', 'snapshotId', v_existing.id);
    end if;
    if v_existing.pending_rows = p_rows then
      return jsonb_build_object('outcome', 'unchanged', 'snapshotId', v_existing.id);
    end if;
    if v_existing.api_key_id is distinct from v_key_id then
      return jsonb_build_object('outcome', 'pending_other_key');
    end if;
    update public.snapshots
       set pending_rows = p_rows, created_at = now()
     where id = v_existing.id;
    return jsonb_build_object('outcome', 'replaced', 'snapshotId', v_existing.id);
  end if;

  begin
    insert into public.snapshots (taken_on, source, status, api_key_id, pending_rows)
    values (p_taken_on, 'userscript', 'pending', v_key_id, p_rows)
    returning id into v_id;
  exception when unique_violation then
    -- Un autre envoi pour la même date est arrivé entre-temps.
    return jsonb_build_object('outcome', 'busy');
  end;

  return jsonb_build_object('outcome', 'created', 'snapshotId', v_id);
end;
$$;

-- Vérifie une clé et dit où en est le relevé d'une date (aujourd'hui, heure de Paris, par défaut).
create function public.api_key_status(p_key text, p_date date default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_key_id bigint;
  v_date date := coalesce(p_date, (now() at time zone 'Europe/Paris')::date);
  v_state public.snapshot_status;
begin
  v_key_id := public.api_key_touch(p_key);
  if v_key_id is null then
    return jsonb_build_object('outcome', 'unauthorized');
  end if;

  select status into v_state from public.snapshots where taken_on = v_date;

  return jsonb_build_object(
    'outcome', 'ok',
    'keyName', (select name from public.api_keys where id = v_key_id),
    'date', v_date,
    'state', coalesce(v_state::text, 'absent'),
    'lastPublished', (select max(taken_on) from public.snapshots where status = 'published')
  );
end;
$$;

revoke all on function public.ingest_snapshot from public, anon, authenticated;
revoke all on function public.api_key_status from public, anon, authenticated;
grant execute on function public.ingest_snapshot to anon, authenticated;
grant execute on function public.api_key_status to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Administration (écran /releves)
-- ---------------------------------------------------------------------------------------------

-- Crée une clé et la renvoie en clair une seule fois : seule son empreinte est gardée.
create function public.create_api_key(p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_secret text;
  v_key public.api_keys%rowtype;
begin
  if not public.is_admin() then
    raise exception 'gestion des clés réservée aux administrateurs' using errcode = '42501';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 60 then
    raise exception 'le nom de la clé doit compter de 1 à 60 caractères' using errcode = '22023';
  end if;

  v_secret := 'knx_' || encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.api_keys (name, prefix, key_hash, created_by)
  values (btrim(p_name), left(v_secret, 12), extensions.digest(v_secret, 'sha256'), auth.uid())
  returning * into v_key;

  return jsonb_build_object('key', public.api_key_json(v_key), 'secret', v_secret);
end;
$$;

create function public.revoke_api_key(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'gestion des clés réservée aux administrateurs' using errcode = '42501';
  end if;
  update public.api_keys set revoked_at = now() where id = p_id and revoked_at is null;
  if not found then
    raise exception 'clé introuvable ou déjà révoquée' using errcode = 'P0002';
  end if;
end;
$$;

create function public.list_api_keys() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'gestion des clés réservée aux administrateurs' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(public.api_key_json(k) order by k.revoked_at is not null, k.created_at desc)
    from public.api_keys k
  ), '[]'::jsonb);
end;
$$;

-- Envois en attente, du plus récent au plus ancien, avec la clé qui les a déposés.
create function public.pending_snapshots() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'validation réservée aux administrateurs' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'date', s.taken_on,
      'source', s.source,
      'receivedAt', s.created_at,
      'key', case when k.id is null then null else jsonb_build_object(
        'name', k.name,
        'prefix', k.prefix,
        'revoked', k.revoked_at is not null
      ) end,
      'rows', coalesce(s.pending_rows, (
        select coalesce(jsonb_agg(jsonb_build_object(
          'name', c.name,
          'rank', r.rank,
          'chiffre', r.chiffre,
          'capital', r.capital,
          'employees', r.employees
        )), '[]'::jsonb)
        from public.snapshot_rows r
        join public.companies c on c.id = r.company_id
        where r.snapshot_id = s.id
      ))
    ) order by s.taken_on desc)
    from public.snapshots s
    left join public.api_keys k on k.id = s.api_key_id
    where s.status = 'pending'
  ), '[]'::jsonb);
end;
$$;

-- Publie un envoi en attente : crée alors seulement les entreprises inconnues et les lignes.
create function public.publish_pending_snapshot(p_id bigint) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_snapshot public.snapshots%rowtype;
begin
  if not public.is_admin() then
    raise exception 'publication réservée aux administrateurs' using errcode = '42501';
  end if;

  select * into v_snapshot from public.snapshots where id = p_id and status = 'pending' for update;
  if not found then
    raise exception 'envoi en attente introuvable' using errcode = 'P0002';
  end if;

  if v_snapshot.pending_rows is not null then
    insert into public.companies (name)
    select distinct r ->> 'name' from jsonb_array_elements(v_snapshot.pending_rows) r
    on conflict (name) do nothing;

    insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
    select
      p_id,
      c.id,
      nullif(r ->> 'rank', '')::integer,
      (r ->> 'chiffre')::bigint,
      nullif(r ->> 'capital', '')::bigint,
      nullif(r ->> 'employees', '')::integer
    from jsonb_array_elements(v_snapshot.pending_rows) r
    join public.companies c on c.name = r ->> 'name';
  end if;

  update public.snapshots
     set status = 'published', pending_rows = null, created_by = auth.uid()
   where id = p_id;

  return p_id;
end;
$$;

create function public.reject_pending_snapshot(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'validation réservée aux administrateurs' using errcode = '42501';
  end if;
  delete from public.snapshots where id = p_id and status = 'pending';
  if not found then
    raise exception 'envoi en attente introuvable' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.create_api_key from public, anon, authenticated;
revoke all on function public.revoke_api_key from public, anon, authenticated;
revoke all on function public.list_api_keys from public, anon, authenticated;
revoke all on function public.pending_snapshots from public, anon, authenticated;
revoke all on function public.publish_pending_snapshot from public, anon, authenticated;
revoke all on function public.reject_pending_snapshot from public, anon, authenticated;
grant execute on function public.create_api_key to authenticated;
grant execute on function public.revoke_api_key to authenticated;
grant execute on function public.list_api_keys to authenticated;
grant execute on function public.pending_snapshots to authenticated;
grant execute on function public.publish_pending_snapshot to authenticated;
grant execute on function public.reject_pending_snapshot to authenticated;
