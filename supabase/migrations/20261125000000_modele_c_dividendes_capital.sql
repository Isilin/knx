-- KNX — modèle C, phase 2 : dividendes et augmentations de capital.
-- À exécuter après 20261124000000_modele_c_introduction.sql.
--
-- 1. Politique de distribution : chaque corporation cotée annonce ce qu'elle fait de ses
--    bénéfices (accumulation, distribution, autre, rien du tout). L'historique est gardé : un
--    changement de politique est une information pour les investisseurs.
-- 2. Dividendes : pendant une séance, une corporation qui distribue annonce un montant par
--    titre ; ses crédits sont retenus sur son compte KNX. À la clôture, avant l'enchère, chaque
--    investisseur qui détient des titres reçoit sa part (arrondie au crédit inférieur) ; qui
--    achète pendant cette séance achète donc sans le dividende.
-- 3. Augmentation de capital : une offre d'émission met en vente des titres nouveaux. À la
--    clôture, les titres souscrits sont créés (opération sur titres « capital_increase ») et le
--    produit va au compte de la corporation ; les autres détenteurs sont dilués.

-- 1. Politiques de distribution, datées.
create table public.dividend_policies (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.companies (id) on delete cascade,
  decided_on date not null,
  policy text not null check (policy in ('accumulating', 'distributing', 'other', 'none')),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  -- « Autre » se décrit.
  check (policy <> 'other' or nullif(btrim(note), '') is not null)
);

create index dividend_policies_company_idx
  on public.dividend_policies (company_id, decided_on, id);

alter table public.dividend_policies enable row level security;
create policy "dividend policies are public" on public.dividend_policies
  for select to anon, authenticated using (true);
create policy "admins manage dividend policies" on public.dividend_policies
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 2. Dividendes annoncés pendant une séance, versés à sa clôture.
create table public.dividends (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.companies (id) on delete restrict,
  -- Le compte de la corporation, qui paie.
  account_id uuid not null references public.investor_accounts (user_id) on delete restrict,
  session_id bigint not null references public.market_sessions (id) on delete restrict,
  per_share numeric(14, 2) not null check (per_share > 0),
  status text not null default 'declared' check (status in ('declared', 'paid', 'cancelled')),
  -- Titres servis, et crédits : retenus à l'annonce, versés à la clôture.
  shares bigint not null default 0 check (shares >= 0),
  total bigint not null default 0 check (total >= 0),
  note text,
  -- Pourquoi un dividende annoncé n'a pas été versé.
  reason text,
  paid_on date,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  check ((status = 'paid') = (paid_on is not null))
);

create index dividends_session_idx on public.dividends (session_id, status);
create index dividends_company_idx on public.dividends (company_id, created_at);

alter table public.dividends enable row level security;
create policy "dividends are public" on public.dividends
  for select to anon, authenticated using (true);

create table public.dividend_payments (
  id bigint generated always as identity primary key,
  dividend_id bigint not null references public.dividends (id) on delete restrict,
  account_id uuid not null references public.investor_accounts (user_id) on delete restrict,
  shares bigint not null check (shares > 0),
  amount bigint not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (dividend_id, account_id)
);

create index dividend_payments_account_idx on public.dividend_payments (account_id);

alter table public.dividend_payments enable row level security;
create policy "an investor reads their own dividends" on public.dividend_payments
  for select to authenticated using (account_id = auth.uid() or public.is_admin());

-- 3. Offres d'émission ; titres créés par une augmentation de capital.
alter table public.market_offers
  add column kind text not null default 'sale' check (kind in ('sale', 'issue'));

alter table public.security_operations drop constraint security_operations_kind_check;
alter table public.security_operations add constraint security_operations_kind_check check (
  kind in ('introduction', 'split', 'reverse_split', 'suspension', 'resumption', 'withdrawal',
           'capital_increase')
);
alter table public.security_operations drop constraint security_operations_check;
alter table public.security_operations add constraint security_operations_check
  check ((kind in ('introduction', 'capital_increase')) = (shares is not null));

alter table public.share_issues drop constraint share_issues_reason_check;
alter table public.share_issues add constraint share_issues_reason_check
  check (reason in ('endowment', 'split', 'reverse_split', 'capital_increase'));

-- 4. Politique en vigueur : la dernière décidée ; « rien du tout » sans décision.
create function public.dividend_policy(p_company bigint) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((
    select policy from public.dividend_policies
    where company_id = p_company
    order by decided_on desc, id desc
    limit 1
  ), 'none');
