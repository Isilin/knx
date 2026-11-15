-- KNX — comptes investisseurs (marché B, phase 1) : comptes des joueurs et mouvements d'argent.
-- À exécuter après 20261120000000_cours_theorique.sql.
--
-- Un joueur investit de vrais crédits de Dreadcast : il les verse en jeu à l'opérateur, qui les
-- inscrit sur son compte KNX ; pour un retrait, le joueur le demande sur le site, l'opérateur le
-- paie en jeu puis le valide. Le compte d'un joueur est un utilisateur Supabase Auth à identifiant
-- de cinq chiffres, créé par l'opérateur via la fonction serveur /api/v1/comptes (clé de service),
-- avec un mot de passe temporaire que le joueur change à sa première connexion.
--
-- Toute écriture passe par les fonctions ci-dessous : aucun joueur n'écrit directement dans ces
-- tables, et un joueur ne lit que son propre compte.

-- 1. Comptes.
create table public.investor_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  login text not null unique check (login ~ '^[0-9]{5}$'),
  display_name text not null check (length(btrim(display_name)) between 1 and 60),
  must_change_password boolean not null default true,
  note text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

alter table public.investor_accounts enable row level security;
create policy "an investor reads their own account" on public.investor_accounts
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "admins edit investor accounts" on public.investor_accounts
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 2. Mouvements d'argent. Un dépôt est inscrit réglé ; un retrait est demandé, puis réglé (payé
-- en jeu) ou annulé.
create table public.cash_movements (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.investor_accounts (user_id) on delete restrict,
  kind text not null check (kind in ('deposit', 'withdrawal')),
  amount bigint not null check (amount between 1 and 1000000000000),
  status text not null check (status in ('requested', 'done', 'cancelled')),
  note text,
  requested_at timestamptz not null default now(),
  settled_at timestamptz,
  settled_by uuid references auth.users (id) on delete set null,
  check (kind = 'withdrawal' or status = 'done')
);

create index cash_movements_account_idx on public.cash_movements (account_id, requested_at);

alter table public.cash_movements enable row level security;
create policy "an investor reads their own movements" on public.cash_movements
  for select to authenticated using (account_id = auth.uid() or public.is_admin());

-- 3. Solde d'un compte : réglé (dépôts moins retraits payés) et disponible (moins les retraits
-- en attente). La phase des ordres y ajoutera les achats, les ventes et les montants réservés.
create function public.account_cash(p_account uuid)
returns table (balance bigint, pending bigint, available bigint)
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
  )
  select balance::bigint, pending::bigint, (balance - pending)::bigint from m;
$$;

-- 4. Dépôt inscrit par l'opérateur, une fois les crédits reçus en jeu.
create function public.record_deposit(p_account uuid, p_amount bigint, p_note text default null)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
begin
  if not public.is_admin() then
    raise exception 'réservé aux opérateurs' using errcode = '42501';
  end if;
  perform 1 from public.investor_accounts where user_id = p_account and closed_at is null;
  if not found then
    raise exception 'compte introuvable ou fermé';
  end if;
  insert into public.cash_movements (account_id, kind, amount, status, note, settled_at, settled_by)
  values (p_account, 'deposit', p_amount, 'done', nullif(btrim(p_note), ''), now(), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- 5. Demande de retrait par le joueur, dans la limite de son disponible. Le compte est verrouillé
-- le temps du calcul : deux demandes simultanées ne dépassent pas le solde.
create function public.request_withdrawal(p_amount bigint, p_note text default null)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_account public.investor_accounts;
  v_available bigint;
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
  if p_amount is null or p_amount < 1 then
    raise exception 'montant invalide';
  end if;
  select available into v_available from public.account_cash(v_account.user_id);
  if p_amount > v_available then
    raise exception 'solde disponible insuffisant';
  end if;
  insert into public.cash_movements (account_id, kind, amount, status, note)
  values (v_account.user_id, 'withdrawal', p_amount, 'requested', nullif(btrim(p_note), ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- 6. Retrait payé en jeu : l'opérateur le règle.
create function public.settle_withdrawal(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'réservé aux opérateurs' using errcode = '42501';
  end if;
  update public.cash_movements
  set status = 'done', settled_at = now(), settled_by = auth.uid()
  where id = p_id and kind = 'withdrawal' and status = 'requested';
  if not found then
    raise exception 'demande de retrait introuvable ou déjà traitée';
  end if;
end;
$$;

-- 7. Retrait annulé : par le joueur qui l'a demandé, ou refusé par l'opérateur.
create function public.cancel_withdrawal(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.cash_movements
  set status = 'cancelled', settled_at = now(), settled_by = auth.uid()
  where id = p_id and kind = 'withdrawal' and status = 'requested'
    and (account_id = auth.uid() or public.is_admin());
  if not found then
    raise exception 'demande de retrait introuvable ou déjà traitée';
  end if;
end;
$$;

-- 8. Le joueur a remplacé son mot de passe temporaire.
create function public.mark_password_changed() returns void
language sql volatile security definer set search_path = public as $$
  update public.investor_accounts set must_change_password = false where user_id = auth.uid();
$$;

revoke all on function public.account_cash from public, anon, authenticated;
revoke all on function public.record_deposit from public, anon;
revoke all on function public.request_withdrawal from public, anon;
revoke all on function public.settle_withdrawal from public, anon;
revoke all on function public.cancel_withdrawal from public, anon;
revoke all on function public.mark_password_changed from public, anon;
grant execute on function public.record_deposit to authenticated;
grant execute on function public.request_withdrawal to authenticated;
grant execute on function public.settle_withdrawal to authenticated;
grant execute on function public.cancel_withdrawal to authenticated;
grant execute on function public.mark_password_changed to authenticated;
