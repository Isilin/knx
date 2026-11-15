-- KNX — adhésions datées aux consortiums.
-- À exécuter après 20261118000000_fiches_vies.sql.
--
-- Une corporation peut quitter son consortium et en rejoindre un autre : l'appartenance devient
-- une suite de périodes datées, portées par la fiche. Tout chiffre lu par consortium dans le temps
-- prend l'appartenance du jour du relevé, jamais l'appartenance actuelle. Une fiche n'appartient
-- qu'à un consortium à la fois : deux périodes peuvent se toucher (départ et adhésion le même
-- jour), jamais se chevaucher.

-- Contrainte d'exclusion sur (fiche, période) : l'égalité d'un bigint dans un index GiST.
create extension if not exists btree_gist with schema extensions;

-- 1. Les périodes. `joined_on` vide : membre depuis avant le premier relevé ; `left_on` vide :
-- toujours membre. Le jour du départ n'est plus couvert.
create table public.consortium_memberships (
  id bigint generated always as identity primary key,
  profile_id bigint not null references public.company_profiles (id) on delete cascade,
  consortium_id bigint not null references public.consortiums (id) on delete cascade,
  joined_on date,
  left_on date,
  created_at timestamptz not null default now(),
  constraint consortium_memberships_dates
    check (joined_on is null or left_on is null or joined_on < left_on),
  constraint consortium_memberships_no_overlap
    exclude using gist (profile_id with =, daterange(joined_on, left_on, '[)') with &&)
);

create index consortium_memberships_consortium_idx
  on public.consortium_memberships (consortium_id);

comment on table public.consortium_memberships is
  'Périodes d''appartenance d''une fiche à un consortium ; une seule à la fois.';
comment on column public.consortium_memberships.joined_on is
  'Premier jour dans le consortium ; vide : membre depuis avant le premier relevé.';
comment on column public.consortium_memberships.left_on is
  'Premier jour hors du consortium ; vide : toujours membre.';

alter table public.consortium_memberships enable row level security;
create policy "memberships are public" on public.consortium_memberships
  for select to anon, authenticated using (true);
create policy "admins manage memberships" on public.consortium_memberships
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 2. Chaque consortium actuel devient une période ouverte des deux côtés : l'opérateur date
-- ensuite les mouvements qu'il connaît.
insert into public.consortium_memberships (profile_id, consortium_id)
select id, consortium_id from public.company_profiles where consortium_id is not null;

-- 3. Jeu de données complet v7 : v6 plus les adhésions. Pour un site pas encore redéployé, le
-- consortium en cours reste aussi sur chaque fiche et chaque vie.
create or replace function public.market_dataset() returns jsonb
language sql stable security invoker set search_path = public as $$
  with current_membership as (
    select distinct on (m.profile_id) m.profile_id, m.consortium_id
    from public.consortium_memberships m
    where m.left_on is null
    order by m.profile_id, m.joined_on desc nulls last
  )
  select jsonb_build_object(
    'generatedAt', now(),
    'profiles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id::text,
        'consortiumId', cm.consortium_id::text,
        'sector', p.sector,
        'district', p.district,
        'logoUrl', p.logo_url,
        'hidden', p.hidden
      ) order by p.id)
      from public.company_profiles p
      left join current_membership cm on cm.profile_id = p.id
    ), '[]'::jsonb),
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id::text,
        'profileId', m.profile_id::text,
        'consortiumId', m.consortium_id::text,
        'joinedOn', m.joined_on,
        'leftOn', m.left_on
      ) order by m.profile_id, m.joined_on nulls first, m.id)
      from public.consortium_memberships m
    ), '[]'::jsonb),
    'companies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id::text,
        'profileId', c.profile_id::text,
        'name', c.name,
        'formerNames', c.aliases,
        'creationOverride', c.creation_override,
        'closedOn', c.closed_on,
        'consortiumId', cm.consortium_id::text,
        'sector', p.sector,
        'district', p.district,
        'logoUrl', p.logo_url,
        'hidden', p.hidden
      ) order by c.name, c.id)
      from public.companies c
      join public.company_profiles p on p.id = c.profile_id
      left join current_membership cm on cm.profile_id = p.id
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

-- 4. Le consortium quitte la fiche : les périodes le remplacent.
alter table public.company_profiles drop column consortium_id;

-- 5. Remplacement de toutes les périodes d'une fiche, d'un seul tenant : la contrainte
-- d'exclusion refuse un chevauchement (23P01), et rien n'est modifié dans ce cas.
-- p_periods : [{ "consortium_id": int, "joined_on": "YYYY-MM-DD"|null, "left_on": "YYYY-MM-DD"|null }]
create or replace function public.set_memberships(p_profile_id bigint, p_periods jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'modification réservée aux opérateurs' using errcode = '42501';
  end if;
  if not exists (select 1 from public.company_profiles where id = p_profile_id) then
    raise exception 'fiche introuvable' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_periods) <> 'array' then
    raise exception 'périodes attendues sous forme de liste';
  end if;

  delete from public.consortium_memberships where profile_id = p_profile_id;
  insert into public.consortium_memberships (profile_id, consortium_id, joined_on, left_on)
  select
    p_profile_id,
    (x->>'consortium_id')::bigint,
    nullif(x->>'joined_on', '')::date,
    nullif(x->>'left_on', '')::date
  from jsonb_array_elements(p_periods) x;
end;
$$;

revoke all on function public.set_memberships from public, anon;
grant execute on function public.set_memberships to authenticated;
