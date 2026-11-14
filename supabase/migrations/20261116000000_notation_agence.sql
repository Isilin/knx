-- KNX — notation de l'Agence impériale de notation des entreprises, et quartier des corporations.
-- À exécuter après 20261115000000_evenements_marche.sql.
--
-- Une notation est un acte daté : la catégorie, le score, chaque critère (valeur, note, source)
-- et ce que l'opérateur a saisi sont figés à la publication, avec la version de la méthode suivie.
-- Le seed (supabase/seed.sql) vide cette table avec les corporations : ne pas le relancer après
-- avoir noté depuis le site.

-- 1. Quartier d'implantation : critère « Localisation » de la notation.
alter table public.companies
  add column district text check (district in ('cv', 'bv', 'hv'));

-- 2. Notations publiées.
create table public.company_ratings (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.companies (id) on delete cascade,
  rated_on date not null,
  method text not null,
  category text not null
    check (category in ('omega', 'alpha', 'beta', 'gamma', 'delta', 'epsilon')),
  confidence text not null check (confidence in ('high', 'standard', 'low')),
  outlook text not null check (outlook in ('positive', 'stable', 'negative')),
  score numeric(4, 2) not null check (score between 0 and 5),
  axes jsonb not null,
  criteria jsonb not null,
  inputs jsonb not null,
  district text check (district in ('cv', 'bv', 'hv')),
  rationale text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (company_id, rated_on)
);

create index company_ratings_company_idx on public.company_ratings (company_id, rated_on);

alter table public.company_ratings enable row level security;
create policy "ratings are public" on public.company_ratings
  for select to anon, authenticated using (true);
create policy "admins manage ratings" on public.company_ratings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 3. Jeu de données complet v4 : v3 plus le quartier et les notations.
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
        'district', c.district,
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
