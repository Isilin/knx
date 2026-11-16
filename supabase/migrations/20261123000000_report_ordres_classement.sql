-- KNX — marché B, phase 3 : report des ordres et classement des investisseurs.
-- À exécuter après 20261122000000_seances_marche.sql.
--
-- 1. Un ordre peut vivre jusqu'à quatre séances. Non servi faute d'atteindre sa limite, il passe
--    à la séance suivante tant qu'il lui en reste, contre des frais de maintien prélevés sur les
--    crédits disponibles ; sans eux, il expire. Un ordre refusé (plafond, crédits, titres) ou dont
--    le titre n'est plus coté expire toujours.
-- 2. Un investisseur peut choisir d'apparaître au classement public : son personnage, ses
--    crédits investis, son solde et ses titres deviennent lisibles par tous ; la page n'en
--    affiche que la performance.

-- 1. Durée de vie et frais des ordres.
alter table public.market_orders
  add column sessions_left integer not null default 1 check (sessions_left between 1 and 4),
  add column fees_paid bigint not null default 0 check (fees_paid >= 0);

alter table public.investor_accounts
  add column public_ranking boolean not null default false;

-- 2. Solde : les frais de maintien sont dépensés.
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
    select
      coalesce(sum(case when status = 'open' and side = 'buy' then reserved end), 0) as reserved,
      coalesce(sum(fees_paid), 0) as fees
    from public.market_orders
    where account_id = p_account
  )
  select
    (m.balance + t.flow - o.fees)::bigint,
    m.pending::bigint,
    o.reserved::bigint,
    (m.balance + t.flow - o.fees - m.pending - o.reserved)::bigint
  from m, t, o;
$$;

-- 3. Ordre : avec sa durée de vie, en séances.
drop function public.place_order(bigint, text, integer, numeric);
create function public.place_order(
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

-- 4. Clôture : comme en phase 2, plus le report des ordres dont la limite n'est pas atteinte.
-- p_params ajoute carry_fee (part du montant de l'ordre prélevée à chaque report).
create or replace function public.close_session(
  p_session bigint, p_report date, p_prices jsonb, p_params jsonb
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_session public.market_sessions;
  v_commission numeric := coalesce((p_params ->> 'commission')::numeric, 0.01);
  v_hold_cap numeric := coalesce((p_params ->> 'hold_cap')::numeric, 0.2);
  v_player_cap numeric := coalesce((p_params ->> 'player_cap')::numeric, 0.05);
  v_carry_fee numeric := coalesce((p_params ->> 'carry_fee')::numeric, 0.002);
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
  v_reason text;
  v_carried bigint[] := '{}';
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

    -- Limit not reached: carried to the next session while it has some left and the fee is free.
    v_reason := null;
    if r.side = 'buy' and r.limit_price < v_buy then
      v_reason := format('limite sous le prix d''achat de la séance (%s ¢)', v_buy);
    elsif r.side = 'sell' and r.limit_price > v_sell then
      v_reason := format('limite au-dessus du prix de vente de la séance (%s ¢)', v_sell);
    end if;
    if v_reason is not null then
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
      continue;
    end if;

    if r.side = 'buy' then
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
  update public.market_orders set session_id = v_next where id = any (v_carried);
  return v_next;
end;
$$;

-- 5. Classement : le joueur choisit d'y figurer.
create function public.set_public_ranking(p_value boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.investor_accounts set public_ranking = coalesce(p_value, false)
  where user_id = auth.uid() and closed_at is null;
  if not found then
    raise exception 'compte investisseur introuvable ou fermé';
  end if;
end;
$$;

-- Ce que le classement publie des comptes volontaires : le site en tire la performance.
create function public.public_ranking()
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
        select company_id, sum(case side when 'buy' then quantity else -quantity end) as quantity
        from public.market_trades
        where account_id = a.user_id
        group by company_id
        having sum(case side when 'buy' then quantity else -quantity end) > 0
      ) p
    ), '[]'::jsonb)
  from public.investor_accounts a
  where a.public_ranking and a.closed_at is null;
$$;

revoke all on function public.account_cash from public, anon, authenticated;
revoke all on function public.place_order from public, anon;
revoke all on function public.set_public_ranking from public, anon;
revoke all on function public.public_ranking from public;
grant execute on function public.place_order to authenticated;
grant execute on function public.set_public_ranking to authenticated;
grant execute on function public.public_ranking to anon, authenticated;
