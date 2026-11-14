-- KNX — retirer un relevé publié depuis le journal.
-- À exécuter après 20261114100000_publication_envois_identite.sql.
--
-- La saisie manuelle a disparu : un relevé publié par erreur ne pouvait plus être corrigé, l'API
-- refusant tout envoi pour une date déjà publiée. L'opérateur retire le relevé, ce qui défait sa
-- publication, puis le module du jeu peut renvoyer le rapport du jour.
--
-- Seul le dernier relevé publié peut être retiré : aucun relevé n'a suivi ses fermetures et ses
-- renommages, on les annule donc sans réécrire l'histoire qui vient après. Mêmes règles que le
-- mode local (planWithdrawal dans src/domain/mutations.ts).

create function public.withdraw_snapshot(p_taken_on date) returns void
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

  -- Le relevé et ses lignes (on delete cascade), puis les corporations qu'il a créées.
  delete from public.snapshots where id = v_snapshot.id;
  delete from public.companies where id = any(v_created);

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
    raise exception 'une corporation rouverte porterait le nom d''une corporation ouverte'
      using errcode = '23505';
  end;
end;
$$;

revoke all on function public.withdraw_snapshot from public, anon;
grant execute on function public.withdraw_snapshot to authenticated;
