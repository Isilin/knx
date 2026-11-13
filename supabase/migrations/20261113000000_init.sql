-- KNX — Kessler & Nomura Exchange : schéma initial.
-- Lecture publique des relevés publiés ; écriture réservée aux administrateurs (table admins).

create table public.companies (
  id bigint generated always as identity primary key,
  name text not null unique,
  aliases text[] not null default '{}',
  group_name text,
  sector text,
  creation_override date,
  created_at timestamptz not null default now()
);

create type public.snapshot_source as enum ('sheet', 'form', 'paste', 'userscript');
create type public.snapshot_status as enum ('pending', 'published');

create table public.snapshots (
  id bigint generated always as identity primary key,
  taken_on date not null unique,
  source public.snapshot_source not null,
  status public.snapshot_status not null default 'published',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create table public.snapshot_rows (
  snapshot_id bigint not null references public.snapshots (id) on delete cascade,
  company_id bigint not null references public.companies (id) on delete restrict,
  rank integer check (rank is null or rank > 0),
  chiffre bigint not null check (chiffre >= 0),
  capital bigint,
  employees integer check (employees is null or employees >= 0),
  primary key (snapshot_id, company_id)
);

create index snapshot_rows_company_idx on public.snapshot_rows (company_id);

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

alter table public.companies enable row level security;
alter table public.snapshots enable row level security;
alter table public.snapshot_rows enable row level security;
alter table public.admins enable row level security;

create policy "companies are public" on public.companies
  for select to anon, authenticated using (true);
create policy "admins manage companies" on public.companies
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "published snapshots are public" on public.snapshots
  for select to anon, authenticated using (status = 'published' or public.is_admin());
create policy "admins manage snapshots" on public.snapshots
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "rows of published snapshots are public" on public.snapshot_rows
  for select to anon, authenticated using (
    exists (
      select 1 from public.snapshots s
      where s.id = snapshot_id and (s.status = 'published' or public.is_admin())
    )
  );
create policy "admins manage rows" on public.snapshot_rows
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admins see admins" on public.admins
  for select to authenticated using (public.is_admin());

-- Publication atomique d'un relevé : crée les entreprises inconnues, remplace le relevé du jour
-- si p_replace est vrai, et refuse tout appelant non administrateur.
-- p_rows : [{ "name": text, "rank": int|null, "chiffre": int, "capital": int|null, "employees": int|null }]
create function public.publish_snapshot(
  p_taken_on date,
  p_source public.snapshot_source,
  p_rows jsonb,
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
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'relevé vide';
  end if;

  if p_replace then
    delete from public.snapshots where taken_on = p_taken_on;
  elsif exists (select 1 from public.snapshots where taken_on = p_taken_on) then
    raise exception 'un relevé existe déjà pour le %', p_taken_on using errcode = '23505';
  end if;

  insert into public.companies (name)
  select distinct r->>'name' from jsonb_array_elements(p_rows) r
  on conflict (name) do nothing;

  insert into public.snapshots (taken_on, source, status, created_by)
  values (p_taken_on, p_source, p_status, auth.uid())
  returning id into v_snapshot_id;

  insert into public.snapshot_rows (snapshot_id, company_id, rank, chiffre, capital, employees)
  select
    v_snapshot_id,
    c.id,
    nullif(r->>'rank', '')::integer,
    (r->>'chiffre')::bigint,
    nullif(r->>'capital', '')::bigint,
    nullif(r->>'employees', '')::integer
  from jsonb_array_elements(p_rows) r
  join public.companies c on c.name = r->>'name';

  return v_snapshot_id;
end;
$$;

revoke all on function public.publish_snapshot from public, anon;
grant execute on function public.publish_snapshot to authenticated;

-- Jeu de données complet en un appel (respecte la RLS : security invoker).
create function public.market_dataset() returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'generatedAt', now(),
    'companies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', c.name,
        'aliases', c.aliases,
        'group', c.group_name,
        'sector', c.sector,
        'creationOverride', c.creation_override
      ) order by c.name)
      from public.companies c
    ), '[]'::jsonb),
    'snapshots', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', s.taken_on,
        'source', s.source,
        'rows', coalesce((
          select jsonb_agg(jsonb_build_object(
            'name', c.name,
            'rank', r.rank,
            'chiffre', r.chiffre,
            'capital', r.capital,
            'employees', r.employees
          ))
          from public.snapshot_rows r
          join public.companies c on c.id = r.company_id
          where r.snapshot_id = s.id
        ), '[]'::jsonb)
      ) order by s.taken_on)
      from public.snapshots s
      where s.status = 'published'
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.market_dataset to anon, authenticated;
