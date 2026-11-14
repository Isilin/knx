-- KNX — évènements de marché : un fait daté qui touche toute la cote (règle du jeu, faille),
-- affiché dans l'historique de chaque corporation cotée ce jour-là et sur les graphiques.
-- À exécuter après 20261114100000_publication_envois_identite.sql.
--
-- Le seed (supabase/seed.sql) ne vide pas cette table : la relancer garde les évènements.

create table public.market_events (
  id bigint generated always as identity primary key,
  occurred_on date not null,
  -- Étiquette courte des graphiques (« ZD-385 ») ; le titre quand elle est absente.
  label text check (label is null or length(btrim(label)) between 1 and 24),
  title text not null check (length(btrim(title)) > 0),
  description text,
  -- Jours, à partir de la date, sur lesquels on lit ses effets : un flux hors CA de cette
  -- fenêtre lui est rattaché.
  span_days integer not null default 1 check (span_days between 1 and 90),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);

create index market_events_date_idx on public.market_events (occurred_on);

alter table public.market_events enable row level security;
create policy "market events are public" on public.market_events
  for select to anon, authenticated using (true);
create policy "admins manage market events" on public.market_events
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- La faille du 23 mars 2026 : au-delà de 30 M¢, une corporation peut être piratée.
insert into public.market_events (occurred_on, label, title, description, span_days)
values (
  '2026-03-23',
  'ZD-385',
  'Faille ZD-385',
  'Une vulnérabilité zero-day dans les terminaux de trésorerie des corporations expose tout capital supérieur à 30 M¢ au piratage. En une heptade, la plupart des directions générales ramènent leurs coffres sous le seuil : les sorties de capital de cette période sont des mises à l''abri, pas des pertes.',
  7
);

-- Jeu de données complet v3 : v2 plus les évènements de marché.
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
