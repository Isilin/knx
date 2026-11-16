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
 * A corporation may also issue new shares (a capital increase) and pay dividends, announced during
 * a session and paid at its close, before the auction.
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
  /** A corporation buying back its shares from a frozen account, outside the auction. */
  buyback?: boolean;
}

/**
 * Shares given to an account outside a trade: a corporation's endowment, a division's adjustment,
 * the new shares of a capital increase (to the corporation, which sells them at once), a
 * transmission from a frozen account (taken from one account, given to another).
 */
export interface ShareIssue {
  id: string;
  companyId: string;
  accountId: string;
  quantity: number;
  reason: "endowment" | "split" | "reverse_split" | "capital_increase" | "transfer";
  createdAt: string;
}

/** A sale of shares the corporation holds, or an issue of new ones (a capital increase). */
export type OfferKind = "sale" | "issue";

export const OFFER_KIND_INFO: Record<OfferKind, { label: string; short: string; help: string }> = {
  sale: {
    label: "Vente de titres détenus",
    short: "vente",
    help: "La corporation vend des titres qu'elle détient : le nombre de titres ne change pas.",
  },
  issue: {
    label: "Émission de titres nouveaux (augmentation de capital)",
    short: "émission",
    help: "Les titres souscrits sont créés à la clôture : les détenteurs actuels sont dilués, les fonds levés vont à la corporation. Le cours KNX baisse d'autant tant que ces fonds ne sont pas versés à la corporation en jeu.",
  },
};

