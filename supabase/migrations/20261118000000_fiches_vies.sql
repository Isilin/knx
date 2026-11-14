-- KNX — une fiche, plusieurs vies.
-- À exécuter après 20261117000000_notation_agence.sql.
--
-- Une corporation détruite puis refondée sous le même nom est, pour le jeu, une nouvelle
-- entreprise : son âge et son chiffre moyen repartent de zéro. Pour la cité, c'est la même maison.
-- `companies` reste une vie (tous les calculs restent par vie) ; une fiche (`company_profiles`)
-- regroupe les vies et porte ce qui ne change pas avec elles : logo, consortium, secteur,
-- quartier, masquage. Une fiche a au plus une vie ouverte. Les notations de l'Agence restent
-- attachées à la vie notée : elles reposent sur son âge et son chiffre.

-- 1. Les fiches.
create table public.company_profiles (
  id bigint generated always as identity primary key,
  consortium_id bigint references public.consortiums (id) on delete set null,
  sector text check (
    sector is null or sector in (
      'agence-immobiliere', 'banque', 'bar-restaurant', 'boutique-armes', 'boutique-equipement',
      'boutique-specialisee', 'usine-production', 'technopole', 'atelier-personnalisation'
    )
  ),
  district text check (district in ('cv', 'bv', 'hv')),
  logo_url text,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.company_profiles is
  'Fiche d''une corporation : commune à toutes ses vies (refondations sous le même nom).';
comment on column public.company_profiles.hidden is
  'Masquée des affichages de KNX ; toujours présente dans les relevés.';

alter table public.company_profiles enable row level security;
create policy "profiles are public" on public.company_profiles
  for select to anon, authenticated using (true);
create policy "admins manage profiles" on public.company_profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 2. Chaque vie rejoint la fiche de son nom : les vies d'un même nom (Paradox, fermée puis
-- rouverte le 11 novembre 2026) partagent une fiche. Les champs de fiche viennent de la vie la
-- plus récente qui en a un.
alter table public.companies
  add column profile_id bigint references public.company_profiles (id) on delete restrict;

do $$
declare
  r record;
  v_profile bigint;
begin
  for r in select name from public.companies group by name loop
    insert into public.company_profiles (consortium_id, sector, district, logo_url, hidden)
    values (
      (select c.consortium_id from public.companies c
       where c.name = r.name and c.consortium_id is not null
       order by c.closed_on desc nulls first, c.id desc limit 1),
      (select c.sector from public.companies c
       where c.name = r.name and c.sector is not null
       order by c.closed_on desc nulls first, c.id desc limit 1),
      (select c.district from public.companies c
       where c.name = r.name and c.district is not null
       order by c.closed_on desc nulls first, c.id desc limit 1),
      (select c.logo_url from public.companies c
       where c.name = r.name and c.logo_url is not null
       order by c.closed_on desc nulls first, c.id desc limit 1),
      coalesce((select bool_or(c.hidden) from public.companies c where c.name = r.name), false)
    )
    returning id into v_profile;
    update public.companies set profile_id = v_profile where name = r.name;
  end loop;
end;
$$;

alter table public.companies alter column profile_id set not null;
create index companies_profile_idx on public.companies (profile_id);
create unique index companies_one_open_life on public.companies (profile_id)
  where closed_on is null;

comment on column public.companies.profile_id is
  'Fiche de cette vie. Une refondation ouvre une nouvelle vie sur la même fiche.';

-- 3. Les champs de fiche quittent les vies.
alter table public.companies
  drop column consortium_id,
  drop column sector,
  drop column district,
  drop column logo_url,
  drop column hidden;

-- 4. Jeu de données complet v6 : v5 (notations, quartier) plus les fiches, et la fiche de chaque
-- vie. Les champs de fiche restent aussi sur chaque vie pour un site pas encore redéployé.
create or replace function public.market_dataset() returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'generatedAt', now(),
    'profiles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id::text,
        'consortiumId', p.consortium_id::text,
        'sector', p.sector,
        'district', p.district,
        'logoUrl', p.logo_url,
        'hidden', p.hidden
      ) order by p.id)
      from public.company_profiles p
    ), '[]'::jsonb),
    'companies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id::text,
        'profileId', c.profile_id::text,
        'name', c.name,
        'formerNames', c.aliases,
        'creationOverride', c.creation_override,
        'closedOn', c.closed_on,
        'consortiumId', p.consortium_id::text,
        'sector', p.sector,
        'district', p.district,
        'logoUrl', p.logo_url,
        'hidden', p.hidden
      ) order by c.name, c.id)
      from public.companies c
      join public.company_profiles p on p.id = c.profile_id
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
    'marketEvents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id::text,
        'date', m.occurred_on,
        'label', m.label,
        'title', m.title,
        'description', m.description,
        'span', m.span_days
      ) order by m.occurred_on, m.id)
      from public.market_events m
    ), '[]'::jsonb),
    'ratings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id::text,
        'companyId', r.company_id::text,
        'date', r.rated_on,
        'method', r.method,
        'category', r.category,
        'confidence', r.confidence,
        'outlook', r.outlook,
        'score', r.score,
        'axes', r.axes,
        'criteria', r.criteria,
        'inputs', r.inputs,
        'district', r.district,
        'rationale', r.rationale
      ) order by r.rated_on, r.id)
      from public.company_ratings r
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

