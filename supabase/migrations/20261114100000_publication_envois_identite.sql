-- KNX — les envois du module de jeu suivent les mêmes règles d'identité que la saisie.
-- À exécuter après 20261113100000_userscript_api.sql et 20261114000000_fiche_identite_historique.sql.
--
-- Depuis la migration fiche-identité, le nom n'est plus unique : publish_pending_snapshot, qui
-- faisait « on conflict (name) », échouait. L'opérateur valide désormais un envoi comme une
-- saisie (renommages, refondations, fermetures) et une seule fonction applique ses décisions.

-- Applique un relevé résolu à un relevé existant : fermetures, renommages (ancien nom gardé,
-- évènement « renamed »), créations, lignes. Fonction interne, appelée par les deux publications.
-- p_rows : [{ "company_id": text|null, "name": text, "rank": int|null, "chiffre": int,
--             "capital": int|null, "employees": int|null }]
create function public.apply_report(
  p_snapshot_id bigint,
  p_taken_on date,
  p_rows jsonb,
  p_closures bigint[]
) returns void
language plpgsql set search_path = public as $$
declare
  v_count integer;
  r record;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'relevé vide';
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

  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select
    p_snapshot_id,
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
end;
$$;

revoke all on function public.apply_report from public, anon, authenticated;

-- Publication d'une saisie : même signature qu'avant, corps réduit à l'appel commun.
create or replace function public.publish_snapshot(
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
begin
  if not public.is_admin() then
    raise exception 'publication réservée aux administrateurs' using errcode = '42501';
  end if;

  if p_replace then
    -- Défaire le relevé remplacé (ou l'envoi en attente) : ses lignes, les corporations qu'il a
    -- créées, ses fermetures.
    delete from public.snapshots where taken_on = p_taken_on;
    delete from public.companies c
    where not exists (select 1 from public.snapshot_rows sr where sr.company_id = c.id)
      and not exists (select 1 from public.company_events e where e.company_id = c.id);
    update public.companies set closed_on = null where closed_on = p_taken_on;
  elsif exists (select 1 from public.snapshots where taken_on = p_taken_on) then
    raise exception 'un relevé existe déjà pour le %', p_taken_on using errcode = '23505';
  end if;

  insert into public.snapshots (taken_on, source, status, created_by)
  values (p_taken_on, p_source, p_status, auth.uid())
  returning id into v_snapshot_id;

  perform public.apply_report(v_snapshot_id, p_taken_on, p_rows, p_closures);
  return v_snapshot_id;
end;
$$;

-- Validation d'un envoi du module : les lignes reçues, résolues par l'opérateur dans l'aperçu.
drop function public.publish_pending_snapshot(bigint);

create function public.publish_pending_snapshot(
  p_id bigint,
  p_rows jsonb,
  p_closures bigint[] default '{}'
) returns bigint
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
    -- Les décisions portent sur l'envoi tel que reçu : mêmes corporations, mêmes noms.
    if (select array_agg(x->>'name' order by x->>'name') from jsonb_array_elements(p_rows) x)
       is distinct from
       (select array_agg(x->>'name' order by x->>'name')
        from jsonb_array_elements(v_snapshot.pending_rows) x) then
      raise exception 'l''envoi a changé depuis son affichage : rechargez la page';
    end if;
    perform public.apply_report(p_id, v_snapshot.taken_on, p_rows, p_closures);
  end if;

  update public.snapshots
     set status = 'published', pending_rows = null, created_by = auth.uid()
   where id = p_id;

  return p_id;
end;
$$;

revoke all on function public.publish_pending_snapshot from public, anon, authenticated;
grant execute on function public.publish_pending_snapshot to authenticated;