/** A corporation selling shares at a set price, during one session. */
export interface MarketOffer {
  id: string;
  kind: OfferKind;
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
      const h = of(e.issue.companyId);
      // Shares handed over leave with their share of the cost, like a sale; a division changes
      // the count, not the cost; shares received cost nothing.
      if (e.issue.reason === "transfer" && e.issue.quantity < 0) {
        const average = h.quantity > 0 ? h.cost / h.quantity : 0;
        h.cost -= average * -e.issue.quantity;
      }
      h.quantity += e.issue.quantity;
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

/**
 * Cash of an account once its trades, open orders, carry fees and dividends count: those it
 * received, and, for a corporation, those it paid or announced.
 */
export function accountCash(
  movements: readonly CashMovement[],
  trades: readonly MarketTrade[],
  orders: readonly MarketOrder[],
  received: readonly DividendPayment[] = [],
  announced: readonly Dividend[] = [],
): { balance: number; pending: number; reserved: number; available: number } {
  const cash = cashBalance(movements);
  let balance = cash.balance;
  for (const t of trades)
    balance += t.side === "buy" ? -(t.amount + t.commission) : t.amount - t.commission;
  for (const o of orders) balance -= o.feesPaid;
  for (const p of received) balance += p.amount;
  let reserved = orders
    .filter((o) => o.status === "open" && o.side === "buy")
    .reduce((sum, o) => sum + o.reserved, 0);
  for (const d of announced) {
    if (d.status === "paid") balance -= d.total;
    if (d.status === "declared") reserved += d.total;
  }
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
  context: {
    kind: OfferKind;
    totalShares: number;
    /** Shares the corporation holds and has not offered yet (a sale only). */
    freeShares: number;
    reference: number | null;
  },
  params: ValuationParams,
): string | null {
  if (!Number.isInteger(shares) || shares < 1) return "nombre de titres entier, d'au moins 1";
  const most = Math.floor(params.maxOffer * context.totalShares);
  if (shares > most) return `au plus ${most} titres par offre`;
  if (context.kind === "sale" && shares > context.freeShares)
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

/** What a corporation does with its profits, as its direction announces it. */
export type DividendPolicyKind = "accumulating" | "distributing" | "other" | "none";

export const DIVIDEND_POLICY_INFO: Record<DividendPolicyKind, { label: string; help: string }> = {
  accumulating: {
    label: "Accumulation",
    help: "La corporation garde ses bénéfices pour grandir : pas de dividende, la valeur du titre doit en profiter.",
  },
  distributing: {
    label: "Distribution",
    help: "La corporation verse une partie de ses bénéfices en dividendes, annoncés à une séance.",
  },
  other: {
    label: "Autre",
    help: "Une politique propre, décrite par la direction.",
  },
  none: {
    label: "Aucune",
    help: "La corporation n'a rien annoncé : pas de dividende.",
  },
};

export const DIVIDEND_POLICIES = Object.keys(DIVIDEND_POLICY_INFO) as DividendPolicyKind[];

/** A policy decided on a date; the latest is in force. */
export interface DividendPolicy {
  id: string;
  companyId: string;
  decidedOn: IsoDate;
  policy: DividendPolicyKind;
  note: string | null;
}

/** Policies of a corporation, oldest first; the last one is in force. */
export function policyHistory(
  policies: readonly DividendPolicy[],
  companyId: string,
): DividendPolicy[] {
  return policies
    .filter((p) => p.companyId === companyId)
    .sort((a, b) => a.decidedOn.localeCompare(b.decidedOn) || Number(a.id) - Number(b.id));
}

/** The policy in force: the latest decided; "none" while nothing was announced. */
export function policyOf(
  policies: readonly DividendPolicy[],
  companyId: string,
): DividendPolicyKind {
  return policyHistory(policies, companyId).at(-1)?.policy ?? "none";
}

/** Policies under which a dividend can be announced. */
export function paysDividends(policy: DividendPolicyKind): boolean {
  return policy === "distributing" || policy === "other";
}

export type DividendStatus = "declared" | "paid" | "cancelled";

export const DIVIDEND_STATUS_LABELS: Record<DividendStatus, string> = {
  declared: "annoncé, versé à la clôture",
  paid: "versé",
  cancelled: "retiré",
};

/** A dividend announced during a session and paid at its close. */
export interface Dividend {
  id: string;
  companyId: string;
  /** The corporation's account, which pays. */
  accountId: string;
  sessionId: string;
  perShare: number;
  status: DividendStatus;
  /** Shares served; forecast while announced. */
  shares: number;
  /** Credits held while announced, then paid. */
  total: number;
  note: string | null;
  /** Why an announced dividend was not paid. */
  reason: string | null;
  paidOn: IsoDate | null;
  createdAt: string;
}

/** What one investor received from a dividend. */
export interface DividendPayment {
  id: string;
  dividendId: string;
  accountId: string;
  shares: number;
  amount: number;
  createdAt: string;
}

/** What a holder receives: shares × dividend per share, rounded down to the credit. */
export function dividendAmount(shares: number, perShare: number): number {
  const hundredths = Math.round(perShare * 100);
  const product = shares * hundredths;
  if (Number.isSafeInteger(product)) return Math.floor(product / 100);
  return Number((BigInt(shares) * BigInt(hundredths)) / 100n);
}

/** Investors holding shares of a corporation, corporations' own accounts left out. */
export function holdersOf(
  companyId: string,
  trades: readonly MarketTrade[],
  issues: readonly ShareIssue[],
  corporations: ReadonlySet<string>,
): { accountId: string; quantity: number }[] {
  const by = new Map<string, number>();
  for (const i of issues)
    if (i.companyId === companyId) by.set(i.accountId, (by.get(i.accountId) ?? 0) + i.quantity);
  for (const t of trades)
    if (t.companyId === companyId)
      by.set(
        t.accountId,
        (by.get(t.accountId) ?? 0) + (t.side === "buy" ? t.quantity : -t.quantity),
      );
  return [...by]
    .filter(([accountId, quantity]) => quantity > 0 && !corporations.has(accountId))
    .map(([accountId, quantity]) => ({ accountId, quantity }));
}

/** Shares a dividend serves and what it costs the corporation. */
export function dividendCost(
  holders: readonly { quantity: number }[],
  perShare: number,
): { shares: number; total: number } {
  let shares = 0;
  let total = 0;
  for (const h of holders) {
    shares += h.quantity;
    total += dividendAmount(h.quantity, perShare);
  }
  return { shares, total };
}

/** Why a dividend cannot be announced, in the operator's words; null when it can. */
export function dividendProblem(
  perShare: number,
  context: { policy: DividendPolicyKind; shares: number; total: number; available: number },
): string | null {
  if (!paysDividends(context.policy))
    return "la politique de la corporation ne prévoit pas de dividende : changez-la d'abord";
  if (!(perShare > 0) || cents(perShare) !== perShare)
    return "dividende par titre positif, au centième près";
  if (context.shares === 0) return "aucun investisseur ne détient de titres de cette corporation";
  if (context.total === 0) return "dividende trop faible : aucun détenteur ne recevrait un crédit";
  if (context.total > context.available)
    return `ce dividende coûte ${context.total} crédits ; la corporation n'en a que ${context.available} de disponibles`;
  return null;
}

/** Why shares or credits leave a frozen account for another. */
export type TransferReason = "succession" | "confiscation" | "other";

export const TRANSFER_REASON_INFO: Record<TransferReason, { label: string; help: string }> = {
  succession: { label: "Succession", help: "À un héritier désigné en RP." },
  confiscation: {
    label: "Confiscation",
    help: "À l'Empire (ou au compte que la décision désigne) : saisie de la DAI, succession sans héritier.",
  },
  other: { label: "Autre", help: "Une décision RP particulière, décrite dans la note." },
};

/** Shares of one corporation and/or credits handed over from a frozen account. */
export interface AccountTransfer {
  id: string;
  fromAccount: string;
  toAccount: string;
  companyId: string | null;
  quantity: number | null;
  amount: number | null;
  reason: TransferReason;
  note: string | null;
  createdAt: string;
}

/** Why a transmission cannot be made, in the operator's words; null when it can. */
export function transferProblem(
  draft: { toAccount: string | null; quantity: number | null; amount: number | null },
  free: { shares: number; cash: number },
): string | null {
  if (!draft.toAccount) return "choisissez le compte qui reçoit";
  if (draft.quantity === null && draft.amount === null) return "rien à transmettre";
  if (draft.quantity !== null) {
    if (!Number.isInteger(draft.quantity) || draft.quantity < 1)
      return "nombre de titres entier, d'au moins 1";
    if (draft.quantity > free.shares)
      return `le compte gelé n'a que ${free.shares} titres libres de cette corporation`;
  }
  if (draft.amount !== null) {
    if (!Number.isInteger(draft.amount) || draft.amount < 1) return "montant entier, d'au moins 1";
    if (draft.amount > free.cash) return `le compte gelé n'a que ${free.cash} crédits disponibles`;
  }
  return null;
}
