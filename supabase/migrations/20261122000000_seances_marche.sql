-- KNX — marché B, phase 2 : séances, ordres, exécutions, initiés.
-- À exécuter après 20261121000000_comptes_investisseurs.sql.
--
-- Une séance dure une heptade. Les joueurs y passent des ordres à cours limité ; à la clôture,
-- l'opérateur fait fixer par KNX un prix par corporation cotée (le site le calcule à partir de la
-- valeur KNX et des ordres, et le transmet), et la Banque impériale, teneur de marché, sert chaque
-- ordre compatible dans la limite des plafonds de détention. Tout s'exécute dans une seule
-- transaction : un ordre est servi en entier, en partie, ou pas du tout, jamais deux fois.
--
-- Aucun joueur n'écrit dans ces tables : ordres et annulations passent par des fonctions qui
-- vérifient le compte, la cotation, les initiés, les crédits et les titres disponibles.

-- 1. Initiés : un compte déclaré lié à une corporation (DG, employé) ne trade pas ses titres.
-- Fiches (company_profiles) plutôt que vies : le lien survit à une refondation.
alter table public.investor_accounts
  add column insider_of bigint[] not null default '{}';

-- 2. Séances. Une seule ouverte à la fois.
create table public.market_sessions (
  id bigint generated always as identity primary key,
  opened_on date not null,
  closed_on date,
  report_date date,
  status text not null default 'open' check (status in ('open', 'closed')),
  -- Prix fixés à la clôture : [{ company_id, shares, reference, premium, price, buy, sell,
  -- demand, supply }].
  prices jsonb not null default '[]'::jsonb check (jsonb_typeof(prices) = 'array'),
  -- Leviers en vigueur à la clôture (commission, plafonds…), figés pour l'historique.
  params jsonb,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references auth.users (id) on delete set null,
  check ((status = 'closed') = (closed_on is not null))
);

create unique index market_sessions_one_open on public.market_sessions ((true))
  where status = 'open';

alter table public.market_sessions enable row level security;
create policy "market sessions are public" on public.market_sessions
  for select to anon, authenticated using (true);

-- 3. Ordres.
create table public.market_orders (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.market_sessions (id) on delete restrict,
  account_id uuid not null references public.investor_accounts (user_id) on delete restrict,
  company_id bigint not null references public.companies (id) on delete restrict,
  side text not null check (side in ('buy', 'sell')),
  quantity integer not null check (quantity between 1 and 1000000000),
  limit_price numeric(14, 2) not null check (limit_price > 0),
  -- Crédits retenus par un ordre d'achat tant que la séance n'est pas close.
  reserved bigint not null default 0 check (reserved >= 0),
  status text not null default 'open'
    check (status in ('open', 'filled', 'partial', 'cancelled', 'expired', 'rejected')),
  filled_quantity integer not null default 0,
  fill_price numeric(14, 2),
  reason text,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  check (filled_quantity between 0 and quantity)
);

create index market_orders_session_idx on public.market_orders (session_id, status, created_at, id);
create index market_orders_account_idx on public.market_orders (account_id, created_at);

alter table public.market_orders enable row level security;
create policy "an investor reads their own orders" on public.market_orders
  for select to authenticated using (account_id = auth.uid() or public.is_admin());

-- 4. Exécutions : la contrepartie est toujours la Banque impériale.
create table public.market_trades (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.market_sessions (id) on delete restrict,
  order_id bigint not null references public.market_orders (id) on delete restrict,
  account_id uuid not null references public.investor_accounts (user_id) on delete restrict,
  company_id bigint not null references public.companies (id) on delete restrict,
  side text not null check (side in ('buy', 'sell')),
  quantity integer not null check (quantity > 0),
  price numeric(14, 2) not null check (price > 0),
  amount bigint not null check (amount >= 0),
  commission bigint not null check (commission >= 0),
  created_at timestamptz not null default now()
);

create index market_trades_account_idx on public.market_trades (account_id, company_id);
create index market_trades_company_idx on public.market_trades (company_id);

alter table public.market_trades enable row level security;
create policy "an investor reads their own trades" on public.market_trades
  for select to authenticated using (account_id = auth.uid() or public.is_admin());

-- 5. Solde d'un compte, ordres compris : dépôts et retraits réglés, achats et ventes exécutés,
-- retraits en attente et crédits retenus par les ordres d'achat ouverts.
drop function public.account_cash(uuid);
create function public.account_cash(p_account uuid)
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
    select coalesce(sum(reserved), 0) as reserved
    from public.market_orders
    where account_id = p_account and status = 'open' and side = 'buy'
  )
  select
    (m.balance + t.flow)::bigint,
    m.pending::bigint,
    o.reserved::bigint,
    (m.balance + t.flow - m.pending - o.reserved)::bigint
  from m, t, o;
