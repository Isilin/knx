-- KNX — identité des corporations, fiche éditable, historique d'évènements.
-- À exécuter après 20261113000000_init.sql, sur une base vide ou déjà remplie.
--
-- L'identité d'une corporation est son id, plus son nom : elle peut être renommée, et une
-- corporation fermée ne rouvre jamais (un homonyme plus tard est une nouvelle corporation).

-- 1. Consortiums : liste gérée par les opérateurs.
create table public.consortiums (
  id bigint generated always as identity primary key,
  name text not null unique check (btrim(name) <> ''),
  color text not null default 'bleu' check (color in ('cyan', 'magenta', 'ambre', 'bleu')),
  created_at timestamptz not null default now()
);

alter table public.consortiums enable row level security;
create policy "consortiums are public" on public.consortiums
  for select to anon, authenticated using (true);
create policy "admins manage consortiums" on public.consortiums
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 2. Fiche : consortium, secteur (liste fixe), logo, fermeture.
alter table public.companies
  add column consortium_id bigint references public.consortiums (id) on delete set null,
  add column logo_url text,
  add column closed_on date;

update public.companies set sector = null
where sector not in (
  'agence-immobiliere', 'banque', 'bar-restaurant', 'boutique-armes', 'boutique-equipement',
  'boutique-specialisee', 'usine-production', 'technopole', 'atelier-personnalisation'
);
alter table public.companies add constraint companies_sector_check check (
  sector is null or sector in (
    'agence-immobiliere', 'banque', 'bar-restaurant', 'boutique-armes', 'boutique-equipement',
    'boutique-specialisee', 'usine-production', 'technopole', 'atelier-personnalisation'
  )
);

comment on column public.companies.aliases is 'Anciens noms, du plus ancien au plus récent.';
comment on column public.companies.closed_on is
  'Date du premier relevé dont la corporation est absente. Une fermeture est définitive.';

-- Groupes : ceux déjà saisis, plus les trois maisons repérées par le nom.
insert into public.consortiums (name, color)
values ('Armacham', 'cyan'), ('Sovereign', 'magenta'), ('Donnellys', 'ambre')
on conflict (name) do nothing;
insert into public.consortiums (name)
select distinct group_name from public.companies where group_name is not null
on conflict (name) do nothing;
update public.companies c set consortium_id = k.id
from public.consortiums k
where c.consortium_id is null and (c.group_name = k.name or c.name like k.name || ' %');
alter table public.companies drop column group_name;

-- Le nom n'est unique que parmi les corporations ouvertes.
alter table public.companies drop constraint companies_name_key;
create unique index companies_open_name_key on public.companies (name) where closed_on is null;

-- 3. Correction de données : Paradox a fermé, puis une nouvelle Paradox a ouvert, avant le relevé
-- du 11 novembre 2026 (CA 57 894 → 0, capital 785 352 → 3 340). Les deux étaient confondues.
do $$
declare
  v_old bigint;
  v_new bigint;
  v_split constant date := '2026-11-11';
begin
  select id into v_old from public.companies where name = 'Paradox' and closed_on is null;
  if v_old is null then return; end if;
  if not exists (
    select 1 from public.snapshot_rows r join public.snapshots s on s.id = r.snapshot_id
    where r.company_id = v_old and s.taken_on < v_split and r.chiffre > 0
  ) or not exists (
    select 1 from public.snapshot_rows r join public.snapshots s on s.id = r.snapshot_id
    where r.company_id = v_old and s.taken_on = v_split and r.chiffre = 0
  ) then
    return;
  end if;
  update public.companies set closed_on = v_split where id = v_old;
  insert into public.companies (name) values ('Paradox') returning id into v_new;
  update public.snapshot_rows r set company_id = v_new
  from public.snapshots s
  where s.id = r.snapshot_id and r.company_id = v_old and s.taken_on >= v_split;
end;
$$;

