-- KNX — corporations masquées : une corporation que le jeu cote mais que KNX n'affiche pas
-- (cote, graphiques, décomptes, parts de marché). MJ Immo est tenue par les MJ pour leurs
-- besoins de construction : ce n'est pas une entreprise de joueurs.
-- À exécuter après 20261115000000_evenements_marche.sql.
--
-- Ses lignes restent lues et publiées avec chaque relevé : le jeu l'imprime, le registre doit
-- continuer à la reconnaître pour ne pas la recréer à chaque publication.

alter table public.companies add column hidden boolean not null default false;

comment on column public.companies.hidden is
  'Masquée des affichages de KNX ; toujours présente dans les relevés.';

update public.companies set hidden = true where name = 'MJ Immo' and closed_on is null;

-- Jeu de données complet v4 : v3 plus le drapeau « masquée ».
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
        'logoUrl', c.logo_url,
        'hidden', c.hidden
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
