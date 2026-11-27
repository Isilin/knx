-- Secteurs de sept corporations fermées, lus dans le relevé des salaires du 17 avril 2026
-- (onglet « Salaires » du tableur, colonne « Type »). Sans secteur, une corporation prend le
-- salaire de référence tous secteurs ; avec, celui de son secteur. Sans effet sur une fiche dont
-- le secteur est déjà renseigné.
do $$
declare
  fix record;
  found bigint;
begin
  for fix in
    select * from (values
      ('SMI Hardgun''s', date '2026-11-11', 'boutique-armes'),
      ('Kob Koncept', date '2026-09-19', 'atelier-personnalisation'),
      ('Armacham Souvenir', date '2026-08-20', 'boutique-specialisee'),
      ('Don''Custom', date '2026-05-22', 'atelier-personnalisation'),
      ('Equinox', date '2026-05-07', 'technopole'),
      ('Le Continental', date '2026-04-20', 'bar-restaurant'),
      ('Sovereign Tactical', date '2026-05-05', 'boutique-armes')
    ) as t (name, closed_on, sector)
  loop
    select c.profile_id into found
    from public.companies c
    where c.name = fix.name and c.closed_on is not distinct from fix.closed_on;
    if found is null then
      raise exception 'corporation introuvable : « % » fermée le %', fix.name, fix.closed_on;
    end if;
    update public.company_profiles p
    set sector = fix.sector
    where p.id = found and p.sector is null;
  end loop;
end $$;
