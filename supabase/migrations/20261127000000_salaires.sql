-- KNX — salaires : chiffres audités ou déclarés du salaire moyen d'une corporation.
-- À exécuter après 20261126000000_modele_c_successions.sql.
--
-- Le jeu prélève les salaires dans la trésorerie chaque jour à minuit ; le DG n'est pas payé.
-- Lire un salaire demande une commande de deck par employé : KNX suppose donc le salaire de
-- référence du secteur (réglages de la valeur KNX), sauf pour une corporation dont l'Agence a
-- audité le salaire, ou dont la direction l'a déclaré. Un chiffre est le salaire moyen d'un
-- salarié payé, en crédits par jour, pour une vie ; il vaut depuis sa date jusqu'au suivant, et
-- le premier couvre aussi les jours d'avant.

create table public.company_wage_figures (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.companies (id) on delete cascade,
  stated_on date not null,
  wage bigint not null check (wage between 0 and 1000000),
  source text not null check (source in ('declared', 'audited')),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);

create index company_wage_figures_company_idx
  on public.company_wage_figures (company_id, stated_on, id);

alter table public.company_wage_figures enable row level security;
create policy "wage figures are public" on public.company_wage_figures
  for select to anon, authenticated using (true);
create policy "admins manage wage figures" on public.company_wage_figures
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