$$;

-- 6. Titres d'un compte : détenus (exécutions) et retenus par ses ordres de vente ouverts.
create function public.account_shares(p_account uuid, p_company bigint)
returns table (held bigint, reserved bigint)
language sql stable security definer set search_path = public as $$
  select
    coalesce((
      select sum(case side when 'buy' then quantity else -quantity end)
      from public.market_trades
      where account_id = p_account and company_id = p_company
    ), 0)::bigint,
    coalesce((
      select sum(quantity)
      from public.market_orders
      where account_id = p_account and company_id = p_company
        and status = 'open' and side = 'sell'
    ), 0)::bigint;
$$;

-- 7. Où en sont les titres d'une vie : la même relecture que le site (securities.ts).
create function public.listing_state(p_company bigint) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_state text := null;
  r record;
begin
  if exists (select 1 from public.companies where id = p_company and closed_on is not null) then
    return 'closed';
  end if;
  for r in
    select kind from public.security_operations
    where company_id = p_company
    order by occurred_on, id
  loop
    if r.kind = 'introduction' and (v_state is null or v_state = 'withdrawn') then
      v_state := 'listed';
    elsif r.kind = 'suspension' and v_state = 'listed' then
      v_state := 'suspended';
    elsif r.kind = 'resumption' and v_state = 'suspended' then
      v_state := 'listed';
    elsif r.kind = 'withdrawal' and v_state in ('listed', 'suspended') then
      v_state := 'withdrawn';
    end if;
  end loop;
  return v_state;
end;
$$;

-- 8. Un levier des réglages en vigueur (dernière version publiée), ou sa valeur par défaut.
create function public.market_param(p_key text, p_default numeric) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((
    select (params ->> p_key)::numeric
    from public.valuation_settings
    order by published_on desc, id desc
    limit 1
  ), p_default);
$$;

