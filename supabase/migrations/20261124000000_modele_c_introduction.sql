-- KNX — modèle C, phase 1 : la corporation dans la boucle.
-- À exécuter après 20261123000000_report_ordres_classement.sql.
--
-- 1. Comptes de corporation : un compte investisseur rattaché à une fiche, tenu par son DG.
-- 2. Titres réels : chaque titre appartient à un compte. À sa première offre, la corporation
--    reçoit tous ses titres (share_issues) ; une division ou un regroupement ajuste ensuite chaque
--    détenteur.
-- 3. Offres : la corporation met en vente une partie de ses titres à un prix fixé ; les
--    investisseurs souscrivent pendant la séance ; à la clôture, chacun est servi, au prorata si
--    l'offre est dépassée, et le produit (moins la commission) va au compte de la corporation.
-- 4. Marché secondaire entre joueurs : à chaque clôture, une enchère par titre fixe le prix qui
--    fait se rencontrer le plus de titres ; la Banque impériale n'est plus contrepartie de rien.
--    Le calcul se fait ici, en base ; le site ne transmet que le cours KNX de chaque titre, qui
--    départage deux prix également bons.

-- 1. Comptes de corporation.
alter table public.investor_accounts
  add column company_profile_id bigint unique
    references public.company_profiles (id) on delete restrict;