-- 5. Publication v3 : une ligne sans corporation ouvre une vie sur la fiche `profile_id`
-- (refondation, homonyme rattaché), ou sur une nouvelle fiche quand elle est nulle.
-- p_rows : [{ "company_id": text|null, "profile_id": text|null, "name": text, "rank": int|null,
--             "chiffre": int, "capital": int|null, "employees": int|null }]
create or replace function public.apply_report(
  p_snapshot_id bigint,
  p_taken_on date,
  p_rows jsonb,
  p_closures bigint[]
) returns void
language plpgsql set search_path = public as $$
declare
  v_count integer;
  v_profile bigint;
  v_constraint text;
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
    select x->>'name' as name, nullif(x->>'profile_id', '')::bigint as profile_id
    from jsonb_array_elements(p_rows) x
    where nullif(x->>'company_id', '') is null
  loop
    v_profile := r.profile_id;
    if v_profile is null then
      insert into public.company_profiles default values returning id into v_profile;
    elsif not exists (select 1 from public.company_profiles where id = v_profile) then
      raise exception 'fiche introuvable pour « % »', r.name;
    end if;
    begin
      insert into public.companies (name, profile_id) values (r.name, v_profile);
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'companies_one_open_life' then
        raise exception 'la fiche de « % » a déjà une vie ouverte', r.name using errcode = '23505';
      end if;
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

-- Publication d'une saisie : le remplacement supprime aussi les fiches restées sans vie.
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
    -- créées (et leurs fiches restées vides), ses fermetures.
    delete from public.snapshots where taken_on = p_taken_on;
    delete from public.companies c
    where not exists (select 1 from public.snapshot_rows sr where sr.company_id = c.id)
      and not exists (select 1 from public.company_events e where e.company_id = c.id);
    delete from public.company_profiles p
    where not exists (select 1 from public.companies c where c.profile_id = p.id);
    begin
      update public.companies set closed_on = null where closed_on = p_taken_on;
    exception when unique_violation then
      raise exception 'une vie rouverte croiserait une vie ouverte (même nom ou même fiche)'
        using errcode = '23505';
    end;
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

-- Retrait du dernier relevé : supprime aussi les fiches restées sans vie.
create or replace function public.withdraw_snapshot(p_taken_on date) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_snapshot public.snapshots%rowtype;
  v_created bigint[];
  r record;
begin
  if not public.is_admin() then
    raise exception 'retrait réservé aux administrateurs' using errcode = '42501';
  end if;

  select * into v_snapshot from public.snapshots
  where taken_on = p_taken_on and status = 'published'
  for update;
  if not found then
    raise exception 'aucun relevé publié le %', p_taken_on using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.snapshots where status = 'published' and taken_on > p_taken_on
  ) then
    raise exception 'seul le dernier relevé publié peut être retiré';
  end if;

  -- Corporations apparues avec ce relevé : aucune autre ligne, aucun évènement.
  select coalesce(array_agg(sr.company_id), '{}') into v_created
  from public.snapshot_rows sr
  where sr.snapshot_id = v_snapshot.id
    and not exists (
      select 1 from public.snapshot_rows o
      where o.company_id = sr.company_id and o.snapshot_id <> v_snapshot.id
    )
    and not exists (select 1 from public.company_events e where e.company_id = sr.company_id);

  -- Le relevé et ses lignes (on delete cascade), puis les corporations qu'il a créées et les
  -- fiches qu'elles laissent vides.
  delete from public.snapshots where id = v_snapshot.id;
  delete from public.companies where id = any(v_created);
  delete from public.company_profiles p
  where not exists (select 1 from public.companies c where c.profile_id = p.id);

  -- Renommages constatés par ce relevé : la corporation reprend son nom, retiré de ses alias.
  for r in
    select e.id, e.company_id, e.details->>'from' as old_name
    from public.company_events e
    where e.occurred_on = p_taken_on
      and e.kind = 'renamed'
      and e.origin = 'auto'
      and e.details->>'from' is not null
  loop
    begin
      update public.companies
         set name = r.old_name,
             aliases = case when aliases[cardinality(aliases)] = r.old_name
                            then aliases[1:cardinality(aliases) - 1]
                            else aliases end
       where id = r.company_id;
    exception when unique_violation then
      raise exception 'deux corporations ouvertes porteraient le nom « % »', r.old_name
        using errcode = '23505';
    end;
    delete from public.company_events where id = r.id;
  end loop;

  -- Fermetures constatées par ce relevé.
  begin
    update public.companies set closed_on = null where closed_on = p_taken_on;
  exception when unique_violation then
    raise exception 'une vie rouverte croiserait une vie ouverte (même nom ou même fiche)'
      using errcode = '23505';
  end;
end;
$$;

revoke all on function public.withdraw_snapshot from public, anon;
grant execute on function public.withdraw_snapshot to authenticated;
