import { cashBalance, type CashMovement, type InvestorAccount } from "./investors.ts";
import type { CompanySeries, Market } from "./market.ts";
import type { IsoDate } from "./types.ts";
import type { ValuationParams } from "./valuation.ts";

/**
 * The weekly market of the Bourse: players place limit orders during a session (an heptade);
 * at its close, KNX fixes one price per listed corporation and the Banque impériale, as market
 * maker, takes the other side of every order that fits, within the caps:
 *
 *   premium = previous premium × decay + sensitivity × (demand − supply) ÷ shares   (bounded)
 *   price   = KNX price per share × (1 + premium)
 *   buyers pay price × (1 + spread ÷ 2), sellers get price × (1 − spread ÷ 2), plus commission
 *
 * Prices are in credits to the hundredth; amounts settle in whole credits.
 */

export type OrderSide = "buy" | "sell";
export type OrderStatus = "open" | "filled" | "partial" | "cancelled" | "expired" | "rejected";

export interface MarketOrder {
  id: string;
  sessionId: string;
  accountId: string;
  /** The life whose shares are traded. */
  companyId: string;
  side: OrderSide;
  quantity: number;
  /** Highest price a buyer pays, lowest a seller takes, per share. */
  limitPrice: number;
  /** Credits held for a buy order until the session closes. */
  reserved: number;
  status: OrderStatus;
  filledQuantity: number;
  fillPrice: number | null;
  /** Why an order did not fill, or only partly. */
  reason: string | null;
  createdAt: string;
  closedAt: string | null;
  /** Sessions the order still lives, this one included (1–4). */
  sessionsLeft: number;
  /** Carry fees paid so far. */
  feesPaid: number;
}

export interface MarketTrade {
  id: string;
  sessionId: string;
  orderId: string;
  accountId: string;
  companyId: string;
  side: OrderSide;
  quantity: number;
  /** Price per share paid (buy) or received (sell), before commission. */
  price: number;
  /** Quantity × price, in whole credits. */
  amount: number;
  commission: number;
  createdAt: string;
}

/** What the close of a session fixed for one corporation. */
export interface SessionPrice {
  companyId: string;
  shares: number;
  /** KNX price per share at the report the session closed on. */
  reference: number;
  premium: number;
  price: number;
  buy: number;
  sell: number;
  demand: number;
  supply: number;
}

export interface MarketSession {
  id: string;
  openedOn: IsoDate;
  closedOn: IsoDate | null;
  /** Report whose KNX values the fixing read. */
  reportDate: IsoDate | null;
  status: "open" | "closed";
  prices: SessionPrice[];
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  open: "en attente de la séance",
  filled: "exécuté",
  partial: "exécuté en partie",
  cancelled: "annulé",
  expired: "non exécuté",
  rejected: "refusé",
};

export const SIDE_LABELS: Record<OrderSide, string> = { buy: "Achat", sell: "Vente" };

/** Largest quantity of one order, as the database checks it. */
export const MAX_QUANTITY = 1_000_000_000;

const cents = (value: number) => Math.round(value * 100) / 100;
/** Rounded up (buy) or down (sell) to the hundredth: the house always keeps its spread. */
const centsUp = (value: number) => Math.ceil(value * 100 - 1e-9) / 100;
const centsDown = (value: number) => Math.floor(value * 100 + 1e-9) / 100;

/** Share of a premium left after one session. */
export function premiumDecay(params: ValuationParams): number {
  return 0.5 ** (1 / params.premiumHalfLife);
}

/** The premium after a session with this demand and supply. */
export function nextPremium(
  previous: number,
  demand: number,
  supply: number,
  shares: number,
  params: ValuationParams,
): number {
  const pressure = shares > 0 ? (params.premiumSensitivity * (demand - supply)) / shares : 0;
  const premium = previous * premiumDecay(params) + pressure;
  return Math.max(-params.premiumBand, Math.min(params.premiumBand, premium));
}