$$;

-- 5. Qui reçoit un dividende : les investisseurs qui détiennent des titres (la corporation ne
-- se paie pas elle-même ses titres non vendus).
create function public.dividend_holders(p_company bigint)
returns table (account_id uuid, held bigint)
language sql stable security definer set search_path = public as $$
  select h.account_id, sum(h.quantity)::bigint
  from (
    select account_id, quantity from public.share_issues where company_id = p_company
    union all
    select account_id, case side when 'buy' then quantity else -quantity end
    from public.market_trades where company_id = p_company
  ) h
  join public.investor_accounts a on a.user_id = h.account_id
  where a.company_profile_id is null
  group by h.account_id
  having sum(h.quantity) > 0;
$$;

-- 6. Solde : dividendes reçus ; versés et annoncés pour une corporation.
create or replace function public.account_cash(p_account uuid)
returns table (balance bigint, pending bigint, reserved bigint, available bigint)
language sql stable security definer set search_path = public as $$
  with m as (
    select
      coalesce(sum(case when kind = 'deposit' and status = 'done' then amount end), 0)
        - coalesce(sum(case when kind = 'withdrawal' and status = 'done' then amount end), 0)
        as balance,
      coalesce(sum(case when kind = 'withdrawal' and status = 'requested' then amount end), 0)
        as pending
    from public.cash_movements
    where account_id = p_account
  ), t as (
    select coalesce(sum(
      case side when 'buy' then -(amount + commission) else amount - commission end
    ), 0) as flow
    from public.market_trades
    where account_id = p_account
  ), o as (
    select
      coalesce(sum(case when status = 'open' and side = 'buy' then reserved end), 0) as reserved,
      coalesce(sum(fees_paid), 0) as fees
    from public.market_orders
    where account_id = p_account
  ), d as (
    select
      coalesce((select sum(amount) from public.dividend_payments
                where account_id = p_account), 0) as received,
      coalesce((select sum(total) from public.dividends
                where account_id = p_account and status = 'paid'), 0) as paid,
      coalesce((select sum(total) from public.dividends
                where account_id = p_account and status = 'declared'), 0) as declared
  )
  select
    (m.balance + t.flow - o.fees + d.received - d.paid)::bigint,
    m.pending::bigint,
    (o.reserved + d.declared)::bigint,
    (m.balance + t.flow - o.fees + d.received - d.paid - m.pending - o.reserved - d.declared)::bigint
  from m, t, o, d;
$$;

-- 7. Nombre de titres d'une vie : les augmentations de capital s'ajoutent.
create or replace function public.listing_shares(p_company bigint) returns bigint
language plpgsql stable security definer set search_path = public as $$
declare
  v_shares bigint := null;
  r record;
begin
  for r in
    select kind, shares, ratio from public.security_operations
    where company_id = p_company
    order by occurred_on, id
  loop
    if r.kind = 'introduction' then
      v_shares := r.shares;
    elsif r.kind = 'split' and v_shares is not null then
      v_shares := v_shares * r.ratio;
    elsif r.kind = 'reverse_split' and v_shares is not null then
      v_shares := v_shares / r.ratio;
    elsif r.kind = 'capital_increase' and v_shares is not null then
      v_shares := v_shares + r.shares;
    end if;
  end loop;
  return v_shares;
end;
$$;

