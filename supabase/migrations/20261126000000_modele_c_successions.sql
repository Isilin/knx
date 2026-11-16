-- KNX — modèle C, phase 3 : gel des comptes, successions et saisies.
-- À exécuter après 20261125000000_modele_c_dividendes_capital.sql.
--
-- 1. Gel : à la mort d'un personnage (succession) ou sur saisie de la DAI, l'opérateur gèle le
--    compte. Tout est figé : ses ordres, souscriptions et demandes de retrait sont annulés, plus
--    rien ne s'y passe à l'initiative du titulaire ; une corporation gelée n'ouvre plus d'offre et
--    ses dividendes annoncés sont retirés. Les dividendes continuent d'arriver au compte gelé.
-- 2. Dénouement, au cas par cas, selon la décision RP :
--    · transmission de titres et de crédits à un ou plusieurs comptes (héritiers, ou l'Empire en
--      cas de confiscation), autant de fois que nécessaire ;
--    · vente au marché : KNX place des ordres de vente pour le compte gelé ;
--    · rachat par la corporation de ses propres titres, payé depuis son compte KNX ;
--    · levée du gel (enquête close, titulaire revenu) ou clôture du compte une fois vide.

-- 1. État du compte : gelé ou non, pourquoi.
alter table public.investor_accounts
  add column frozen_at timestamptz,
  add column freeze_reason text check (freeze_reason in ('succession', 'seizure')),
  add column freeze_note text,
  add constraint investor_accounts_freeze_check check ((frozen_at is null) = (freeze_reason is null));

-- Historique des gels, lisible par le titulaire.
create table public.account_freezes (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.investor_accounts (user_id) on delete restrict,
  reason text not null check (reason in ('succession', 'seizure')),
  note text,
  frozen_at timestamptz not null default now(),
  frozen_by uuid default auth.uid() references auth.users (id) on delete set null,
  lifted_at timestamptz,
  lifted_by uuid references auth.users (id) on delete set null,
  -- Comment le gel s'est dénoué : levé, compte clôturé…
  outcome text
);

create index account_freezes_account_idx on public.account_freezes (account_id, frozen_at);

alter table public.account_freezes enable row level security;
create policy "an investor reads their own freezes" on public.account_freezes
  for select to authenticated using (account_id = auth.uid() or public.is_admin());

-- 2. Transmissions d'un compte gelé : des titres d'une corporation, des crédits, ou les deux.
create table public.account_transfers (
  id bigint generated always as identity primary key,
  from_account uuid not null references public.investor_accounts (user_id) on delete restrict,
  to_account uuid not null references public.investor_accounts (user_id) on delete restrict,
  company_id bigint references public.companies (id) on delete restrict,
  quantity bigint check (quantity is null or quantity > 0),
  amount bigint check (amount is null or amount > 0),
  reason text not null check (reason in ('succession', 'confiscation', 'other')),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  check (from_account <> to_account),
  check ((company_id is null) = (quantity is null)),
  check (quantity is not null or amount is not null)
);

create index account_transfers_from_idx on public.account_transfers (from_account);
create index account_transfers_to_idx on public.account_transfers (to_account);

alter table public.account_transfers enable row level security;
create policy "an investor reads their own transfers" on public.account_transfers
  for select to authenticated
  using (from_account = auth.uid() or to_account = auth.uid() or public.is_admin());

-- Les titres transmis passent par share_issues, les crédits par cash_movements : soldes, titres,
-- dividendes et classement les lisent sans changement.
alter table public.share_issues drop constraint share_issues_reason_check;
alter table public.share_issues add constraint share_issues_reason_check
  check (reason in ('endowment', 'split', 'reverse_split', 'capital_increase', 'transfer'));
alter table public.share_issues
  add column transfer_id bigint references public.account_transfers (id) on delete restrict;
alter table public.cash_movements
  add column transfer_id bigint references public.account_transfers (id) on delete restrict;

-- 3. Rachat par la corporation : une exécution hors séance d'enchère, sans ordre ni offre.
alter table public.market_trades
  add column buyback boolean not null default false;

-- 4. Un compte est-il gelé ?
create function public.account_frozen(p_account uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.investor_accounts where user_id = p_account and frozen_at is not null
  );