/** Fixing price and the prices each side trades at. */
export function sidePrices(
  reference: number,
  premium: number,
  params: ValuationParams,
): { price: number; buy: number; sell: number } {
  const price = reference * (1 + premium);
  return {
    price: cents(price),
    buy: centsUp(price * (1 + params.spread / 2)),
    sell: Math.max(0.01, centsDown(price * (1 - params.spread / 2))),
  };
}

/** Credits a trade moves: the amount and the commission on it. */
export function tradeAmounts(
  quantity: number,
  price: number,
  params: ValuationParams,
): { amount: number; commission: number } {
  const amount = Math.round(quantity * price);
  return { amount, commission: Math.ceil(amount * params.commission) };
}

/** Credits held for a buy order: the most it can cost, commission included. */
export function reservationFor(quantity: number, limit: number, params: ValuationParams): number {
  const { amount, commission } = tradeAmounts(quantity, limit, params);
  return amount + commission;
}

/**
 * A limit KNX suggests: a little above (buy) or below (sell) the price the side would trade at
 * with the premium of the last session, so an ordinary order fills.
 */
export function suggestedLimit(
  side: OrderSide,
  reference: number,
  previousPremium: number,
  params: ValuationParams,
): number {
  const { buy, sell } = sidePrices(reference, previousPremium * premiumDecay(params), params);
  return side === "buy" ? cents(buy * 1.05) : Math.max(0.01, cents(sell * 0.95));
}

export interface Holding {
  companyId: string;
  quantity: number;
  /** Shares held for open sell orders. */
  reserved: number;
  /** What the shares held cost, commissions included (average cost). */
  cost: number;
}

/** Shares an account holds, from its trades, and those its open sell orders hold. */
export function holdings(
  trades: readonly MarketTrade[],
  orders: readonly MarketOrder[],
): Holding[] {
  const by = new Map<string, Holding>();
  const of = (companyId: string) => {
    let h = by.get(companyId);
    if (!h) by.set(companyId, (h = { companyId, quantity: 0, reserved: 0, cost: 0 }));
    return h;
  };
  for (const t of [...trades].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const h = of(t.companyId);
    if (t.side === "buy") {
      h.cost += t.amount + t.commission;
      h.quantity += t.quantity;
    } else {
      const average = h.quantity > 0 ? h.cost / h.quantity : 0;
      h.cost -= average * t.quantity;
      h.quantity -= t.quantity;
    }
  }
  for (const o of orders)
    if (o.status === "open" && o.side === "sell") of(o.companyId).reserved += o.quantity;
  return [...by.values()].filter((h) => h.quantity > 0 || h.reserved > 0);
}

/** Cash of an account once its trades and open orders count. */
export function accountCash(
  movements: readonly CashMovement[],
  trades: readonly MarketTrade[],
  orders: readonly MarketOrder[],
): { balance: number; pending: number; reserved: number; available: number } {
  const cash = cashBalance(movements);
  let balance = cash.balance;
  for (const t of trades)
    balance += t.side === "buy" ? -(t.amount + t.commission) : t.amount - t.commission;
  for (const o of orders) balance -= o.feesPaid;
  const reserved = orders
    .filter((o) => o.status === "open" && o.side === "buy")
    .reduce((sum, o) => sum + o.reserved, 0);
  return { balance, pending: cash.pending, reserved, available: balance - cash.pending - reserved };
}

/** A listed corporation as the close of a session reads it. */
export interface FixingInput {
  companyId: string;
  shares: number;
  /** KNX price per share at the closing report. */
  reference: number;
  /** Premium fixed at the previous session; 0 at the first. */
  previousPremium: number;
}

/** Prices the close of a session fixes, from the open orders. */
export function fixingPlan(
  inputs: readonly FixingInput[],
  orders: readonly MarketOrder[],
  params: ValuationParams,
): SessionPrice[] {
  return inputs.map((input) => {
    let demand = 0;
    let supply = 0;
    for (const o of orders) {
      if (o.status !== "open" || o.companyId !== input.companyId) continue;
      if (o.side === "buy") demand += o.quantity;
      else supply += o.quantity;
    }
    const premium = nextPremium(input.previousPremium, demand, supply, input.shares, params);
    return {
      companyId: input.companyId,
      shares: input.shares,
      reference: cents(input.reference),
      premium,
      ...sidePrices(input.reference, premium, params),
      demand,
      supply,
    };
  });
}

