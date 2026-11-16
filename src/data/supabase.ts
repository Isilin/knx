import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cleanMarketEvent, normalizeDataset } from "../domain/mutations.ts";
import {
  investorEmail,
  isLogin,
  type CashMovement,
  type InvestorAccount,
} from "../domain/investors.ts";
import type {
  MarketOffer,
  MarketOrder,
  MarketSession,
  MarketTrade,
  ShareIssue,
} from "../domain/trading.ts";
import { VALUATION_METHOD } from "../domain/valuation.ts";
import type {
  ApiKey,
  CreatedApiKey,
  DataSource,
  PendingSnapshot,
  ResolvedRows,
  Session,
} from "./source.ts";

const LOGO_BUCKET = "company-logos";

/** Supabase Auth errors, said in the operator's terms. */
function signInMessage(error: { message: string; status?: number; code?: string }): string {
  if (error.code === "over_email_send_rate_limit" || error.status === 429) {
    return "trop de liens demandés. Le service d'e-mail intégré de Supabase n'en envoie que 2 par heure pour tout le projet ; réessayez dans une heure, ou configurez un SMTP dans Supabase pour lever cette limite.";
  }
  if (error.code === "otp_disabled" || /signups not allowed/i.test(error.message)) {
    return "cette adresse n'a pas de compte opérateur. Un administrateur doit d'abord l'inviter dans Supabase.";
  }
  if (error.code === "invalid_credentials" || /invalid login credentials/i.test(error.message)) {
    return "adresse ou mot de passe incorrect.";
  }
  if (error.code === "email_not_confirmed") {
    return "ce compte n'est pas confirmé. Dans Supabase, confirmez l'utilisateur ou recréez-le avec « Auto Confirm User ».";
  }
  return error.message;
}

/** Database errors, said in the operator's terms. */
function writeMessage(error: { message: string; code?: string }, duplicate?: string): Error {
  if (error.code === "23505" && duplicate) return new Error(duplicate);
  if (error.code === "42501" || /row-level security/i.test(error.message))
    return new Error("modification réservée aux opérateurs.");
  return new Error(error.message);
}

/** A resolved report row, as the publication functions read it. */
function rowPayload(r: ResolvedRows["rows"][number]) {
  return {
    company_id: r.companyId,
    profile_id: r.profileId ?? null,
    name: r.name,
    rank: r.rank,
    chiffre: r.chiffre,
    capital: r.capital,
    employees: r.employees,
  };
}

/** Missing table: Postgres says 42P01, PostgREST's schema cache PGRST205. */
function isMissingTable(error: { code?: string }): boolean {
  return error.code === "42P01" || error.code === "PGRST205";
}

const MISSING_INVESTOR_TABLES =
  "tables des comptes investisseurs absentes : exécuter la migration 20261121000000_comptes_investisseurs.sql.";

const ACCOUNT_COLUMNS =
  "user_id, login, display_name, must_change_password, note, closed_at, created_at, insider_of, public_ranking, company_profile_id";

interface AccountRow {
  user_id: string;
  login: string;
  display_name: string;
  must_change_password: boolean;
  note: string | null;
  closed_at: string | null;
  created_at: string;
  /** Absent before the migration of the market sessions. */
  insider_of?: (number | string)[] | null;
  /** Absent before the migration of the ranking. */
  public_ranking?: boolean | null;
  /** Absent before the migration of model C. */
  company_profile_id?: number | string | null;
}

interface MovementRow {
  id: number;
  account_id: string;
  kind: CashMovement["kind"];
  amount: number;
  status: CashMovement["status"];
  note: string | null;
  requested_at: string;
  settled_at: string | null;
}

const accountOf = (r: AccountRow): InvestorAccount => ({
  id: r.user_id,
  login: r.login,
  displayName: r.display_name,
  mustChangePassword: r.must_change_password,
  note: r.note,
  closedAt: r.closed_at,
  createdAt: r.created_at,
  insiderOf: (r.insider_of ?? []).map(String),
  publicRanking: r.public_ranking === true,
  companyProfileId: r.company_profile_id == null ? null : String(r.company_profile_id),
});

