-- Généré par scripts/import-sheet.ts (--renames) ; ne pas modifier à la main.
-- Changements de nom relevés dans l'historique des versions du tableur, datés du moment où
-- l'en-tête de la colonne a changé. Sans effet s'ils sont déjà enregistrés.
do $$
begin

  -- Hypercore → Kessler Distribution™ (NeuroCore Systems), 2026-03-30.
  if not exists (select 1 from public.companies c where c.name = 'NeuroCore Systems' and c.closed_on is not distinct from null) then
    raise exception 'corporation introuvable : « % »', 'NeuroCore Systems';
  end if;
  insert into public.company_events (company_id, occurred_on, kind, details, note, origin)
  select c.id, '2026-03-30', 'renamed', jsonb_build_object('from', 'Hypercore', 'to', 'Kessler Distribution™'), 'Relevé dans l''historique du tableur, entre le 3/385.4 et le 2/385.5.', 'auto'
  from public.companies c
  where c.name = 'NeuroCore Systems' and c.closed_on is not distinct from null
    and not exists (
      select 1 from public.company_events x
      where x.company_id = c.id and x.kind = 'renamed' and x.details->>'from' = 'Hypercore' and x.details->>'to' = 'Kessler Distribution™'
    );

  -- Don'Expert → Armacham Souvenir (Armacham Souvenir), 2026-04-17.
  if not exists (select 1 from public.companies c where c.name = 'Armacham Souvenir' and c.closed_on is not distinct from '2026-08-20'::date) then
    raise exception 'corporation introuvable : « % »', 'Armacham Souvenir';
  end if;
  insert into public.company_events (company_id, occurred_on, kind, details, note, origin)
  select c.id, '2026-04-17', 'renamed', jsonb_build_object('from', 'Don''Expert', 'to', 'Armacham Souvenir'), 'Relevé dans l''historique du tableur, entre le 2/386.2 et le 3/386.3.', 'auto'
  from public.companies c
  where c.name = 'Armacham Souvenir' and c.closed_on is not distinct from '2026-08-20'::date
    and not exists (
      select 1 from public.company_events x
      where x.company_id = c.id and x.kind = 'renamed' and x.details->>'from' = 'Don''Expert' and x.details->>'to' = 'Armacham Souvenir'
    );

  -- Au Coup d'Poêle → Apothéca (Apothéca), 2026-04-27.
  if not exists (select 1 from public.companies c where c.name = 'Apothéca' and c.closed_on is not distinct from null) then
    raise exception 'corporation introuvable : « % »', 'Apothéca';
  end if;
  insert into public.company_events (company_id, occurred_on, kind, details, note, origin)
  select c.id, '2026-04-27', 'renamed', jsonb_build_object('from', 'Au Coup d''Poêle', 'to', 'Apothéca'), 'Relevé dans l''historique du tableur, entre le 6/386.3 et le 6/386.4.', 'auto'
  from public.companies c
  where c.name = 'Apothéca' and c.closed_on is not distinct from null
    and not exists (
      select 1 from public.company_events x
      where x.company_id = c.id and x.kind = 'renamed' and x.details->>'from' = 'Au Coup d''Poêle' and x.details->>'to' = 'Apothéca'
    );

  -- Sovereign Nidavellir → Sovereign Muse (Sovereign Muse), 2026-05-07.
  if not exists (select 1 from public.companies c where c.name = 'Sovereign Muse' and c.closed_on is not distinct from null) then
    raise exception 'corporation introuvable : « % »', 'Sovereign Muse';
  end if;
  insert into public.company_events (company_id, occurred_on, kind, details, note, origin)
  select c.id, '2026-05-07', 'renamed', jsonb_build_object('from', 'Sovereign Nidavellir', 'to', 'Sovereign Muse'), 'Relevé dans l''historique du tableur le 7/387.1.', 'auto'
  from public.companies c
  where c.name = 'Sovereign Muse' and c.closed_on is not distinct from null
    and not exists (
      select 1 from public.company_events x
      where x.company_id = c.id and x.kind = 'renamed' and x.details->>'from' = 'Sovereign Nidavellir' and x.details->>'to' = 'Sovereign Muse'
    );

  -- Horizon et Style → Place Horizon (Place Horizon), 2026-06-21.
  if not exists (select 1 from public.companies c where c.name = 'Place Horizon' and c.closed_on is not distinct from null) then
    raise exception 'corporation introuvable : « % »', 'Place Horizon';
  end if;
  insert into public.company_events (company_id, occurred_on, kind, details, note, origin)
  select c.id, '2026-06-21', 'renamed', jsonb_build_object('from', 'Horizon et Style', 'to', 'Place Horizon'), 'Relevé dans l''historique du tableur, entre le 7/387.1 et le 7/388.3.', 'auto'
  from public.companies c
  where c.name = 'Place Horizon' and c.closed_on is not distinct from null
    and not exists (
      select 1 from public.company_events x
      where x.company_id = c.id and x.kind = 'renamed' and x.details->>'from' = 'Horizon et Style' and x.details->>'to' = 'Place Horizon'
    );

  -- L'Antre Côte → La Trame Fukyû (La Trame Fukyû), 2026-07-01.
  if not exists (select 1 from public.companies c where c.name = 'La Trame Fukyû' and c.closed_on is not distinct from null) then
    raise exception 'corporation introuvable : « % »', 'La Trame Fukyû';
  end if;
  insert into public.company_events (company_id, occurred_on, kind, details, note, origin)
  select c.id, '2026-07-01', 'renamed', jsonb_build_object('from', 'L''Antre Côte', 'to', 'La Trame Fukyû'), 'Relevé dans l''historique du tableur, entre le 7/388.3 et le 1/389.1.', 'auto'
  from public.companies c
  where c.name = 'La Trame Fukyû' and c.closed_on is not distinct from null
    and not exists (
      select 1 from public.company_events x
      where x.company_id = c.id and x.kind = 'renamed' and x.details->>'from' = 'L''Antre Côte' and x.details->>'to' = 'La Trame Fukyû'
    );

  -- Edge Logistics → Kessler Industries™ (Kessler Industries™), 2026-07-01.
  if not exists (select 1 from public.companies c where c.name = 'Kessler Industries™' and c.closed_on is not distinct from null) then
    raise exception 'corporation introuvable : « % »', 'Kessler Industries™';
  end if;
  insert into public.company_events (company_id, occurred_on, kind, details, note, origin)
  select c.id, '2026-07-01', 'renamed', jsonb_build_object('from', 'Edge Logistics', 'to', 'Kessler Industries™'), 'Relevé dans l''historique du tableur le 1/389.1.', 'auto'
  from public.companies c
  where c.name = 'Kessler Industries™' and c.closed_on is not distinct from null
    and not exists (
      select 1 from public.company_events x
      where x.company_id = c.id and x.kind = 'renamed' and x.details->>'from' = 'Edge Logistics' and x.details->>'to' = 'Kessler Industries™'
    );

  -- Kessler Distribution™ → NeuroCore Systems (NeuroCore Systems), 2026-07-01.
  if not exists (select 1 from public.companies c where c.name = 'NeuroCore Systems' and c.closed_on is not distinct from null) then
    raise exception 'corporation introuvable : « % »', 'NeuroCore Systems';
  end if;
  insert into public.company_events (company_id, occurred_on, kind, details, note, origin)
  select c.id, '2026-07-01', 'renamed', jsonb_build_object('from', 'Kessler Distribution™', 'to', 'NeuroCore Systems'), 'Relevé dans l''historique du tableur le 1/389.1.', 'auto'
  from public.companies c
  where c.name = 'NeuroCore Systems' and c.closed_on is not distinct from null
    and not exists (
      select 1 from public.company_events x
      where x.company_id = c.id and x.kind = 'renamed' and x.details->>'from' = 'Kessler Distribution™' and x.details->>'to' = 'NeuroCore Systems'
    );

  -- MilitariX → L'Impact (L'Impact), 2026-07-01.
  if not exists (select 1 from public.companies c where c.name = 'L''Impact' and c.closed_on is not distinct from null) then
    raise exception 'corporation introuvable : « % »', 'L''Impact';
  end if;
  insert into public.company_events (company_id, occurred_on, kind, details, note, origin)
  select c.id, '2026-07-01', 'renamed', jsonb_build_object('from', 'MilitariX', 'to', 'L''Impact'), 'Relevé dans l''historique du tableur le 1/389.1.', 'auto'
  from public.companies c
  where c.name = 'L''Impact' and c.closed_on is not distinct from null
    and not exists (
      select 1 from public.company_events x
      where x.company_id = c.id and x.kind = 'renamed' and x.details->>'from' = 'MilitariX' and x.details->>'to' = 'L''Impact'
    );

  -- InMeaBulla → Metropolis (Metropolis), 2026-10-14.
  if not exists (select 1 from public.companies c where c.name = 'Metropolis' and c.closed_on is not distinct from null) then
    raise exception 'corporation introuvable : « % »', 'Metropolis';
  end if;
  insert into public.company_events (company_id, occurred_on, kind, details, note, origin)
  select c.id, '2026-10-14', 'renamed', jsonb_build_object('from', 'InMeaBulla', 'to', 'Metropolis'), 'Relevé dans l''historique du tableur le 7/392.2.', 'auto'
  from public.companies c
  where c.name = 'Metropolis' and c.closed_on is not distinct from null
    and not exists (
      select 1 from public.company_events x
      where x.company_id = c.id and x.kind = 'renamed' and x.details->>'from' = 'InMeaBulla' and x.details->>'to' = 'Metropolis'
    );
end;
$$;