-- 4. Historique : évènements datés, enregistrés par KNX (renommages) ou saisis.
create table public.company_events (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.companies (id) on delete cascade,
  occurred_on date not null,
  kind text not null check (kind in ('renamed', 'ceo_change', 'closed', 'other')),
  details jsonb not null default '{}'::jsonb,
  note text,
  origin text not null default 'manual' check (origin in ('manual', 'auto')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create index company_events_company_idx on public.company_events (company_id, occurred_on);

alter table public.company_events enable row level security;
create policy "events are public" on public.company_events
  for select to anon, authenticated using (true);
create policy "admins manage events" on public.company_events
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 5. Logos : lecture publique, écriture réservée aux administrateurs. Le navigateur réduit
-- l'image en WebP 256 px avant l'envoi.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('company-logos', 'company-logos', true, 524288, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy "knx: admins add logos" on storage.objects
  for insert to authenticated with check (bucket_id = 'company-logos' and public.is_admin());
create policy "knx: admins update logos" on storage.objects
  for update to authenticated using (bucket_id = 'company-logos' and public.is_admin());
create policy "knx: admins delete logos" on storage.objects
  for delete to authenticated using (bucket_id = 'company-logos' and public.is_admin());

-- 6. Publication v2. L'aperçu a déjà décidé qui est qui ; la fonction applique.
-- p_rows : [{ "company_id": text|null, "name": text, "rank": int|null, "chiffre": int,
--             "capital": int|null, "employees": int|null }]
--   company_id null      → nouvelle corporation ;
--   company_id, autre nom → renommage (ancien nom gardé, évènement « renamed »).
-- p_closures : corporations fermées à cette date (absentes, ou remplacées par un homonyme).
drop function public.publish_snapshot(
  date, public.snapshot_source, jsonb, boolean, public.snapshot_status
);

create function public.publish_snapshot(
  p_taken_on date,
  p_source public.snapshot_source,
  p_rows jsonb,
  p_closures bigint[] default '{}',
  p_replace boolean default false,
  p_status public.snapshot_status default 'published'
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_snapshot_id bigint;
  v_count integer;
  r record;
begin
  if not public.is_admin() then
    raise exception 'publication réservée aux administrateurs' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'relevé vide';
  end if;

  if p_replace then
    -- Défaire le relevé remplacé : ses lignes, les corporations qu'il a créées, ses fermetures.
    delete from public.snapshots where taken_on = p_taken_on;
    delete from public.companies c
    where not exists (select 1 from public.snapshot_rows sr where sr.company_id = c.id)
      and not exists (select 1 from public.company_events e where e.company_id = c.id);
    update public.companies set closed_on = null where closed_on = p_taken_on;
  elsif exists (select 1 from public.snapshots where taken_on = p_taken_on) then
    raise exception 'un relevé existe déjà pour le %', p_taken_on using errcode = '23505';
  end if;

  -- Chaque corporation désignée doit exister et être ouverte à cette date.
  select x->>'name' as name into r
  from jsonb_array_elements(p_rows) x
  left join public.companies c on c.id = nullif(x->>'company_id', '')::bigint
  where nullif(x->>'company_id', '') is not null
    and (c.id is null or (c.closed_on is not null and c.closed_on <= p_taken_on)
         or c.id = any(p_closures))
  limit 1;
  if found then
    raise exception 'corporation inconnue ou fermée pour « % »', r.name;
  end if;

  update public.companies set closed_on = p_taken_on
  where id = any(p_closures) and closed_on is null;

  for r in
    select c.id, c.name as old_name, x->>'name' as new_name
    from jsonb_array_elements(p_rows) x
    join public.companies c on c.id = nullif(x->>'company_id', '')::bigint
    where c.name <> x->>'name' and c.closed_on is null
  loop
    update public.companies
    set name = r.new_name, aliases = array_append(aliases, r.old_name)
    where id = r.id;
    insert into public.company_events (company_id, occurred_on, kind, details, origin, created_by)
    values (
      r.id, p_taken_on, 'renamed',
      jsonb_build_object('from', r.old_name, 'to', r.new_name), 'auto', auth.uid()
    );
  end loop;

  for r in
    select x->>'name' as name from jsonb_array_elements(p_rows) x
    where nullif(x->>'company_id', '') is null
  loop
    begin
      insert into public.companies (name) values (r.name);
    exception when unique_violation then
      raise exception 'une corporation ouverte porte déjà le nom « % »', r.name
        using errcode = '23505';
    end;
  end loop;

  insert into public.snapshots (taken_on, source, status, created_by)
  values (p_taken_on, p_source, p_status, auth.uid())
  returning id into v_snapshot_id;

  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select
    v_snapshot_id,
    coalesce(nullif(x->>'company_id', '')::bigint, c.id),
    nullif(x->>'rank', '')::integer,
    (x->>'chiffre')::bigint,
    nullif(x->>'capital', '')::bigint,
    nullif(x->>'employees', '')::integer
  from jsonb_array_elements(p_rows) x
  left join public.companies c
    on nullif(x->>'company_id', '') is null and c.name = x->>'name' and c.closed_on is null;

  get diagnostics v_count = row_count;
  if v_count <> jsonb_array_length(p_rows) then
    raise exception 'relevé incohérent : % lignes enregistrées sur %', v_count, jsonb_array_length(p_rows);
  end if;

  return v_snapshot_id;
end;
$$;

revoke all on function public.publish_snapshot from public, anon;
grant execute on function public.publish_snapshot to authenticated;

-- 7. Jeu de données complet v2 : ids en texte, consortiums, évènements.
create or replace function public.market_dataset() returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'generatedAt', now(),
    'companies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id::text,
        'name', c.name,
        'formerNames', c.aliases,
        'consortiumId', c.consortium_id::text,
        'sector', c.sector,
        'creationOverride', c.creation_override,
        'closedOn', c.closed_on,
        'logoUrl', c.logo_url
      ) order by c.name, c.id)
      from public.companies c
    ), '[]'::jsonb),
    'consortiums', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', k.id::text,
        'name', k.name,
        'color', k.color
      ) order by k.name)
      from public.consortiums k
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id::text,
        'companyId', e.company_id::text,
        'date', e.occurred_on,
        'kind', e.kind,
        'details', e.details,
        'note', e.note,
        'origin', e.origin
      ) order by e.occurred_on, e.id)
      from public.company_events e
    ), '[]'::jsonb),
    'snapshots', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', s.taken_on,
        'source', s.source,
        'rows', coalesce((
          select jsonb_agg(jsonb_build_object(
            'companyId', r.company_id::text,
            'rank', r.rank,
            'chiffre', r.chiffre,
            'capital', r.capital,
            'employees', r.employees
          ))
          from public.snapshot_rows r
          where r.snapshot_id = s.id
        ), '[]'::jsonb)
      ) order by s.taken_on)
      from public.snapshots s
      where s.status = 'published'
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.market_dataset to anon, authenticated;