$$;

-- 5. Garde-fous : rien ne s'inscrit sur un compte gelé à l'initiative de son titulaire.
--    · ordres et souscriptions : seul l'opérateur en place (ventes au marché d'un compte gelé) ;
--    · annulation d'un ordre : réservée à l'opérateur ;
--    · mouvements de crédits : seules les transmissions ;
--    · offres et dividendes d'une corporation gelée : refusés.
create function public.guard_frozen_order() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.account_frozen(new.account_id) and not public.is_admin() then
    if tg_op = 'INSERT' then
      raise exception 'compte gelé : aucun ordre ni souscription jusqu''à la levée du gel';
    end if;
    if new.status = 'cancelled' and old.status = 'open' then
      raise exception 'compte gelé : seul KNX gère ses ordres';
    end if;
  end if;
  return new;
end;
$$;

create trigger market_orders_guard_frozen
  before insert or update on public.market_orders
  for each row execute function public.guard_frozen_order();

create function public.guard_frozen_movement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.transfer_id is null and public.account_frozen(new.account_id) then
    raise exception 'compte gelé : ni dépôt ni retrait jusqu''à la levée du gel';
  end if;
  return new;
end;
$$;

create trigger cash_movements_guard_frozen
  before insert on public.cash_movements
  for each row execute function public.guard_frozen_movement();

create function public.guard_frozen_corporation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.account_frozen(new.account_id) then
    raise exception 'le compte de cette corporation est gelé';
  end if;
  return new;
end;
$$;

create trigger market_offers_guard_frozen
  before insert on public.market_offers
  for each row execute function public.guard_frozen_corporation();
create trigger dividends_guard_frozen
  before insert on public.dividends
  for each row execute function public.guard_frozen_corporation();