const movementOf = (r: MovementRow): CashMovement => ({
  id: String(r.id),
  accountId: r.account_id,
  kind: r.kind,
  amount: Number(r.amount),
  status: r.status,
  note: r.note,
  requestedAt: r.requested_at,
  settledAt: r.settled_at,
});

interface SessionRow {
  id: number;
  opened_on: string;
  closed_on: string | null;
  report_date: string | null;
  status: MarketSession["status"];
  prices: {
    company_id: number | string;
    shares: number;
    reference: number;
    premium: number;
    price: number;
    buy: number;
    sell: number;
    demand: number;
    supply: number;
    volume?: number;
  }[];
}

const sessionOf = (r: SessionRow): MarketSession => ({
  id: String(r.id),
  openedOn: r.opened_on,
  closedOn: r.closed_on,
  reportDate: r.report_date,
  status: r.status,
  prices: (r.prices ?? []).map((p) => ({
    companyId: String(p.company_id),
    shares: Number(p.shares),
    reference: Number(p.reference),
    premium: Number(p.premium),
    price: Number(p.price),
    buy: Number(p.buy),
    sell: Number(p.sell),
    demand: Number(p.demand),
    supply: Number(p.supply),
    volume: Number(p.volume ?? 0),
  })),
});

interface OrderRow {
  id: number;
  session_id: number;
  account_id: string;
  company_id: number;
  side: MarketOrder["side"];
  quantity: number;
  limit_price: number | string;
  reserved: number;
  status: MarketOrder["status"];
  filled_quantity: number;
  fill_price: number | string | null;
  reason: string | null;
  created_at: string;
  closed_at: string | null;
  sessions_left?: number | null;
  fees_paid?: number | null;
  offer_id?: number | null;
}

const orderOf = (r: OrderRow): MarketOrder => ({
  id: String(r.id),
  sessionId: String(r.session_id),
  accountId: r.account_id,
  companyId: String(r.company_id),
  side: r.side,
  quantity: Number(r.quantity),
  limitPrice: Number(r.limit_price),
  reserved: Number(r.reserved),
  status: r.status,
  filledQuantity: Number(r.filled_quantity),
  fillPrice: r.fill_price === null ? null : Number(r.fill_price),
  reason: r.reason,
  createdAt: r.created_at,
  closedAt: r.closed_at,
  sessionsLeft: Number(r.sessions_left ?? 1),
  feesPaid: Number(r.fees_paid ?? 0),
  offerId: r.offer_id == null ? null : String(r.offer_id),
});

interface TradeRow {
  id: number;
  session_id: number;
  order_id: number | null;
  offer_id?: number | null;
  account_id: string;
  company_id: number;
  side: MarketTrade["side"];
  quantity: number;
  price: number | string;
  amount: number;
  commission: number;
  created_at: string;
}

const tradeOf = (r: TradeRow): MarketTrade => ({
  id: String(r.id),
  sessionId: String(r.session_id),
  orderId: r.order_id == null ? null : String(r.order_id),
  offerId: r.offer_id == null ? null : String(r.offer_id),
  accountId: r.account_id,
  companyId: String(r.company_id),
  side: r.side,
  quantity: Number(r.quantity),
  price: Number(r.price),
  amount: Number(r.amount),
  commission: Number(r.commission),
  createdAt: r.created_at,
});

interface OfferRow {
  id: number;
  company_id: number;
  account_id: string;
  session_id: number;
  shares_offered: number;
  price: number | string;
  status: MarketOffer["status"];
  allocated: number;
  proceeds: number;
  note: string | null;
  created_at: string;
}

const offerOf = (r: OfferRow): MarketOffer => ({
  id: String(r.id),
  companyId: String(r.company_id),
  accountId: r.account_id,
  sessionId: String(r.session_id),
  sharesOffered: Number(r.shares_offered),
  price: Number(r.price),
  status: r.status,
  allocated: Number(r.allocated),
  proceeds: Number(r.proceeds),
  note: r.note,
  createdAt: r.created_at,
});

interface IssueRow {
  id: number;
  company_id: number;
  account_id: string;
  quantity: number;
  reason: ShareIssue["reason"];
  created_at: string;
}

const issueOf = (r: IssueRow): ShareIssue => ({
  id: String(r.id),
  companyId: String(r.company_id),
  accountId: r.account_id,
  quantity: Number(r.quantity),
  reason: r.reason,
  createdAt: r.created_at,
});