-- 9. Ordre d'un joueur dans la séance ouverte.
create function public.place_order(
  p_company bigint, p_side text, p_quantity integer, p_limit numeric
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

  insert into public.market_orders (session_id, account_id, company_id, side, quantity, limit_price, reserved)
  values (v_session, v_account.user_id, p_company, p_side, p_quantity, p_limit, v_reserved)
  returning id into v_id;
  return v_id;
end;
$$;

-- 10. Annulation par le joueur, tant que la séance n'est pas close.
create function public.cancel_order(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.market_orders o
  set status = 'cancelled', closed_at = now(), reason = 'annulé par l''investisseur'
  where o.id = p_id and o.account_id = auth.uid() and o.status = 'open'
    and exists (select 1 from public.market_sessions s where s.id = o.session_id and s.status = 'open');
  if not found then
    raise exception 'ordre introuvable ou déjà traité';
  end if;
end;
$$;

-- 11. Première séance (ensuite, chaque clôture ouvre la suivante).
create function public.open_session(p_date date) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
begin
  if not public.is_admin() then
    raise exception 'réservé aux opérateurs' using errcode = '42501';
  end if;
  if exists (select 1 from public.market_sessions where status = 'open') then
    raise exception 'une séance est déjà ouverte';
  end if;
  insert into public.market_sessions (opened_on) values (p_date) returning id into v_id;
  return v_id;
end;
$$;

-- 12. Clôture : sert les ordres de la séance aux prix fixés, puis ouvre la séance suivante.
-- p_prices : [{ company_id, shares, reference, premium, price, buy, sell, demand, supply }]
-- p_params : { commission, hold_cap, player_cap, … } en vigueur.
create function public.close_session(
  p_session bigint, p_report date, p_prices jsonb, p_params jsonb
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_session public.market_sessions;
  v_commission numeric := coalesce((p_params ->> 'commission')::numeric, 0.01);
  v_hold_cap numeric := coalesce((p_params ->> 'hold_cap')::numeric, 0.2);
  v_player_cap numeric := coalesce((p_params ->> 'player_cap')::numeric, 0.05);
  r public.market_orders;
  v_price jsonb;
  v_shares bigint;
  v_buy numeric;
  v_sell numeric;
  v_total bigint;
  v_held bigint;
  v_quantity bigint;
  v_amount bigint;
  v_fee bigint;
  v_free bigint;
  v_next bigint;
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
    raise exception 'prix de clôture mal formés';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_prices) e
    where coalesce((e ->> 'shares')::numeric, 0) < 1
       or coalesce((e ->> 'buy')::numeric, 0) <= 0
       or coalesce((e ->> 'sell')::numeric, 0) <= 0
  ) then
    raise exception 'prix de clôture invalides (titres, achat, vente)';
  end if;

  for r in
    select * from public.market_orders
    where session_id = p_session and status = 'open'
    order by created_at, id
    for update
  loop
    select e into v_price from jsonb_array_elements(p_prices) e
    where (e ->> 'company_id')::bigint = r.company_id
    limit 1;
    if v_price is null or coalesce(public.listing_state(r.company_id), '') <> 'listed' then
      update public.market_orders
      set status = 'expired', closed_at = now(), reason = 'titre non coté ou cotation suspendue'
      where id = r.id;
      continue;
    end if;
    v_shares := (v_price ->> 'shares')::bigint;
    v_buy := round((v_price ->> 'buy')::numeric, 2);
    v_sell := round((v_price ->> 'sell')::numeric, 2);

    if r.side = 'buy' then
      if r.limit_price < v_buy then
        update public.market_orders
        set status = 'expired', closed_at = now(),
            reason = format('limite sous le prix d''achat de la séance (%s ¢)', v_buy)
        where id = r.id;
        continue;
      end if;
      select coalesce(sum(case side when 'buy' then quantity else -quantity end), 0)
      into v_total from public.market_trades where company_id = r.company_id;
      select coalesce(sum(case side when 'buy' then quantity else -quantity end), 0)
      into v_held from public.market_trades
      where company_id = r.company_id and account_id = r.account_id;
      v_quantity := least(
        r.quantity::bigint,
        floor(v_hold_cap * v_shares)::bigint - v_total,
        floor(v_player_cap * v_shares)::bigint - v_held
      );
      if v_quantity <= 0 then
        update public.market_orders
        set status = 'rejected', closed_at = now(), reason = 'plafond de détention atteint'
        where id = r.id;
        continue;
      end if;
      v_amount := round(v_quantity * v_buy)::bigint;
      v_fee := ceil(v_amount * v_commission)::bigint;
      -- This order's own reservation is still counted as held: free it for itself.
      select available + r.reserved into v_free from public.account_cash(r.account_id);
      if v_amount + v_fee > v_free then
        update public.market_orders
        set status = 'rejected', closed_at = now(), reason = 'crédits insuffisants à la clôture'
        where id = r.id;
        continue;
      end if;
      insert into public.market_trades
        (session_id, order_id, account_id, company_id, side, quantity, price, amount, commission)
      values (p_session, r.id, r.account_id, r.company_id, 'buy', v_quantity, v_buy, v_amount, v_fee);
      update public.market_orders
      set status = case when v_quantity = r.quantity then 'filled' else 'partial' end,
          filled_quantity = v_quantity, fill_price = v_buy, closed_at = now(),
          reason = case when v_quantity = r.quantity then null else 'plafond de détention atteint' end
      where id = r.id;
    else
      if r.limit_price > v_sell then
        update public.market_orders
        set status = 'expired', closed_at = now(),
            reason = format('limite au-dessus du prix de vente de la séance (%s ¢)', v_sell)
        where id = r.id;
        continue;
      end if;
      select coalesce(sum(case side when 'buy' then quantity else -quantity end), 0)
      into v_held from public.market_trades
      where company_id = r.company_id and account_id = r.account_id;
      if v_held < r.quantity then
        update public.market_orders
        set status = 'rejected', closed_at = now(), reason = 'titres insuffisants à la clôture'
        where id = r.id;
        continue;
      end if;
      v_amount := round(r.quantity * v_sell)::bigint;
      v_fee := ceil(v_amount * v_commission)::bigint;
      insert into public.market_trades
        (session_id, order_id, account_id, company_id, side, quantity, price, amount, commission)
      values (p_session, r.id, r.account_id, r.company_id, 'sell', r.quantity, v_sell, v_amount, v_fee);
      update public.market_orders
      set status = 'filled', filled_quantity = r.quantity, fill_price = v_sell, closed_at = now()
      where id = r.id;
    end if;
  end loop;

  update public.market_sessions
  set status = 'closed', closed_on = p_report, report_date = p_report, prices = p_prices,
      params = p_params, closed_at = now(), closed_by = auth.uid()
  where id = p_session;
  insert into public.market_sessions (opened_on) values (p_report) returning id into v_next;
  return v_next;
end;
$$;

revoke all on function public.account_cash from public, anon, authenticated;
revoke all on function public.account_shares from public, anon, authenticated;
revoke all on function public.listing_state from public, anon, authenticated;
revoke all on function public.market_param from public, anon, authenticated;
revoke all on function public.place_order from public, anon;
revoke all on function public.cancel_order from public, anon;
revoke all on function public.open_session from public, anon;
revoke all on function public.close_session from public, anon;
grant execute on function public.place_order to authenticated;
grant execute on function public.cancel_order to authenticated;
grant execute on function public.open_session to authenticated;
grant execute on function public.close_session to authenticated;