-- 6. Gel d'un compte : tout ce qui attendait est annulé.
create function public.freeze_account(p_account uuid, p_reason text, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_account public.investor_accounts;
  v_offer bigint;
begin
  if not public.is_admin() then
    raise exception 'réservé aux opérateurs' using errcode = '42501';
  end if;
  if p_reason not in ('succession', 'seizure') then
    raise exception 'motif de gel : succession ou saisie';
  end if;
  select * into v_account from public.investor_accounts where user_id = p_account for update;
  if not found or v_account.closed_at is not null then
    raise exception 'compte introuvable ou clôturé';
  end if;
  if v_account.frozen_at is not null then
    raise exception 'ce compte est déjà gelé';
  end if;
  update public.investor_accounts
  set frozen_at = now(), freeze_reason = p_reason, freeze_note = nullif(btrim(p_note), '')
  where user_id = p_account;
  insert into public.account_freezes (account_id, reason, note)
  values (p_account, p_reason, nullif(btrim(p_note), ''));

  update public.market_orders
  set status = 'cancelled', closed_at = now(), reason = 'compte gelé'
  where account_id = p_account and status = 'open';
  update public.cash_movements
  set status = 'cancelled', settled_at = now(), settled_by = auth.uid()
  where account_id = p_account and kind = 'withdrawal' and status = 'requested';
  -- A corporation's account: its open offers and announced dividends go too.
  for v_offer in
    select id from public.market_offers where account_id = p_account and status = 'open'
  loop
    update public.market_offers set status = 'cancelled', closed_at = now() where id = v_offer;
    update public.market_orders
    set status = 'cancelled', closed_at = now(), reason = 'offre retirée : compte de la corporation gelé'
    where offer_id = v_offer and status = 'open';
  end loop;
  update public.dividends
  set status = 'cancelled', closed_at = now(), reason = 'compte de la corporation gelé'
  where account_id = p_account and status = 'declared';
end;
$$;

-- 7. Levée du gel : le titulaire retrouve la main.
create function public.unfreeze_account(p_account uuid, p_outcome text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'réservé aux opérateurs' using errcode = '42501';
  end if;
  update public.investor_accounts
  set frozen_at = null, freeze_reason = null, freeze_note = null
  where user_id = p_account and frozen_at is not null;
  if not found then
    raise exception 'ce compte n''est pas gelé';
  end if;
  update public.account_freezes
  set lifted_at = now(), lifted_by = auth.uid(),
      outcome = coalesce(nullif(btrim(p_outcome), ''), 'gel levé')
  where account_id = p_account and lifted_at is null;
end;
$$;

-- 8. Transmission depuis un compte gelé, vers un compte d'investisseur ouvert et non gelé : des
-- titres libres d'une corporation, des crédits disponibles, ou les deux.
create function public.transfer_holdings(
  p_from uuid, p_to uuid, p_company bigint, p_quantity bigint, p_amount bigint,
  p_reason text, p_note text default null
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_to public.investor_accounts;
  v_held bigint;
  v_reserved bigint;
  v_available bigint;
  v_note text := nullif(btrim(p_note), '');
  v_label text;
  v_id bigint;
begin
  if not public.is_admin() then
    raise exception 'réservé aux opérateurs' using errcode = '42501';
  end if;
  if p_reason not in ('succession', 'confiscation', 'other') then
    raise exception 'motif de transmission inconnu';
  end if;
  perform 1 from public.investor_accounts where user_id = p_from for update;
  if not public.account_frozen(p_from) then
    raise exception 'seul un compte gelé se transmet';
  end if;
  select * into v_to from public.investor_accounts where user_id = p_to for update;
  if not found or v_to.closed_at is not null or v_to.frozen_at is not null then
    raise exception 'compte destinataire introuvable, clôturé ou gelé';
  end if;
  if v_to.company_profile_id is not null then
    raise exception 'un compte de corporation ne reçoit pas de transmission : passez par un rachat';
  end if;
  if p_from = p_to then
    raise exception 'le compte destinataire est le compte gelé';
  end if;
  if (p_company is null) <> (p_quantity is null) then
    raise exception 'des titres se transmettent avec leur corporation et leur nombre';
  end if;
  if p_quantity is null and p_amount is null then
    raise exception 'rien à transmettre';
  end if;
  if p_quantity is not null then
    if p_quantity < 1 then
      raise exception 'nombre de titres invalide';
    end if;
    select held, reserved into v_held, v_reserved from public.account_shares(p_from, p_company);
    if p_quantity > v_held - v_reserved then
      raise exception 'le compte gelé n''a que % titres libres de cette corporation', v_held - v_reserved;
    end if;
  end if;
  if p_amount is not null then
    if p_amount < 1 then
      raise exception 'montant invalide';
    end if;
    select available into v_available from public.account_cash(p_from);
    if p_amount > v_available then
      raise exception 'le compte gelé n''a que % crédits disponibles', v_available;
    end if;
  end if;

  insert into public.account_transfers
    (from_account, to_account, company_id, quantity, amount, reason, note)
  values (p_from, p_to, p_company, p_quantity, p_amount, p_reason, v_note)
  returning id into v_id;
  if p_quantity is not null then
    insert into public.share_issues (company_id, account_id, quantity, reason, transfer_id) values
      (p_company, p_from, -p_quantity, 'transfer', v_id),
      (p_company, p_to, p_quantity, 'transfer', v_id);
  end if;
  if p_amount is not null then
    v_label := case p_reason when 'succession' then 'Succession' when 'confiscation' then 'Confiscation'
                             else 'Transmission' end || coalesce(' — ' || v_note, '');
    insert into public.cash_movements
      (account_id, kind, amount, status, note, settled_at, settled_by, transfer_id) values
      (p_from, 'withdrawal', p_amount, 'done', v_label, now(), auth.uid(), v_id),
      (p_to, 'deposit', p_amount, 'done', v_label, now(), auth.uid(), v_id);
  end if;
  return v_id;
end;
$$;

-- 9. Vente au marché pour un compte gelé : un ordre de vente ordinaire, placé par KNX, servi à
-- la clôture comme les autres.
create function public.sell_for_account(
  p_account uuid, p_company bigint, p_quantity integer, p_limit numeric, p_sessions integer default 1
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_session bigint;
  v_held bigint;
  v_reserved bigint;
  v_id bigint;
begin
  if not public.is_admin() then
    raise exception 'réservé aux opérateurs' using errcode = '42501';
  end if;
  perform 1 from public.investor_accounts where user_id = p_account for update;
  if not public.account_frozen(p_account) then
    raise exception 'KNX ne vend que pour un compte gelé';
  end if;
  if p_quantity is null or p_quantity < 1 then
    raise exception 'nombre de titres invalide';
  end if;
  if p_limit is null or p_limit <= 0 or p_limit <> round(p_limit, 2) then
    raise exception 'prix limite positif, au centième près';
  end if;
  if p_sessions is null or p_sessions not between 1 and 4 then
    raise exception 'durée de vie d''un ordre : de 1 à 4 séances';
  end if;
  select id into v_session from public.market_sessions where status = 'open';
  if v_session is null then
    raise exception 'aucune séance ouverte';
  end if;
  if coalesce(public.listing_state(p_company), '') <> 'listed' then
    raise exception 'ce titre n''est pas coté, ou sa cotation est suspendue';
  end if;
  select held, reserved into v_held, v_reserved from public.account_shares(p_account, p_company);
  if p_quantity > v_held - v_reserved then
    raise exception 'le compte gelé n''a que % titres libres de cette corporation', v_held - v_reserved;
  end if;
  insert into public.market_orders
    (session_id, account_id, company_id, side, quantity, limit_price, reserved, sessions_left, reason)
  values (v_session, p_account, p_company, 'sell', p_quantity, p_limit, 0, p_sessions,
          'vente par KNX pour le compte gelé')
  returning id into v_id;
  return v_id;
end;
$$;

-- 10. Rachat par la corporation de ses titres détenus par un compte gelé, à un prix décidé au cas
-- par cas, payé depuis son compte KNX ; commission en vigueur des deux côtés, comme toute exécution.
create function public.buyback_shares(
  p_account uuid, p_company bigint, p_quantity integer, p_price numeric
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_corp public.investor_accounts;
  v_session bigint;
  v_held bigint;
  v_reserved bigint;
  v_amount bigint;
  v_fee bigint;
  v_available bigint;
begin
  if not public.is_admin() then
    raise exception 'réservé aux opérateurs' using errcode = '42501';
  end if;
  perform 1 from public.investor_accounts where user_id = p_account for update;
  if not public.account_frozen(p_account) then
    raise exception 'un rachat dénoue le gel d''un compte : ce compte n''est pas gelé';
  end if;
  select a.* into v_corp
  from public.investor_accounts a
  join public.companies c on c.profile_id = a.company_profile_id
  where c.id = p_company and a.closed_at is null
  for update of a;
  if not found then
    raise exception 'aucun compte de corporation pour ce titre';
  end if;
  if v_corp.frozen_at is not null then
    raise exception 'le compte de cette corporation est gelé';
  end if;
  if v_corp.user_id = p_account then
    raise exception 'la corporation ne se rachète pas à elle-même';
  end if;
  select id into v_session from public.market_sessions where status = 'open';
  if v_session is null then
    raise exception 'aucune séance ouverte';
  end if;
  if p_quantity is null or p_quantity < 1 then
    raise exception 'nombre de titres invalide';
  end if;
  if p_price is null or p_price <= 0 or p_price <> round(p_price, 2) then
    raise exception 'prix positif, au centième près';
  end if;
  select held, reserved into v_held, v_reserved from public.account_shares(p_account, p_company);
  if p_quantity > v_held - v_reserved then
    raise exception 'le compte gelé n''a que % titres libres de cette corporation', v_held - v_reserved;
  end if;
  v_amount := round(p_quantity * p_price)::bigint;
  v_fee := ceil(v_amount * public.market_param('commission', 0.01))::bigint;
  select available into v_available from public.account_cash(v_corp.user_id);
  if v_amount + v_fee > v_available then
    raise exception 'ce rachat coûte % crédits ; la corporation n''en a que % de disponibles',
      v_amount + v_fee, v_available;
  end if;
  insert into public.market_trades
    (session_id, order_id, account_id, company_id, side, quantity, price, amount, commission, buyback)
  values
    (v_session, null, v_corp.user_id, p_company, 'buy', p_quantity, p_price, v_amount, v_fee, true),
    (v_session, null, p_account, p_company, 'sell', p_quantity, p_price, v_amount, v_fee, true);
end;
$$;

-- 11. Clôture d'un compte vide : ni titre, ni crédit, ni ordre, ni retrait en attente.
create function public.close_account(p_account uuid, p_outcome text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_account public.investor_accounts;
  v_balance bigint;
  v_pending bigint;
begin
  if not public.is_admin() then
    raise exception 'réservé aux opérateurs' using errcode = '42501';
  end if;
  select * into v_account from public.investor_accounts where user_id = p_account for update;
  if not found or v_account.closed_at is not null then
    raise exception 'compte introuvable ou déjà clôturé';
  end if;
  if exists (
    select 1 from (
      select company_id, quantity from public.share_issues where account_id = p_account
      union all
      select company_id, case side when 'buy' then quantity else -quantity end
      from public.market_trades where account_id = p_account
    ) h
    group by company_id
    having sum(quantity) <> 0
  ) then
    raise exception 'le compte détient encore des titres : transmettez-les ou vendez-les d''abord';
  end if;
  if exists (select 1 from public.market_orders where account_id = p_account and status = 'open') then
    raise exception 'des ordres du compte attendent la séance';
  end if;
  select balance, pending into v_balance, v_pending from public.account_cash(p_account);
  if v_pending <> 0 then
    raise exception 'une demande de retrait attend d''être réglée';
  end if;
  if v_balance <> 0 then
    raise exception 'le compte a encore % crédits : transmettez-les ou versez-les d''abord', v_balance;
  end if;
  update public.investor_accounts
  set closed_at = now(), frozen_at = null, freeze_reason = null, freeze_note = null,
      public_ranking = false
  where user_id = p_account;
  update public.account_freezes
  set lifted_at = now(), lifted_by = auth.uid(),
      outcome = coalesce(nullif(btrim(p_outcome), ''), 'compte clôturé')
  where account_id = p_account and lifted_at is null;
end;
$$;

-- 12. Classement : un compte gelé n'y figure plus.
create or replace function public.public_ranking()
returns table (rank_key text, display_name text, invested bigint, cash bigint, positions jsonb)
language sql stable security definer set search_path = public as $$
  select
    md5(a.user_id::text),
    a.display_name,
    (
      coalesce((select sum(amount) from public.cash_movements
                where account_id = a.user_id and kind = 'deposit' and status = 'done'), 0)
      - coalesce((select sum(amount) from public.cash_movements
                  where account_id = a.user_id and kind = 'withdrawal' and status = 'done'), 0)
    )::bigint,
    (select balance from public.account_cash(a.user_id)),
    coalesce((
      select jsonb_agg(jsonb_build_object('company_id', p.company_id, 'quantity', p.quantity))
      from (
        select company_id, sum(quantity) as quantity from (
          select company_id, quantity from public.share_issues where account_id = a.user_id
          union all
          select company_id, case side when 'buy' then quantity else -quantity end
          from public.market_trades where account_id = a.user_id
        ) h
        group by company_id
        having sum(quantity) > 0
      ) p
    ), '[]'::jsonb)
  from public.investor_accounts a
  where a.public_ranking and a.closed_at is null and a.company_profile_id is null
    and a.frozen_at is null;
$$;

revoke all on function public.account_frozen from public, anon, authenticated;
revoke all on function public.guard_frozen_order from public, anon, authenticated;
revoke all on function public.guard_frozen_movement from public, anon, authenticated;
revoke all on function public.guard_frozen_corporation from public, anon, authenticated;
revoke all on function public.freeze_account from public, anon;
revoke all on function public.unfreeze_account from public, anon;
revoke all on function public.transfer_holdings from public, anon;
revoke all on function public.sell_for_account from public, anon;
revoke all on function public.buyback_shares from public, anon;
revoke all on function public.close_account from public, anon;
grant execute on function public.freeze_account to authenticated;
grant execute on function public.unfreeze_account to authenticated;
grant execute on function public.transfer_holdings to authenticated;
grant execute on function public.sell_for_account to authenticated;
grant execute on function public.buyback_shares to authenticated;
grant execute on function public.close_account to authenticated;