-- 8. Opérations sur titres : une augmentation de capital ne s'inscrit qu'à la clôture d'une
-- offre d'émission (elle crée des titres détenus) ; une division attend aussi qu'un dividende
-- annoncé soit versé.
create or replace function public.apply_share_operation() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if new.kind = 'capital_increase' then
    if coalesce(current_setting('knx.closing', true), '') <> 'on' then
      raise exception 'une augmentation de capital s''inscrit à la clôture d''une offre d''émission, depuis la page Séance';
    end if;
    return new;
  end if;
  if new.kind not in ('split', 'reverse_split') then
    return new;
  end if;
  if exists (select 1 from public.market_orders where company_id = new.company_id and status = 'open')
     or exists (select 1 from public.market_offers where company_id = new.company_id and status = 'open')
     or exists (select 1 from public.dividends where company_id = new.company_id and status = 'declared') then
    raise exception 'des ordres, une offre ou un dividende attendent la séance sur ce titre : divisez ou regroupez après la clôture';
  end if;
  for r in
    select account_id, sum(quantity) as held from (
      select account_id, quantity from public.share_issues where company_id = new.company_id
      union all
      select account_id, case side when 'buy' then quantity else -quantity end
      from public.market_trades where company_id = new.company_id
    ) h
    group by account_id
    having sum(quantity) <> 0
  loop
    if new.kind = 'split' then
      insert into public.share_issues (company_id, account_id, quantity, reason, operation_id)
      values (new.company_id, r.account_id, r.held * (new.ratio - 1), 'split', new.id);
    else
      if r.held % new.ratio <> 0 then
        raise exception 'regroupement impossible : un détenteur a % titres, non divisibles par %', r.held, new.ratio;
      end if;
      insert into public.share_issues (company_id, account_id, quantity, reason, operation_id)
      values (new.company_id, r.account_id, r.held / new.ratio - r.held, 'reverse_split', new.id);
    end if;
  end loop;
  return new;
end;
$$;

-- Les titres d'une augmentation de capital ont été vendus : elle ne se retire ni ne se modifie
-- (sa note exceptée), et aucune opération ne le devient après coup.
create function public.keep_capital_increase() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.kind = 'capital_increase' and old.kind <> 'capital_increase' then
    raise exception 'une augmentation de capital s''inscrit à la clôture d''une offre d''émission, depuis la page Séance';
  end if;
  if old.kind = 'capital_increase' then
    if tg_op = 'DELETE' then
      raise exception 'une augmentation de capital ne se retire pas : ses titres sont détenus par des investisseurs';
    end if;
    if new.kind is distinct from old.kind or new.shares is distinct from old.shares
       or new.company_id <> old.company_id or new.occurred_on <> old.occurred_on then
      raise exception 'une augmentation de capital ne se modifie pas : seule sa note peut changer';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger security_operations_keep_capital_increase
  before update or delete on public.security_operations
  for each row execute function public.keep_capital_increase();