/** Premium of each corporation at the latest closed session. */
export function lastPremiums(sessions: readonly MarketSession[]): Map<string, number> {
  const out = new Map<string, number>();
  const closed = sessions
    .filter((s) => s.status === "closed")
    .sort((a, b) => (a.closedOn ?? "").localeCompare(b.closedOn ?? ""));
  for (const s of closed) for (const p of s.prices) out.set(p.companyId, p.premium);
  return out;
}

/** A corporation's price at one closed session. */
export interface FixingPoint {
  date: IsoDate;
  reference: number;
  premium: number;
  price: number;
  /** The price read with today's share count: divisions and consolidations never jump. */
  adjusted: number;
  demand: number;
  supply: number;
}

/** Fixing prices of a corporation, oldest first, adjusted to its share count today. */
export function fixingHistory(
  sessions: readonly MarketSession[],
  companyId: string,
  sharesToday: number,
): FixingPoint[] {
  const out: FixingPoint[] = [];
  for (const s of sessions) {
    if (s.status !== "closed" || !s.closedOn) continue;
    const p = s.prices.find((x) => x.companyId === companyId);
    if (!p) continue;
    out.push({
      date: s.closedOn,
      reference: p.reference,
      premium: p.premium,
      price: p.price,
      adjusted: sharesToday > 0 ? (p.price * p.shares) / sharesToday : p.price,
      demand: p.demand,
      supply: p.supply,
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Longest life of an order, in sessions. */
export const MAX_SESSIONS = 4;

/** Fee charged when an unfilled order moves to the next session: at least one credit. */
export function carryFee(quantity: number, limit: number, params: ValuationParams): number {
  return Math.max(1, Math.ceil(quantity * limit * params.carryFee));
}

/** What a public ranking entry carries: the site values the shares at today's KNX price. */
export interface RankingEntry {
  key: string;
  displayName: string;
  /** Deposits minus withdrawals paid. */
  invested: number;
  cash: number;
  positions: { companyId: string; quantity: number }[];
}

export interface RankedInvestor {
  key: string;
  displayName: string;
  wealth: number;
  invested: number;
  /** wealth ÷ invested − 1; null with nothing invested. */
  performance: number | null;
}

/** Investors who chose to be ranked, best performance first. */
export function rankInvestors(entries: readonly RankingEntry[], market: Market): RankedInvestor[] {
  return entries
    .map((e) => {
      let wealth = e.cash;
      for (const p of e.positions)
        wealth += p.quantity * (market.byId.get(p.companyId)?.valuation?.listing?.price ?? 0);
      return {
        key: e.key,
        displayName: e.displayName,
        wealth,
        invested: e.invested,
        performance: e.invested > 0 ? wealth / e.invested - 1 : null,
      };
    })
    .sort(
      (a, b) =>
        (b.performance ?? -Infinity) - (a.performance ?? -Infinity) ||
        a.displayName.localeCompare(b.displayName, "fr"),
    );
}

/** Why an order cannot be placed, in the player's words; null when it can. */
export function orderProblem(
  side: OrderSide,
  quantity: number,
  limit: number,
  free: { cash: number; shares: number },
  params: ValuationParams,
): string | null {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY)
    return "nombre de titres entier, d'au moins 1";
  if (!(limit > 0) || cents(limit) !== limit) return "prix limite positif, au centième près";
  if (side === "buy" && reservationFor(quantity, limit, params) > free.cash)
    return "crédits disponibles insuffisants pour cet ordre";
  if (side === "sell" && quantity > free.shares)
    return "vous ne détenez pas assez de titres libres";
  return null;
}

/** Corporations a player may trade now: listed, priced, not one they are an insider of. */
export function tradable(market: Market, account: InvestorAccount): CompanySeries[] {
  return market.companies
    .filter(
      (c) =>
        c.status !== "delisted" &&
        c.valuation?.listing?.state === "listed" &&
        c.valuation.listing.price !== null &&
        !account.insiderOf.includes(c.profileId),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