-- 2. Offres de titres par une corporation.
create table public.market_offers (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.companies (id) on delete restrict,
  account_id uuid not null references public.investor_accounts (user_id) on delete restrict,
  session_id bigint not null references public.market_sessions (id) on delete restrict,
  shares_offered bigint not null check (shares_offered > 0),
  price numeric(14, 2) not null check (price > 0),
  status text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  allocated bigint not null default 0 check (allocated >= 0),
  proceeds bigint not null default 0,
  note text,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create index market_offers_session_idx on public.market_offers (session_id, status);

alter table public.market_offers enable row level security;
create policy "offers are public" on public.market_offers
  for select to anon, authenticated using (true);

-- 3. Titres émis à un compte : la dotation de la corporation, puis les ajustements de division.
create table public.share_issues (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.companies (id) on delete restrict,
  account_id uuid not null references public.investor_accounts (user_id) on delete restrict,
  quantity bigint not null check (quantity <> 0),
  reason text not null check (reason in ('endowment', 'split', 'reverse_split')),
  -- Une division retirée retire ses ajustements.
  operation_id bigint references public.security_operations (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index share_issues_holding_idx on public.share_issues (company_id, account_id);

alter table public.share_issues enable row level security;
create policy "an investor reads their own issues" on public.share_issues
  for select to authenticated using (account_id = auth.uid() or public.is_admin());

-- 4. Souscriptions : des ordres d'achat rattachés à une offre. Côté corporation, une exécution
-- d'offre n'a pas d'ordre : elle porte l'offre.
alter table public.market_orders
  add column offer_id bigint references public.market_offers (id) on delete restrict;
alter table public.market_trades
  alter column order_id drop not null,
  add column offer_id bigint references public.market_offers (id) on delete restrict;

-- 5. Titres d'un compte : émis plus échangés, et retenus par ses ventes ouvertes.
create or replace function public.account_shares(p_account uuid, p_company bigint)
returns table (held bigint, reserved bigint)
language sql stable security definer set search_path = public as $$
  select
    (
      coalesce((select sum(quantity) from public.share_issues
                where account_id = p_account and company_id = p_company), 0)
      + coalesce((select sum(case side when 'buy' then quantity else -quantity end)
                  from public.market_trades
                  where account_id = p_account and company_id = p_company), 0)
    )::bigint,
    coalesce((
      select sum(quantity)
      from public.market_orders
      where account_id = p_account and company_id = p_company
        and status = 'open' and side = 'sell'
    ), 0)::bigint;
$$;

-- 6. Nombre de titres d'une vie aujourd'hui : introduction, divisions, regroupements.
create function public.listing_shares(p_company bigint) returns bigint
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
    end if;
  end loop;
  return v_shares;
end;
$$;

-- 7. Une division ou un regroupement ajuste chaque détenteur. Refusé tant que des ordres ou une
-- offre attendent la séance : ils sont exprimés dans l'ancien nombre de titres.
create function public.apply_share_operation() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if new.kind not in ('split', 'reverse_split') then
    return new;
  end if;
  if exists (select 1 from public.market_orders where company_id = new.company_id and status = 'open')
     or exists (select 1 from public.market_offers where company_id = new.company_id and status = 'open') then
    raise exception 'des ordres ou une offre attendent la séance sur ce titre : divisez ou regroupez après la clôture';
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

create trigger security_operations_apply_shares
  after insert on public.security_operations
  for each row execute function public.apply_share_operation();

-- 8. Ordre sur le marché secondaire : un compte de corporation ne trade pas (ses titres passent
-- par des offres).
create or replace function public.place_order(
  p_company bigint, p_side text, p_quantity integer, p_limit numeric, p_sessions integer default 1
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_account public.investor_accounts;
  v_session bigint;
  v_profile bigint;
  v_amount bigint;
  v_reserved bigint := 0;
  v_available bigint;
  v_held bigint;
  v_held_reserved bigint;
  v_id bigint;
begin
  select * into v_account from public.investor_accounts
  where user_id = auth.uid() and closed_at is null
  for update;
  if not found then
    raise exception 'compte investisseur introuvable ou fermé';
  end if;
  if v_account.company_profile_id is not null then
    raise exception 'un compte de corporation vend ses titres par des offres, pas par des ordres';
  end if;
  if v_account.must_change_password then
    raise exception 'changez d''abord votre mot de passe temporaire';
  end if;
  if p_side not in ('buy', 'sell') then
    raise exception 'sens d''ordre inconnu';
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
  select profile_id into v_profile from public.companies where id = p_company;
  if v_profile = any (v_account.insider_of) then
    raise exception 'ordre refusé : vous êtes déclaré initié de cette corporation';
  end if;

  if p_side = 'buy' then
    v_amount := round(p_quantity * p_limit)::bigint;
    v_reserved := v_amount + ceil(v_amount * public.market_param('commission', 0.01))::bigint;
    select available into v_available from public.account_cash(v_account.user_id);
    if v_reserved > v_available then
      raise exception 'crédits disponibles insuffisants pour cet ordre';
    end if;
  else
    select held, reserved into v_held, v_held_reserved
    from public.account_shares(v_account.user_id, p_company);
    if p_quantity > v_held - v_held_reserved then
      raise exception 'vous ne détenez pas assez de titres libres';
    end if;
  end if;

  insert into public.market_orders
    (session_id, account_id, company_id, side, quantity, limit_price, reserved, sessions_left)
  values (v_session, v_account.user_id, p_company, p_side, p_quantity, p_limit, v_reserved, p_sessions)
  returning id into v_id;
  return v_id;
end;
$$;

-- 9. Offre d'une corporation, ouverte dans la séance en cours. À la première offre, la
-- corporation reçoit tous ses titres.
create function public.create_offer(
  p_company bigint, p_shares bigint, p_price numeric, p_note text default null
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_account uuid;
  v_session bigint;
  v_total bigint;
  v_held bigint;
  v_offered bigint;
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
  if p_shares is null or p_shares < 1
     or p_shares > floor(public.market_param('maxOffer', 0.49) * v_total) then
    raise exception 'offre de 1 titre au plus % (part maximale d''une offre)',
      floor(public.market_param('maxOffer', 0.49) * v_total);
  end if;
  select held into v_held from public.account_shares(v_account, p_company);
  select coalesce(sum(shares_offered), 0) into v_offered
  from public.market_offers where company_id = p_company and status = 'open';
  if p_shares > v_held - v_offered then
    raise exception 'la corporation ne détient que % titres libres', v_held - v_offered;
  end if;
  insert into public.market_offers (company_id, account_id, session_id, shares_offered, price, note)
  values (p_company, v_account, v_session, p_shares, p_price, nullif(btrim(p_note), ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- 10. Retrait d'une offre avant la clôture : ses souscriptions sont annulées.
create function public.cancel_offer(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'réservé aux opérateurs' using errcode = '42501';
  end if;
  update public.market_offers set status = 'cancelled', closed_at = now()
  where id = p_id and status = 'open';
  if not found then
    raise exception 'offre introuvable ou déjà close';
  end if;
  update public.market_orders
  set status = 'cancelled', closed_at = now(), reason = 'offre retirée par la corporation'
  where offer_id = p_id and status = 'open';
end;
$$;

-- 11. Souscription d'un investisseur à une offre ouverte, au prix de l'offre.
create function public.subscribe(p_offer bigint, p_quantity integer) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_account public.investor_accounts;
  v_offer public.market_offers;
  v_profile bigint;
  v_amount bigint;
  v_reserved bigint;
  v_available bigint;
  v_id bigint;
begin
  select * into v_account from public.investor_accounts
  where user_id = auth.uid() and closed_at is null
  for update;
  if not found then
    raise exception 'compte investisseur introuvable ou fermé';
  end if;
  if v_account.company_profile_id is not null then
    raise exception 'un compte de corporation ne souscrit pas';
  end if;
  if v_account.must_change_password then
    raise exception 'changez d''abord votre mot de passe temporaire';
  end if;
  select * into v_offer from public.market_offers where id = p_offer and status = 'open';
  if not found then
    raise exception 'offre introuvable ou close';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > v_offer.shares_offered then
    raise exception 'de 1 à % titres', v_offer.shares_offered;
  end if;
  select profile_id into v_profile from public.companies where id = v_offer.company_id;
  if v_profile = any (v_account.insider_of) then
    raise exception 'souscription refusée : vous êtes déclaré initié de cette corporation';
  end if;
  v_amount := round(p_quantity * v_offer.price)::bigint;
  v_reserved := v_amount + ceil(v_amount * public.market_param('commission', 0.01))::bigint;
  select available into v_available from public.account_cash(v_account.user_id);
  if v_reserved > v_available then
    raise exception 'crédits disponibles insuffisants pour cette souscription';
  end if;
  insert into public.market_orders
    (session_id, account_id, company_id, side, quantity, limit_price, reserved, offer_id)
  values (v_offer.session_id, v_account.user_id, v_offer.company_id, 'buy', p_quantity,
          v_offer.price, v_reserved, v_offer.id)
  returning id into v_id;
  return v_id;
end;
$$;

-- 12. Clôture : offres au prorata, puis enchère entre joueurs titre par titre, puis report.
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
    -- The corporation's side: one sale for the whole offer, commission on the proceeds.
    v_quantity := least(v_total, o.shares_offered);
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

-- 13. Classement : titres émis compris (divisions), comptes de corporation exclus.
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
  where a.public_ranking and a.closed_at is null and a.company_profile_id is null;
$$;

revoke all on function public.listing_shares from public, anon, authenticated;
revoke all on function public.apply_share_operation from public, anon, authenticated;
revoke all on function public.account_shares from public, anon, authenticated;
revoke all on function public.create_offer from public, anon;
revoke all on function public.cancel_offer from public, anon;
revoke all on function public.subscribe from public, anon;
grant execute on function public.create_offer to authenticated;
grant execute on function public.cancel_offer to authenticated;
grant execute on function public.subscribe to authenticated;