-- 9. Offre d'une corporation : vente de titres qu'elle détient, ou émission de titres nouveaux.
drop function public.create_offer(bigint, bigint, numeric, text);
create function public.create_offer(
  p_company bigint, p_shares bigint, p_price numeric, p_note text default null,
  p_kind text default 'sale'
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_account uuid;
  v_session bigint;
  v_total bigint;
  v_most bigint;
  v_held bigint;
  v_offered bigint;
  v_id bigint;
begin
  if not public.is_admin() then
    raise exception 'réservé aux opérateurs' using errcode = '42501';
  end if;
  if p_kind not in ('sale', 'issue') then
    raise exception 'offre de vente ou d''émission';
  end if;
  select a.user_id into v_account
  from public.investor_accounts a
  join public.companies c on c.profile_id = a.company_profile_id
  where c.id = p_company and a.closed_at is null;
  if v_account is null then
    raise exception 'aucun compte de corporation pour ce titre : créez-le d''abord';
  end if;
  select id into v_session from public.market_sessions where status = 'open';
  if v_session is null then
    raise exception 'aucune séance ouverte';
  end if;
  if coalesce(public.listing_state(p_company), '') <> 'listed' then
    raise exception 'ce titre n''est pas coté, ou sa cotation est suspendue';
  end if;
  if p_price is null or p_price <= 0 or p_price <> round(p_price, 2) then
    raise exception 'prix d''offre positif, au centième près';
  end if;
  v_total := public.listing_shares(p_company);
  if not exists (select 1 from public.share_issues where company_id = p_company) then
    insert into public.share_issues (company_id, account_id, quantity, reason)
    values (p_company, v_account, v_total, 'endowment');
  end if;
  v_most := floor(public.market_param('maxOffer', 0.49) * v_total);
  if p_shares is null or p_shares < 1 or p_shares > v_most then
    raise exception 'offre de 1 titre au plus % (part maximale d''une offre)', v_most;
  end if;
  if p_kind = 'sale' then
    select held into v_held from public.account_shares(v_account, p_company);
    select coalesce(sum(shares_offered), 0) into v_offered
    from public.market_offers where company_id = p_company and status = 'open' and kind = 'sale';
    if p_shares > v_held - v_offered then
      raise exception 'la corporation ne détient que % titres libres', v_held - v_offered;
    end if;
  else
    if exists (select 1 from public.market_offers
               where company_id = p_company and status = 'open' and kind = 'issue') then
      raise exception 'une offre d''émission est déjà ouverte sur ce titre';
    end if;
    if v_total + p_shares > 1000000000000 then
      raise exception 'trop de titres après l''émission';
    end if;
  end if;
  insert into public.market_offers (company_id, account_id, session_id, shares_offered, price, note, kind)
  values (p_company, v_account, v_session, p_shares, p_price, nullif(btrim(p_note), ''), p_kind)
  returning id into v_id;
  return v_id;
end;
$$;

-- 10. Annonce d'un dividende dans la séance ouverte : un par titre et par séance, pour une
-- corporation qui distribue, couvert par ses crédits disponibles.
create function public.declare_dividend(
  p_company bigint, p_per_share numeric, p_note text default null
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_account uuid;
  v_session bigint;
  v_policy text;
  v_shares bigint;
  v_total bigint;
  v_available bigint;
  v_id bigint;
begin
  if not public.is_admin() then
    raise exception 'réservé aux opérateurs' using errcode = '42501';
  end if;
  select a.user_id into v_account
  from public.investor_accounts a
  join public.companies c on c.profile_id = a.company_profile_id
  where c.id = p_company and a.closed_at is null;
  if v_account is null then
    raise exception 'aucun compte de corporation pour ce titre : créez-le d''abord';
  end if;
  perform 1 from public.investor_accounts where user_id = v_account for update;
  select id into v_session from public.market_sessions where status = 'open';
  if v_session is null then
    raise exception 'aucune séance ouverte';
  end if;
  if coalesce(public.listing_state(p_company), '') not in ('listed', 'suspended') then
    raise exception 'ce titre n''est pas coté';
  end if;
  v_policy := public.dividend_policy(p_company);
  if v_policy not in ('distributing', 'other') then
    raise exception 'la politique de la corporation ne prévoit pas de dividende : changez-la d''abord';
  end if;
  if p_per_share is null or p_per_share <= 0 or p_per_share <> round(p_per_share, 2) then
    raise exception 'dividende par titre positif, au centième près';
  end if;
  if exists (select 1 from public.dividends
             where company_id = p_company and session_id = v_session and status = 'declared') then
    raise exception 'un dividende est déjà annoncé sur ce titre pour cette séance';
  end if;
  select coalesce(sum(held), 0), coalesce(sum(floor(held * p_per_share)), 0)
  into v_shares, v_total
  from public.dividend_holders(p_company);
  if v_shares = 0 then
    raise exception 'aucun investisseur ne détient de titres de cette corporation';
  end if;
  if v_total = 0 then
    raise exception 'dividende trop faible : aucun détenteur ne recevrait un crédit';
  end if;
  select available into v_available from public.account_cash(v_account);
  if v_total > v_available then
    raise exception 'ce dividende coûte % crédits ; la corporation n''en a que % de disponibles',
      v_total, v_available;
  end if;
  insert into public.dividends (company_id, account_id, session_id, per_share, shares, total, note)
  values (p_company, v_account, v_session, p_per_share, v_shares, v_total, nullif(btrim(p_note), ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- 11. Retrait d'un dividende annoncé, avant la clôture : ses crédits sont libérés.
create function public.cancel_dividend(p_id bigint, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'réservé aux opérateurs' using errcode = '42501';
  end if;
  update public.dividends
  set status = 'cancelled', closed_at = now(),
      reason = coalesce(nullif(btrim(p_reason), ''), 'retiré par la corporation')
  where id = p_id and status = 'declared';
  if not found then
    raise exception 'dividende introuvable ou déjà versé';
  end if;
end;
$$;

-- 12. Clôture : dividendes, puis offres (les émissions créent leurs titres), puis enchère entre
-- joueurs titre par titre, puis report.
-- p_prices : [{ company_id, shares, reference }] (cours KNX par titre, pour départager).
-- p_params : { commission, carry_fee, … } en vigueur.
create or replace function public.close_session(
  p_session bigint, p_report date, p_prices jsonb, p_params jsonb
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_session public.market_sessions;
  v_commission numeric := coalesce((p_params ->> 'commission')::numeric, 0.01);
  v_carry_fee numeric := coalesce((p_params ->> 'carry_fee')::numeric, 0.002);
  d public.dividends;
  o public.market_offers;
  r public.market_orders;
  v_company bigint;
  v_total bigint;
  v_left bigint;
  v_quantity bigint;
  v_amount bigint;
  v_fee bigint;
  v_sum bigint;
  v_free bigint;
  v_corp_fee bigint;
  v_shares bigint;
  v_op bigint;
  v_reference numeric;
  v_candidate numeric;
  v_price numeric;
  v_best_volume bigint;
  v_best_gap bigint;
  v_best_demand bigint;
  v_best_supply bigint;
  v_demand bigint;
  v_supply bigint;
  v_volume bigint;
  v_buy_left bigint;
  v_sell_left bigint;
  v_reason text;
  v_carried bigint[] := '{}';
  v_prices jsonb := '[]'::jsonb;
  v_next bigint;
  c record;
begin
  if not public.is_admin() then
    raise exception 'réservé aux opérateurs' using errcode = '42501';
  end if;
  select * into v_session from public.market_sessions where id = p_session for update;
  if not found or v_session.status <> 'open' then
    raise exception 'séance introuvable ou déjà close';
  end if;
  if p_report < v_session.opened_on then
    raise exception 'relevé de clôture antérieur à l''ouverture de la séance';
  end if;
  if jsonb_typeof(p_prices) <> 'array' then
    raise exception 'cours de référence mal formés';
  end if;
  -- Lets this close record the capital increases of its issue offers.
  perform set_config('knx.closing', 'on', true);

  -- 0. Dividends: paid to the holders before any share changes hands.
  for d in
    select * from public.dividends where session_id = p_session and status = 'declared'
    order by id for update
  loop
    select coalesce(sum(held), 0), coalesce(sum(floor(held * d.per_share)), 0)
    into v_shares, v_total
    from public.dividend_holders(d.company_id);
    -- The dividend's own reservation counts as available to pay it.
    select available + d.total into v_free from public.account_cash(d.account_id);
    if v_total = 0 then
      update public.dividends
      set status = 'cancelled', closed_at = now(), reason = 'plus aucun détenteur à la clôture'
      where id = d.id;
      continue;
    end if;
    if v_total > v_free then
      update public.dividends
      set status = 'cancelled', closed_at = now(),
          reason = 'crédits de la corporation insuffisants à la clôture'
      where id = d.id;
      continue;
    end if;
    insert into public.dividend_payments (dividend_id, account_id, shares, amount)
    select d.id, h.account_id, h.held, floor(h.held * d.per_share)::bigint
    from public.dividend_holders(d.company_id) h
    where floor(h.held * d.per_share) > 0;
    update public.dividends
    set status = 'paid', shares = v_shares, total = v_total, paid_on = p_report, closed_at = now()
    where id = d.id;
  end loop;

  -- A. Offers: every subscriber served, pro rata when the offer is exceeded.
  for o in
    select * from public.market_offers where session_id = p_session and status = 'open'
    order by id for update
  loop
    select coalesce(sum(quantity), 0) into v_total
    from public.market_orders where offer_id = o.id and status = 'open';
    v_left := least(v_total, o.shares_offered);
    v_sum := 0;
    for r in
      select * from public.market_orders where offer_id = o.id and status = 'open'
      order by created_at, id for update
    loop
      if v_total <= o.shares_offered then
        v_quantity := r.quantity;
      else
        v_quantity := floor(r.quantity::numeric * o.shares_offered / v_total);
      end if;
      v_quantity := least(v_quantity, v_left);
      if v_quantity > 0 then
        v_amount := round(v_quantity * o.price)::bigint;
        v_fee := ceil(v_amount * v_commission)::bigint;
        insert into public.market_trades
          (session_id, order_id, offer_id, account_id, company_id, side, quantity, price, amount, commission)
        values (p_session, r.id, o.id, r.account_id, r.company_id, 'buy', v_quantity, o.price, v_amount, v_fee);
        v_sum := v_sum + v_amount;
        v_left := v_left - v_quantity;
      end if;
      update public.market_orders
      set status = case when v_quantity = r.quantity then 'filled' when v_quantity > 0 then 'partial' else 'expired' end,
          filled_quantity = v_quantity, fill_price = case when v_quantity > 0 then o.price end,
          closed_at = now(),
          reason = case when v_quantity < r.quantity then 'offre dépassée : servi au prorata' end
      where id = r.id;
    end loop;
    -- Shares left by the rounding down go to the earliest subscriptions, one each.
    for r in
      select * from public.market_orders
      where offer_id = o.id and status in ('partial', 'expired') and filled_quantity < quantity
      order by created_at, id
    loop
      exit when v_left <= 0;
      v_amount := round(o.price)::bigint;
      v_fee := ceil(v_amount * v_commission)::bigint;
      insert into public.market_trades
        (session_id, order_id, offer_id, account_id, company_id, side, quantity, price, amount, commission)
      values (p_session, r.id, o.id, r.account_id, r.company_id, 'buy', 1, o.price, v_amount, v_fee);
      update public.market_orders
      set filled_quantity = filled_quantity + 1, fill_price = o.price,
          status = case when filled_quantity + 1 = quantity then 'filled' else 'partial' end
      where id = r.id;
      v_sum := v_sum + v_amount;
      v_left := v_left - 1;
    end loop;
    v_quantity := least(v_total, o.shares_offered);
    -- An issue creates the shares it sold, to the corporation, which then sells them.
    if v_quantity > 0 and o.kind = 'issue' then
      insert into public.security_operations (company_id, occurred_on, kind, shares, note)
      values (o.company_id, p_report, 'capital_increase', v_quantity,
              'Offre d''émission n° ' || o.id || coalesce(' — ' || o.note, ''))
      returning id into v_op;
      insert into public.share_issues (company_id, account_id, quantity, reason, operation_id)
      values (o.company_id, o.account_id, v_quantity, 'capital_increase', v_op);
    end if;
    -- The corporation's side: one sale for the whole offer, commission on the proceeds.
    v_corp_fee := 0;
    if v_quantity > 0 then
      v_corp_fee := ceil(v_sum * v_commission)::bigint;
      insert into public.market_trades
        (session_id, order_id, offer_id, account_id, company_id, side, quantity, price, amount, commission)
      values (p_session, null, o.id, o.account_id, o.company_id, 'sell', v_quantity, o.price, v_sum, v_corp_fee);
    end if;
    update public.market_offers
    set status = 'closed', closed_at = now(), allocated = v_quantity, proceeds = v_sum - v_corp_fee
    where id = o.id;
  end loop;

  -- B. Secondary market: one auction per corporation with open orders.
  for c in
    select distinct company_id from public.market_orders
    where session_id = p_session and status = 'open' and offer_id is null
  loop
    v_company := c.company_id;
    select (e ->> 'reference')::numeric into v_reference
    from jsonb_array_elements(p_prices) e
    where (e ->> 'company_id')::bigint = v_company
    limit 1;

    if coalesce(public.listing_state(v_company), '') <> 'listed' then
      update public.market_orders
      set status = 'expired', closed_at = now(), reason = 'titre non coté ou cotation suspendue'
      where session_id = p_session and company_id = v_company and status = 'open' and offer_id is null;
      continue;
    end if;

    -- The price that meets the most shares; then the least imbalance; then the nearest to the
    -- KNX price; then the lower.
    v_price := null;
    v_best_volume := 0;
    v_best_gap := null;
    for v_candidate in
      select distinct limit_price from public.market_orders
      where session_id = p_session and company_id = v_company and status = 'open' and offer_id is null
    loop
      select
        coalesce(sum(case when side = 'buy' and limit_price >= v_candidate then quantity end), 0),
        coalesce(sum(case when side = 'sell' and limit_price <= v_candidate then quantity end), 0)
      into v_demand, v_supply
      from public.market_orders
      where session_id = p_session and company_id = v_company and status = 'open' and offer_id is null;
      v_volume := least(v_demand, v_supply);
      if v_volume > v_best_volume
         or (v_volume = v_best_volume and v_volume > 0 and (
              abs(v_demand - v_supply) < v_best_gap
              or (abs(v_demand - v_supply) = v_best_gap and (
                   abs(v_candidate - coalesce(v_reference, v_candidate))
                     < abs(v_price - coalesce(v_reference, v_price))
                   or (abs(v_candidate - coalesce(v_reference, v_candidate))
                         = abs(v_price - coalesce(v_reference, v_price))
                       and v_candidate < v_price)))))
      then
        v_price := v_candidate;
        v_best_volume := v_volume;
        v_best_gap := abs(v_demand - v_supply);
        v_best_demand := v_demand;
        v_best_supply := v_supply;
      end if;
    end loop;

    if v_best_volume > 0 then
      v_buy_left := v_best_volume;
      v_sell_left := v_best_volume;
      for r in
        select * from public.market_orders
        where session_id = p_session and company_id = v_company and status = 'open' and offer_id is null
          and ((side = 'buy' and limit_price >= v_price) or (side = 'sell' and limit_price <= v_price))
        order by side,
                 case when side = 'buy' then -limit_price else limit_price end,
                 created_at, id
        for update
      loop
        if r.side = 'buy' then
          v_quantity := least(r.quantity, v_buy_left);
          v_buy_left := v_buy_left - v_quantity;
        else
          v_quantity := least(r.quantity, v_sell_left);
          v_sell_left := v_sell_left - v_quantity;
        end if;
        if v_quantity <= 0 then
          continue;
        end if;
        v_amount := round(v_quantity * v_price)::bigint;
        v_fee := ceil(v_amount * v_commission)::bigint;
        if r.side = 'buy' then
          select available + r.reserved into v_free from public.account_cash(r.account_id);
          if v_amount + v_fee > v_free then
            raise exception 'clôture interrompue : l''ordre % ne couvre plus son achat', r.id;
          end if;
        else
          select held into v_free from public.account_shares(r.account_id, v_company);
          if v_free < v_quantity then
            raise exception 'clôture interrompue : l''ordre % ne couvre plus sa vente', r.id;
          end if;
        end if;
        insert into public.market_trades
          (session_id, order_id, account_id, company_id, side, quantity, price, amount, commission)
        values (p_session, r.id, r.account_id, v_company, r.side, v_quantity, v_price, v_amount, v_fee);
        update public.market_orders
        set status = case when v_quantity = r.quantity then 'filled' else 'partial' end,
            filled_quantity = v_quantity, fill_price = v_price, closed_at = now(),
            reason = case when v_quantity < r.quantity then 'contrepartie insuffisante à ce prix' end
        where id = r.id;
      end loop;
      v_prices := v_prices || jsonb_build_object(
        'company_id', v_company,
        'shares', coalesce(public.listing_shares(v_company), 0),
        'reference', v_reference,
        'premium', case when coalesce(v_reference, 0) > 0 then v_price / v_reference - 1 else 0 end,
        'price', v_price,
        'buy', v_price,
        'sell', v_price,
        'demand', v_best_demand,
        'supply', v_best_supply,
        'volume', v_best_volume
      );
    end if;

    -- Orders left open: carried while they have sessions and the fee is covered, else expired.
    for r in
      select * from public.market_orders
      where session_id = p_session and company_id = v_company and status = 'open' and offer_id is null
      order by created_at, id for update
    loop
      v_reason := case when v_best_volume > 0 then 'aucune contrepartie à votre limite au prix de la séance'
                       else 'aucune contrepartie à votre limite' end;
      if r.sessions_left > 1 then
        v_fee := greatest(1, ceil(r.quantity * r.limit_price * v_carry_fee))::bigint;
        select available into v_free from public.account_cash(r.account_id);
        if v_fee <= v_free then
          update public.market_orders
          set sessions_left = sessions_left - 1, fees_paid = fees_paid + v_fee,
              reason = 'reporté : ' || v_reason
          where id = r.id;
          v_carried := v_carried || r.id;
          continue;
        end if;
        v_reason := v_reason || ' ; frais de report non couverts';
      end if;
      update public.market_orders
      set status = 'expired', closed_at = now(), reason = v_reason
      where id = r.id;
    end loop;
  end loop;

  update public.market_sessions
  set status = 'closed', closed_on = p_report, report_date = p_report, prices = v_prices,
      params = p_params, closed_at = now(), closed_by = auth.uid()
  where id = p_session;
  insert into public.market_sessions (opened_on) values (p_report) returning id into v_next;
  update public.market_orders set session_id = v_next where id = any (v_carried);
  return v_next;
end;
$$;

revoke all on function public.dividend_policy from public, anon, authenticated;
revoke all on function public.dividend_holders from public, anon, authenticated;
revoke all on function public.keep_capital_increase from public, anon, authenticated;
revoke all on function public.create_offer from public, anon;
revoke all on function public.declare_dividend from public, anon;
revoke all on function public.cancel_dividend from public, anon;
grant execute on function public.create_offer to authenticated;
grant execute on function public.declare_dividend to authenticated;
grant execute on function public.cancel_dividend to authenticated;
