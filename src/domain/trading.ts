import { cashBalance, type CashMovement, type InvestorAccount } from "./investors.ts";
import type { CompanySeries, Market } from "./market.ts";
import type { IsoDate } from "./types.ts";
import type { ValuationParams } from "./valuation.ts";

/**
 * The weekly market of the Bourse (model C). Every share belongs to an account: at its first
 * offer, a corporation receives all its shares and sells part of them to the investors, who
 * subscribe during a session. Afterwards, shares change hands between investors only: at the
 * close of each session (an heptade), one auction per corporation fixes the price that meets
 * the most shares between buy and sell limit orders; ties go to the least imbalance, then to the
 * price nearest the KNX price, then to the lower. The exchange keeps a commission on both sides.
 *
 * The database runs the close; this module mirrors it for the previews and the tests. Prices are
 * in credits to the hundredth; amounts settle in whole credits.
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
  /** A subscription to this offer; null on the secondary market. */
  offerId: string | null;
}

export interface MarketTrade {
  id: string;
  sessionId: string;
  /** Null on the corporation's side of an offer. */
  orderId: string | null;
  offerId: string | null;
  accountId: string;
  companyId: string;
  side: OrderSide;
  quantity: number;
  /** Price per share, before commission. */
  price: number;
  /** Quantity × price, in whole credits. */
  amount: number;
  commission: number;
  createdAt: string;
}

/** Shares given to an account outside a trade: a corporation's endowment, a division's adjustment. */
export interface ShareIssue {
  id: string;
  companyId: string;
  accountId: string;
  quantity: number;
  reason: "endowment" | "split" | "reverse_split";
  createdAt: string;
}

/** A corporation selling part of its shares at a set price, during one session. */
export interface MarketOffer {
  id: string;
  companyId: string;
  /** The corporation's account, which receives the proceeds. */
  accountId: string;
  sessionId: string;
  sharesOffered: number;
  price: number;
  status: "open" | "closed" | "cancelled";
  allocated: number;
  /** Credits the corporation received, commission deducted. */
  proceeds: number;
  note: string | null;
  createdAt: string;
}

/** What the close of a session fixed for one corporation that traded. */
export interface SessionPrice {
  companyId: string;
  shares: number;
  /** KNX price per share at the report the session closed on. */
  reference: number;
  /** Fixing price ÷ KNX price − 1. */
  premium: number;
  price: number;
  buy: number;
  sell: number;
  /** Shares asked and offered at the fixing price. */
  demand: number;
  supply: number;
  /** Shares that changed hands. */
  volume: number;
}

