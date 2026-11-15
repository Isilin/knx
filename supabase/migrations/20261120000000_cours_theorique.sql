-- KNX — cours théorique : réglages de la valeur KNX, opérations sur titres et bilans.
-- À exécuter après 20261119000000_adhesions_consortiums.sql.
--
-- La valeur KNX d'une corporation est calculée par le site à partir des relevés, des notations
-- et des réglages en vigueur. Ces tables ne gardent que ce que l'opérateur décide ou recueille :
--   - les versions publiées des réglages (la dernière est en vigueur, les autres font
--     l'historique public de la méthode) ;
--   - les opérations sur titres d'une vie de corporation : introduction, division,
--     regroupement, suspension, reprise, sortie de cote ;
--   - les bilans : local (terrain, bâtiment, aménagement) et stock, déclarés ou audités.
-- Le site lit ces tables à côté de market_dataset() : avant cette migration, il tourne avec les
-- réglages par défaut, sans corporation introduite ni bilan.
-- Le seed (supabase/seed.sql) vide les corporations : opérations et bilans partent avec elles.

-- 1. Versions des réglages. Une version publiée ne se modifie pas : on en publie une autre.
create table public.valuation_settings (
  id bigint generated always as identity primary key,
  published_on date not null default current_date,
  method text not null default 'v1',
  params jsonb not null check (jsonb_typeof(params) = 'object'),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);

create index valuation_settings_date_idx on public.valuation_settings (published_on, id);

alter table public.valuation_settings enable row level security;
create policy "valuation settings are public" on public.valuation_settings
  for select to anon, authenticated using (true);
create policy "admins publish valuation settings" on public.valuation_settings
  for insert to authenticated with check (public.is_admin());
create policy "admins withdraw valuation settings" on public.valuation_settings
  for delete to authenticated using (public.is_admin());

-- 2. Opérations sur titres, par vie : une corporation refondée doit être réintroduite.
-- Le site vérifie l'enchaînement (pas de division avant l'introduction, regroupement qui
-- tombe juste…) avant d'écrire ; la base garde les formes.
create table public.security_operations (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.companies (id) on delete cascade,
  occurred_on date not null,
  kind text not null check (
    kind in ('introduction', 'split', 'reverse_split', 'suspension', 'resumption', 'withdrawal')
  ),
  -- Introduction : nombre de titres émis.
  shares bigint check (shares is null or shares between 1 and 1000000000000),
  -- Division : chaque titre en devient `ratio` ; regroupement : `ratio` titres n'en font qu'un.
  ratio integer check (ratio is null or ratio between 2 and 1000),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  check ((kind = 'introduction') = (shares is not null)),
  check ((kind in ('split', 'reverse_split')) = (ratio is not null))
);

create index security_operations_company_idx
  on public.security_operations (company_id, occurred_on, id);

alter table public.security_operations enable row level security;
create policy "security operations are public" on public.security_operations
  for select to anon, authenticated using (true);
create policy "admins manage security operations" on public.security_operations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 3. Bilans : ce que la corporation possède hors de sa caisse, par vie. Le local en trois
-- couches, comme il se revend (le terrain seul, le bâtiment avec son terrain, la boutique
-- aménagée), et le stock au prix d'achat. Le jeu n'en publie rien : un montant est déclaré par
-- la direction ou audité par l'Agence. Un poste laissé vide garde le dernier montant connu.
create table public.company_balance_sheets (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.companies (id) on delete cascade,
  stated_on date not null,
  land bigint check (land is null or land between 0 and 1000000000000),
  building bigint check (building is null or building between 0 and 1000000000000),
  fittings bigint check (fittings is null or fittings between 0 and 1000000000000),
  stock bigint check (stock is null or stock between 0 and 1000000000000),
  source text not null check (source in ('declared', 'audited')),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  check (coalesce(land, building, fittings, stock) is not null)
);

create index company_balance_sheets_company_idx
  on public.company_balance_sheets (company_id, stated_on, id);

alter table public.company_balance_sheets enable row level security;
create policy "balance sheets are public" on public.company_balance_sheets
  for select to anon, authenticated using (true);
create policy "admins manage balance sheets" on public.company_balance_sheets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