const MISSING_MARKET_TABLES =
  "tables de la séance absentes : exécuter la migration 20261122000000_seances_marche.sql.";

/** Errors of the market functions. */
function marketWriteMessage(error: { message: string; code?: string }): Error {
  if (error.code === "PGRST202" || isMissingTable(error)) return new Error(MISSING_MARKET_TABLES);
  return writeMessage(error);
}

/** Errors of the account functions: the database speaks French already. */
function investorWriteMessage(error: { message: string; code?: string }): Error {
  if (error.code === "PGRST202" || isMissingTable(error)) return new Error(MISSING_INVESTOR_TABLES);
  return writeMessage(error);
}

const MISSING_PRICE_TABLES =
  "tables du cours théorique absentes : exécuter la migration 20261120000000_cours_theorique.sql.";

/** Path of an uploaded logo inside the bucket, from its public URL. */
function logoPath(url: string | null): string | null {
  const marker = `/storage/v1/object/public/${LOGO_BUCKET}/`;
  const at = url?.indexOf(marker) ?? -1;
  return url && at >= 0 ? decodeURIComponent(url.slice(at + marker.length)) : null;
}

export function createSupabaseSource(url: string, key: string): DataSource {
  const client: SupabaseClient = createClient(url, key, {
    auth: { persistSession: true, detectSessionInUrl: true },
  });

  /** Calls the server function that creates accounts, with the operator's own session. */
  async function callAccounts(body: Record<string, string>): Promise<void> {
    const { data } = await client.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("session expirée : reconnectez-vous.");
    const response = await fetch("/api/v1/comptes", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return;
    const reply = (await response.json().catch(() => null)) as {
      error?: { message?: string; details?: string[] };
    } | null;
    const message = reply?.error?.message ?? `erreur ${response.status}`;
    const details = reply?.error?.details?.join(" ; ");
    throw new Error(details ? `${message} ${details}` : message);
  }

  /** Updates one row; RLS turns a refused update into zero rows, so check for one. */
  async function updateRow(
    table: "companies" | "company_profiles",
    id: string,
    values: Record<string, unknown>,
  ): Promise<void> {
    const { data, error } = await client.from(table).update(values).eq("id", id).select("id");
    // Missing table: Postgres says 42P01, PostgREST's schema cache PGRST205.
    if (error?.code === "42P01" || error?.code === "PGRST205")
      throw new Error(
        "table des fiches absente : exécuter la migration 20261118000000_fiches_vies.sql.",
      );
    if (error) throw writeMessage(error);
    if (!data || data.length === 0)
      throw new Error("modification refusée ou corporation introuvable.");
  }

  return {
    kind: "supabase",
    async load() {
      const [dataset, settings, operations, balances] = await Promise.all([
        client.rpc("market_dataset"),
        client
          .from("valuation_settings")
          .select("id, published_on, method, params, note")
          .order("published_on")
          .order("id"),
        client
          .from("security_operations")
          .select("id, company_id, occurred_on, kind, shares, ratio, note")
          .order("occurred_on")
          .order("id"),
        client
          .from("company_balance_sheets")
          .select("id, company_id, stated_on, land, building, fittings, stock, source, note")
          .order("stated_on")
          .order("id"),
      ]);
      if (dataset.error)
        throw new Error(`Lecture des relevés impossible : ${dataset.error.message}`);
      // Before the migration of the theoretical price, the site runs on the default settings.
      const optional = <T>(
        result: { data: T[] | null; error: { message: string; code?: string } | null },
        what: string,
      ): T[] => {
        if (!result.error) return result.data ?? [];
        if (isMissingTable(result.error)) return [];
        throw new Error(`Lecture ${what} impossible : ${result.error.message}`);
      };
      return normalizeDataset({
        ...(dataset.data as object),
        valuationSettings: optional(settings, "des réglages du cours").map((r) => ({
          id: String(r.id),
          date: r.published_on,
          method: r.method,
          params: r.params,
          note: r.note,
        })),
        securityOperations: optional(operations, "des opérations sur titres").map((r) => ({
          id: String(r.id),
          companyId: String(r.company_id),
          date: r.occurred_on,
          kind: r.kind,
          shares: r.shares,
          ratio: r.ratio,
          note: r.note,
        })),
        balanceSheets: optional(balances, "des bilans").map((r) => ({
          id: String(r.id),
          companyId: String(r.company_id),
          date: r.stated_on,
          land: r.land,
          building: r.building,
          fittings: r.fittings,
          stock: r.stock,
          source: r.source,
          note: r.note,
        })),
      });
    },
    async publish(request) {
      const { error } = await client.rpc("publish_snapshot", {
        p_taken_on: request.date,
        p_source: request.source,
        p_rows: request.rows.map(rowPayload),
        p_closures: request.closures.map(Number),
        p_replace: request.replace,
      });
      if (error) throw new Error(error.message);
    },
    async withdrawSnapshot(date) {
      const { error } = await client.rpc("withdraw_snapshot", { p_taken_on: date });
      if (error) throw new Error(error.message);
    },
    async updateCompany(id, patch) {
      if (patch.creationOverride === undefined) return;
      await updateRow("companies", id, { creation_override: patch.creationOverride });
    },
    async updateProfile(id, patch) {
      const values: Record<string, unknown> = {};
      if (patch.sector !== undefined) values.sector = patch.sector;
      if (patch.district !== undefined) values.district = patch.district;
      if (patch.hidden !== undefined) values.hidden = patch.hidden;
      await updateRow("company_profiles", id, values);
    },
    async setMemberships(profileId, periods) {
      const { error } = await client.rpc("set_memberships", {
        p_profile_id: Number(profileId),
        p_periods: periods.map((m) => ({
          consortium_id: Number(m.consortiumId),
          joined_on: m.joinedOn,
          left_on: m.leftOn,
        })),
      });
      // Missing function: PostgREST says PGRST202.
      if (error?.code === "PGRST202")
        throw new Error(
          "adhésions datées absentes : exécuter la migration 20261119000000_adhesions_consortiums.sql.",
        );
      if (error?.code === "23P01")
        throw new Error(
          "deux périodes se chevauchent : une corporation n'appartient qu'à un consortium à la fois.",
        );
      if (error) throw writeMessage(error);
    },
    async setLogo(id, logo) {
      const { data: row } = await client
        .from("company_profiles")
        .select("logo_url")
        .eq("id", id)
        .single();
      const previous = logoPath((row as { logo_url: string | null } | null)?.logo_url ?? null);
      let next: string | null = null;
      if (logo) {
        const path = `${id}/${crypto.randomUUID()}.webp`;
        const { error } = await client.storage.from(LOGO_BUCKET).upload(path, logo, {
          contentType: logo.type || "image/webp",
          cacheControl: "31536000",
        });
        if (error) throw writeMessage(error);
        next = client.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
      }
      await updateRow("company_profiles", id, { logo_url: next });
      // The former file is no longer referenced; failing to remove it only leaves a stray file.
      if (previous) await client.storage.from(LOGO_BUCKET).remove([previous]);
    },
    async saveConsortium({ id, name, color }) {
      const values = { name: name.trim(), color };
      const duplicate = `un consortium s'appelle déjà « ${values.name} »`;
      const { error } =
        id === null
          ? await client.from("consortiums").insert(values)
          : await client.from("consortiums").update(values).eq("id", id);
      if (error) throw writeMessage(error, duplicate);
    },
    async deleteConsortium(id) {
      const { error } = await client.from("consortiums").delete().eq("id", id);
      if (error) throw writeMessage(error);
    },
    async saveEvent({ id, companyId, date, kind, details, note }) {
      const values = {
        company_id: Number(companyId),
        occurred_on: date,
        kind,
        details,
        note,
      };
      const { error } =
        id === null
          ? await client.from("company_events").insert(values)
          : await client.from("company_events").update(values).eq("id", id);
      if (error) throw writeMessage(error);
    },
    async deleteEvent(id) {
      const { error } = await client.from("company_events").delete().eq("id", id);
      if (error) throw writeMessage(error);
    },
    async saveMarketEvent(draft) {
      const { id, date, label, title, description, span } = cleanMarketEvent(draft);
      const values = { occurred_on: date, label, title, description, span_days: span };
      const { error } =
        id === null
          ? await client.from("market_events").insert(values)
          : await client.from("market_events").update(values).eq("id", id);
      // Missing table: Postgres says 42P01, PostgREST's schema cache PGRST205.
      if (error)
        throw error.code === "42P01" || error.code === "PGRST205"
          ? new Error(
              "table des évènements de marché absente : exécuter la migration 20261115000000_evenements_marche.sql.",
            )
          : writeMessage(error);
    },
    async deleteMarketEvent(id) {
      const { error } = await client.from("market_events").delete().eq("id", id);
      if (error) throw writeMessage(error);
    },
    async publishRating(draft) {
      const { error } = await client.from("company_ratings").insert({
        company_id: Number(draft.companyId),
        rated_on: draft.date,
        method: draft.method,
        category: draft.category,
        confidence: draft.confidence,
        outlook: draft.outlook,
        score: draft.score,
        axes: draft.axes,
        criteria: draft.criteria,
        inputs: draft.inputs,
        district: draft.district,
        rationale: draft.rationale,
      });
      if (error)
        throw error.code === "42P01" || error.code === "PGRST205"
          ? new Error(
              "table des notations absente : exécuter la migration 20261117000000_notation_agence.sql.",
            )
          : writeMessage(error, "une notation existe déjà à cette date : retirez-la d'abord");
    },
    async deleteRating(id) {
      const { error } = await client.from("company_ratings").delete().eq("id", id);
      if (error) throw writeMessage(error);
    },
    async publishValuationSettings(draft) {
      const { error } = await client.from("valuation_settings").insert({
        published_on: draft.date,
        method: VALUATION_METHOD,
        params: draft.params,
        note: draft.note,
      });
      if (error)
        throw isMissingTable(error) ? new Error(MISSING_PRICE_TABLES) : writeMessage(error);
    },
    async saveSecurityOperation({ id, companyId, date, kind, shares, ratio, note }) {
      const values = {
        company_id: Number(companyId),
        occurred_on: date,
        kind,
        shares,
        ratio,
        note,
      };
      const { error } =
        id === null
          ? await client.from("security_operations").insert(values)
          : await client.from("security_operations").update(values).eq("id", id);
      if (error)
        throw isMissingTable(error) ? new Error(MISSING_PRICE_TABLES) : writeMessage(error);
    },
    async deleteSecurityOperation(id) {
      const { error } = await client.from("security_operations").delete().eq("id", id);
      if (error) throw writeMessage(error);
    },
    async saveBalanceSheet({ id, companyId, date, land, building, fittings, stock, source, note }) {
      const values = {
        company_id: Number(companyId),
        stated_on: date,
        land,
        building,
        fittings,
        stock,
        source,
        note,
      };
      const { error } =
        id === null
          ? await client.from("company_balance_sheets").insert(values)
          : await client.from("company_balance_sheets").update(values).eq("id", id);
      if (error)
        throw isMissingTable(error) ? new Error(MISSING_PRICE_TABLES) : writeMessage(error);
    },
    async deleteBalanceSheet(id) {
      const { error } = await client.from("company_balance_sheets").delete().eq("id", id);
      if (error) throw writeMessage(error);
    },
    async session(): Promise<Session> {
      const { data } = await client.auth.getSession();
      const user = data.session?.user;
      if (!user) return { state: "anonymous" };
      const [{ data: isAdmin }, { data: account }] = await Promise.all([
        client.rpc("is_admin"),
        client
          .from("investor_accounts")
          .select(ACCOUNT_COLUMNS)
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      return {
        state: "signed-in",
        email: user.email ?? "",
        isAdmin: Boolean(isAdmin),
        investor: account ? accountOf(account as AccountRow) : null,
      };
    },
    async signInInvestor(login, password) {
      if (!isLogin(login)) throw new Error("identifiant de cinq chiffres attendu.");
      const { error } = await client.auth.signInWithPassword({
        email: investorEmail(login),
        password,
      });
      if (error)
        throw new Error(
          error.code === "invalid_credentials" || /invalid login credentials/i.test(error.message)
            ? "identifiant ou mot de passe incorrect."
            : signInMessage(error),
        );
    },
    async changePassword(password) {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw new Error(error.message);
      const { error: flag } = await client.rpc("mark_password_changed");
      if (flag) throw investorWriteMessage(flag);
    },
    async cashMovements() {
      const { data, error } = await client
        .from("cash_movements")
        .select("id, account_id, kind, amount, status, note, requested_at, settled_at")
        .order("requested_at", { ascending: false });
      if (error)
        throw isMissingTable(error) ? new Error(MISSING_INVESTOR_TABLES) : writeMessage(error);
      return (data as MovementRow[]).map(movementOf);
    },
    async requestWithdrawal(amount, note) {
      const { error } = await client.rpc("request_withdrawal", { p_amount: amount, p_note: note });
      if (error) throw investorWriteMessage(error);
    },
    async cancelWithdrawal(id) {
      const { error } = await client.rpc("cancel_withdrawal", { p_id: Number(id) });
      if (error) throw investorWriteMessage(error);
    },
    async investorAccounts() {
      const { data, error } = await client
        .from("investor_accounts")
        .select(ACCOUNT_COLUMNS)
        .order("login");
      if (error)
        throw isMissingTable(error) ? new Error(MISSING_INVESTOR_TABLES) : writeMessage(error);
      return (data as AccountRow[]).map(accountOf);
    },
    async createInvestorAccount({ login, displayName, password, profileId }) {
      await callAccounts({
        action: "create",
        login,
        displayName,
        password,
        ...(profileId ? { profileId } : {}),
      });
    },
    async resetInvestorPassword(login, password) {
      await callAccounts({ action: "reset", login, password });
    },
    async recordDeposit(accountId, amount, note) {
      const { error } = await client.rpc("record_deposit", {
        p_account: accountId,
        p_amount: amount,
        p_note: note,
      });
      if (error) throw investorWriteMessage(error);
    },
    async settleWithdrawal(id) {
      const { error } = await client.rpc("settle_withdrawal", { p_id: Number(id) });
      if (error) throw investorWriteMessage(error);
    },
    async setInsiders(accountId, profileIds) {
      const { data, error } = await client
        .from("investor_accounts")
        .update({ insider_of: profileIds.map(Number) })
        .eq("user_id", accountId)
        .select("user_id");
      if (error) throw marketWriteMessage(error);
      if (!data || data.length === 0)
        throw new Error("modification refusée ou compte introuvable.");
    },
    async marketSessions() {
      const { data, error } = await client
        .from("market_sessions")
        .select("id, opened_on, closed_on, report_date, status, prices")
        .order("opened_at", { ascending: false })
        .limit(60);
      if (error) {
        if (isMissingTable(error)) return [];
        throw new Error(`Lecture des séances impossible : ${error.message}`);
      }
      return (data as SessionRow[]).map(sessionOf);
    },
    async marketOrders() {
      const { data, error } = await client
        .from("market_orders")
        .select(
          "id, session_id, account_id, company_id, side, quantity, limit_price, reserved, status, filled_quantity, fill_price, reason, created_at, closed_at, sessions_left, fees_paid, offer_id",
        )
        .order("created_at", { ascending: false });
      if (error) {
        if (isMissingTable(error)) return [];
        throw new Error(`Lecture des ordres impossible : ${error.message}`);
      }
      return (data as OrderRow[]).map(orderOf);
    },
    async marketTrades() {
      const { data, error } = await client
        .from("market_trades")
        .select(
          "id, session_id, order_id, offer_id, account_id, company_id, side, quantity, price, amount, commission, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) {
        if (isMissingTable(error)) return [];
        throw new Error(`Lecture des exécutions impossible : ${error.message}`);
      }
      return (data as TradeRow[]).map(tradeOf);
    },
    async placeOrder({ companyId, side, quantity, limit, sessions }) {
      const { error } = await client.rpc("place_order", {
        p_company: Number(companyId),
        p_side: side,
        p_quantity: quantity,
        p_limit: limit,
        p_sessions: sessions,
      });
      if (error) throw marketWriteMessage(error);
    },
    async setPublicRanking(value) {
      const { error } = await client.rpc("set_public_ranking", { p_value: value });
      if (error) throw marketWriteMessage(error);
    },
    async publicRanking() {
      const { data, error } = await client.rpc("public_ranking");
      if (error) {
        if (error.code === "PGRST202") return [];
        throw new Error(`Lecture du classement impossible : ${error.message}`);
      }
      return (
        data as {
          rank_key: string;
          display_name: string;
          invested: number;
          cash: number;
          positions: { company_id: number | string; quantity: number }[];
        }[]
      ).map((r) => ({
        key: r.rank_key,
        displayName: r.display_name,
        invested: Number(r.invested),
        cash: Number(r.cash),
        positions: (r.positions ?? []).map((p) => ({
          companyId: String(p.company_id),
          quantity: Number(p.quantity),
        })),
      }));
    },
    async cancelOrder(id) {
      const { error } = await client.rpc("cancel_order", { p_id: Number(id) });
      if (error) throw marketWriteMessage(error);
    },
    async openSession(date) {
      const { error } = await client.rpc("open_session", { p_date: date });
      if (error) throw marketWriteMessage(error);
    },
    async closeSession(sessionId, reportDate, references, params) {
      const { error } = await client.rpc("close_session", {
        p_session: Number(sessionId),
        p_report: reportDate,
        p_prices: references.map((p) => ({
          company_id: Number(p.companyId),
          shares: p.shares,
          reference: p.reference,
        })),
        p_params: params,
      });
      if (error) throw marketWriteMessage(error);
    },
    async marketOffers() {
      const { data, error } = await client
        .from("market_offers")
        .select(
          "id, company_id, account_id, session_id, shares_offered, price, status, allocated, proceeds, note, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) {
        if (isMissingTable(error)) return [];
        throw new Error(`Lecture des offres impossible : ${error.message}`);
      }
      return (data as OfferRow[]).map(offerOf);
    },
    async shareIssues() {
      const { data, error } = await client
        .from("share_issues")
        .select("id, company_id, account_id, quantity, reason, created_at")
        .order("created_at");
      if (error) {
        if (isMissingTable(error)) return [];
        throw new Error(`Lecture des titres émis impossible : ${error.message}`);
      }
      return (data as IssueRow[]).map(issueOf);
    },
    async createOffer({ companyId, shares, price, note }) {
      const { error } = await client.rpc("create_offer", {
        p_company: Number(companyId),
        p_shares: shares,
        p_price: price,
        p_note: note,
      });
      if (error) throw marketWriteMessage(error);
    },
    async cancelOffer(id) {
      const { error } = await client.rpc("cancel_offer", { p_id: Number(id) });
      if (error) throw marketWriteMessage(error);
    },
    async subscribe(offerId, quantity) {
      const { error } = await client.rpc("subscribe", {
        p_offer: Number(offerId),
        p_quantity: quantity,
      });
      if (error) throw marketWriteMessage(error);
    },
    async requestSignIn(email: string) {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/releves`, shouldCreateUser: false },
      });
      if (error) throw new Error(signInMessage(error));
    },
    async signInWithPassword(email: string, password: string) {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error(signInMessage(error));
    },
    async signOut() {
      await client.auth.signOut();
    },
    onSessionChange(listener) {
      const { data } = client.auth.onAuthStateChange(() => listener());
      return () => data.subscription.unsubscribe();
    },
    async pending() {
      const { data, error } = await client.rpc("pending_snapshots");
      if (error) throw new Error(`Lecture des envois en attente impossible : ${error.message}`);
      return data as PendingSnapshot[];
    },
    async publishPending(id, resolved) {
      const { error } = await client.rpc("publish_pending_snapshot", {
        p_id: id,
        p_rows: resolved.rows.map(rowPayload),
        p_closures: resolved.closures.map(Number),
      });
      if (error) throw new Error(error.message);
    },
    async rejectPending(id: number) {
      const { error } = await client.rpc("reject_pending_snapshot", { p_id: id });
      if (error) throw new Error(error.message);
    },
    async apiKeys() {
      const { data, error } = await client.rpc("list_api_keys");
      if (error) throw new Error(`Lecture des clés impossible : ${error.message}`);
      return data as ApiKey[];
    },
    async createApiKey(name: string) {
      const { data, error } = await client.rpc("create_api_key", { p_name: name });
      if (error) throw new Error(error.message);
      return data as CreatedApiKey;
    },
    async revokeApiKey(id: number) {
      const { error } = await client.rpc("revoke_api_key", { p_id: id });
      if (error) throw new Error(error.message);
    },
  };
}