export interface MarketSession {
  id: string;
  openedOn: IsoDate;
  closedOn: IsoDate | null;
  /** Report whose KNX values the close read. */
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
/** Longest life of an order, in sessions. */
export const MAX_SESSIONS = 4;

const cents = (value: number) => Math.round(value * 100) / 100;

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

/** Fee charged when an unfilled order moves to the next session: at least one credit. */
export function carryFee(quantity: number, limit: number, params: ValuationParams): number {
  return Math.max(1, Math.ceil(quantity * limit * params.carryFee));
}

/** A limit KNX suggests: 5 % above (buy) or below (sell) the KNX price, to the hundredth. */
export function suggestedLimit(side: OrderSide, reference: number): number {
  return side === "buy" ? cents(reference * 1.05) : Math.max(0.01, cents(reference * 0.95));
}

export interface Holding {
  companyId: string;
  quantity: number;
  /** Shares held for open sell orders. */
  reserved: number;
  /** What the shares held cost, commissions included (average cost); 0 for an endowment. */
  cost: number;
}

/** Shares an account holds (issues and trades), and those its open sell orders hold. */
export function holdings(
  trades: readonly MarketTrade[],
  orders: readonly MarketOrder[],
  issues: readonly ShareIssue[] = [],
): Holding[] {
  const by = new Map<string, Holding>();
  const of = (companyId: string) => {
    let h = by.get(companyId);
    if (!h) by.set(companyId, (h = { companyId, quantity: 0, reserved: 0, cost: 0 }));
    return h;
  };
  const events = [
    ...issues.map((i) => ({ at: i.createdAt, issue: i, trade: null })),
    ...trades.map((t) => ({ at: t.createdAt, issue: null, trade: t })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  for (const e of events) {
    if (e.issue) {
      // A division changes the count, not the cost.
      of(e.issue.companyId).quantity += e.issue.quantity;
      continue;
    }
    const t = e.trade;
    if (!t) continue;
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

/** Cash of an account once its trades, open orders and carry fees count. */
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

/** The auction of one corporation: the price, the shares it meets, demand and supply there. */
export interface Clearing {
  price: number;
  volume: number;
  demand: number;
  supply: number;
}

/**
 * The fixing price among the limits of the open orders: the most shares met, then the least
 * imbalance, then the nearest to the KNX price, then the lower. Null when nothing meets.
 */
export function clearingPrice(
  orders: readonly Pick<MarketOrder, "side" | "quantity" | "limitPrice">[],
  reference: number | null,
): Clearing | null {
  let best: Clearing | null = null;
  const candidates = [...new Set(orders.map((o) => o.limitPrice))];
  for (const price of candidates) {
    let demand = 0;
    let supply = 0;
    for (const o of orders) {
      if (o.side === "buy" && o.limitPrice >= price) demand += o.quantity;
      if (o.side === "sell" && o.limitPrice <= price) supply += o.quantity;
    }
    const volume = Math.min(demand, supply);
    if (volume === 0) continue;
    const gap = Math.abs(demand - supply);
    const distance = (p: number) => Math.abs(p - (reference ?? p));
    if (
      !best ||
      volume > best.volume ||
      (volume === best.volume &&
        (gap < Math.abs(best.demand - best.supply) ||
          (gap === Math.abs(best.demand - best.supply) &&
            (distance(price) < distance(best.price) ||
              (distance(price) === distance(best.price) && price < best.price)))))
    )
      best = { price, volume, demand, supply };
  }
  return best;
}

/**
 * Shares each subscription receives from an offer: all of them when the offer suffices, pro rata
 * (rounded down) otherwise, the shares left by the rounding going one each to the earliest.
 */
export function allocateOffer(
  subscriptions: readonly Pick<MarketOrder, "id" | "quantity" | "createdAt">[],
  offered: number,
): Map<string, number> {
  const ordered = [...subscriptions].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  const total = ordered.reduce((sum, s) => sum + s.quantity, 0);
  const out = new Map<string, number>();
  let left = Math.min(total, offered);
  for (const s of ordered) {
    const share = total <= offered ? s.quantity : Math.floor((s.quantity * offered) / total);
    const q = Math.min(share, left);
    out.set(s.id, q);
    left -= q;
  }
  for (const s of ordered) {
    if (left <= 0) break;
    const q = out.get(s.id) ?? 0;
    if (q < s.quantity) {
      out.set(s.id, q + 1);
      left -= 1;
    }
  }
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
  volume: number;
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
      adjusted: sharesToday > 0 && p.shares > 0 ? (p.price * p.shares) / sharesToday : p.price,
      demand: p.demand,
      supply: p.supply,
      volume: p.volume,
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
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

/** Why an offer cannot be opened, in the operator's words; null when it can. */
export function offerProblem(
  shares: number,
  price: number,
  context: { totalShares: number; freeShares: number; reference: number | null },
  params: ValuationParams,
): string | null {
  if (!Number.isInteger(shares) || shares < 1) return "nombre de titres entier, d'au moins 1";
  const most = Math.floor(params.maxOffer * context.totalShares);
  if (shares > most) return `au plus ${most} titres par offre`;
  if (shares > context.freeShares)
    return `la corporation ne détient que ${context.freeShares} titres libres`;
  if (!(price > 0) || cents(price) !== price) return "prix positif, au centième près";
  if (context.reference !== null) {
    const low = context.reference * (1 - params.offerBand);
    const high = context.reference * (1 + params.offerBand);
    if (price < low - 1e-9 || price > high + 1e-9)
      return `prix entre ${cents(low)} et ${cents(high)} ¢ (bande autour du cours KNX)`;
  }
  return null;
}
