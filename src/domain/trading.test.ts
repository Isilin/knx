import { describe, expect, it } from "vite-plus/test";
import type { CashMovement } from "./investors.ts";
import {
  accountCash,
  allocateOffer,
  carryFee,
  clearingPrice,
  dividendAmount,
  dividendCost,
  dividendProblem,
  fixingHistory,
  holdersOf,
  holdings,
  offerProblem,
  policyOf,
  orderProblem,
  rankInvestors,
  reservationFor,
  suggestedLimit,
  tradeAmounts,
  type Dividend,
  type DividendPolicy,
  type MarketOrder,
  type MarketSession,
  type MarketTrade,
  type ShareIssue,
} from "./trading.ts";
import { DEFAULT_VALUATION } from "./valuation.ts";

const P = DEFAULT_VALUATION;
let seq = 0;

const order = (o: Partial<MarketOrder> & Pick<MarketOrder, "side" | "quantity">): MarketOrder => ({
  id: String(++seq),
  sessionId: "s1",
  accountId: "a",
  companyId: "c",
  limitPrice: 100,
  reserved: 0,
  status: "open",
  filledQuantity: 0,
  fillPrice: null,
  reason: null,
  createdAt: `2026-11-15T10:00:${String(seq).padStart(2, "0")}Z`,
  closedAt: null,
  sessionsLeft: 1,
  feesPaid: 0,
  offerId: null,
  ...o,
});

const trade = (
  o: Partial<MarketTrade> & Pick<MarketTrade, "side" | "quantity" | "price">,
): MarketTrade => {
  const { amount, commission } = tradeAmounts(o.quantity, o.price, P);
  return {
    id: String(++seq),
    sessionId: "s1",
    orderId: String(seq),
    offerId: null,
    accountId: "a",
    companyId: "c",
    amount,
    commission,
    createdAt: `2026-11-15T11:00:${String(seq).padStart(2, "0")}Z`,
    ...o,
  };
};

describe("amounts", () => {
  it("charges the commission on whole credits, and holds enough for a buy", () => {
    expect(tradeAmounts(3, 333.33, P)).toEqual({ amount: 1000, commission: 10 });
    expect(reservationFor(10, 1111, P)).toBe(11_110 + 112);
  });

  it("suggests limits 5 % around the KNX price", () => {
    expect(suggestedLimit("buy", 1000)).toBe(1050);
    expect(suggestedLimit("sell", 1000)).toBe(950);
    expect(suggestedLimit("sell", 0.01)).toBe(0.01);
  });

  it("charges at least one credit to carry an order", () => {
    expect(carryFee(10, 1000, P)).toBe(20);
    expect(carryFee(1, 0.5, P)).toBe(1);
  });
});

describe("auction", () => {
  it("fixes the price that meets the most shares", () => {
    const clearing = clearingPrice(
      [
        order({ side: "buy", quantity: 100, limitPrice: 110 }),
        order({ side: "buy", quantity: 50, limitPrice: 100 }),
        order({ side: "sell", quantity: 80, limitPrice: 95 }),
        order({ side: "sell", quantity: 100, limitPrice: 105 }),
      ],
      100,
    );
    // At 105: 100 asked, 180 offered → 100 meet; at 100 or 95: 150 asked, 80 offered → 80.
    expect(clearing).toEqual({ price: 105, volume: 100, demand: 100, supply: 180 });
  });

  it("breaks ties by imbalance, then by the KNX price, then by the lower price", () => {
    const orders = [
      order({ side: "buy", quantity: 10, limitPrice: 120 }),
      order({ side: "sell", quantity: 10, limitPrice: 80 }),
    ];
    // Both limits meet 10 shares with no imbalance: the nearest to the KNX price wins.
    expect(clearingPrice(orders, 115)?.price).toBe(120);
    expect(clearingPrice(orders, 90)?.price).toBe(80);
    // Equidistant: the lower.
    expect(clearingPrice(orders, 100)?.price).toBe(80);
  });

  it("finds nothing when buyers bid under every seller", () => {
    const orders = [
      order({ side: "buy", quantity: 10, limitPrice: 90 }),
      order({ side: "sell", quantity: 10, limitPrice: 100 }),
    ];
    expect(clearingPrice(orders, 95)).toBeNull();
  });
});

describe("offers", () => {
  it("serves everyone when the offer suffices", () => {
    const subs = [order({ side: "buy", quantity: 30 }), order({ side: "buy", quantity: 20 })];
    expect([...allocateOffer(subs, 100).values()]).toEqual([30, 20]);
  });

  it("shares an exceeded offer pro rata, the rounding left to the earliest", () => {
    const subs = [
      order({ side: "buy", quantity: 10 }),
      order({ side: "buy", quantity: 10 }),
      order({ side: "buy", quantity: 10 }),
    ];
    // 10 shares for 30 asked: 3 each, the 10th to the first.
    expect([...allocateOffer(subs, 10).values()]).toEqual([4, 3, 3]);
  });

  it("explains an offer that cannot open", () => {
    const context = {
      kind: "sale" as const,
      totalShares: 10_000,
      freeShares: 8000,
      reference: 100,
    };
    expect(offerProblem(5000, 100, context, P)).toMatch(/au plus 4900/);
    expect(offerProblem(1000, 100, { ...context, freeShares: 500 }, P)).toMatch(
      /500 titres libres/,
    );
    expect(offerProblem(1000, 130, context, P)).toMatch(/entre 80 et 120/);
    expect(offerProblem(1000, 95, context, P)).toBeNull();
    // An issue creates its shares: the corporation needs none free, the cap still holds.
    const issue = { ...context, kind: "issue" as const, freeShares: 0 };
    expect(offerProblem(1000, 95, issue, P)).toBeNull();
    expect(offerProblem(5000, 95, issue, P)).toMatch(/au plus 4900/);
  });
});

describe("accounts on the market", () => {
  it("keeps shares at average cost, counts issues, and holds those offered for sale", () => {
    const trades = [
      trade({ side: "buy", quantity: 10, price: 100 }),
      trade({ side: "buy", quantity: 10, price: 200 }),
      trade({ side: "sell", quantity: 5, price: 300 }),
    ];
    const split: ShareIssue = {
      id: "i",
      companyId: "c",
      accountId: "a",
      quantity: 15,
      reason: "split",
      createdAt: "2026-11-15T12:00:00Z",
    };
    const [h] = holdings(trades, [order({ side: "sell", quantity: 4 })], [split]);
    // 15 shares after the trades, doubled by the division; the cost stays.
    expect(h.quantity).toBe(30);
    expect(h.reserved).toBe(4);
    expect(h.cost).toBeCloseTo(15 * ((1010 + 2020) / 20), 6);
  });

  it("counts trades, open buy orders and carry fees in the cash", () => {
    const movements: CashMovement[] = [
      {
        id: "m1",
        accountId: "a",
        kind: "deposit",
        amount: 100_000,
        status: "done",
        note: null,
        requestedAt: "2026-11-14T00:00:00Z",
        settledAt: null,
      },
    ];
    const trades = [trade({ side: "buy", quantity: 10, price: 1000 })];
    const orders = [
      order({ side: "buy", quantity: 5, reserved: 6000 }),
      order({ side: "sell", quantity: 1, status: "expired", feesPaid: 30 }),
    ];
    expect(accountCash(movements, trades, orders)).toEqual({
      balance: 100_000 - 10_100 - 30,
      pending: 0,
      reserved: 6000,
      available: 100_000 - 10_100 - 30 - 6000,
    });
  });

  it("explains an order that cannot be placed", () => {
    const free = { cash: 10_000, shares: 3 };
    expect(orderProblem("buy", 0, 100, free, P)).toMatch(/au moins 1/);
    expect(orderProblem("buy", 1, 100.005, free, P)).toMatch(/centième/);
    expect(orderProblem("buy", 100, 100, free, P)).toMatch(/insuffisants/);
    expect(orderProblem("sell", 4, 100, free, P)).toMatch(/pas assez/);
    expect(orderProblem("buy", 50, 100, free, P)).toBeNull();
  });
});

describe("history and ranking", () => {
  it("ranks volunteers by what their account is worth against what they put in", () => {
    const market = {
      byId: new Map([["c", { valuation: { listing: { price: 200, shares: 1000 } } }]]),
    } as unknown as Parameters<typeof rankInvestors>[1];
    const ranked = rankInvestors(
      [
        {
          key: "a",
          displayName: "Ilsa",
          invested: 10_000,
          cash: 2000,
          positions: [{ companyId: "c", quantity: 50 }],
        },
        { key: "b", displayName: "Moro", invested: 10_000, cash: 9000, positions: [] },
        { key: "c", displayName: "Zed", invested: 0, cash: 0, positions: [] },
      ],
      market,
    );
    expect(ranked.map((r) => r.key)).toEqual(["a", "b", "c"]);
    expect(ranked[0].performance).toBeCloseTo(0.2, 9);
    expect(ranked[2].performance).toBeNull();
  });

  it("reads a corporation's fixings with today's share count", () => {
    const session = (closedOn: string, shares: number, price: number): MarketSession => ({
      id: closedOn,
      openedOn: closedOn,
      closedOn,
      reportDate: closedOn,
      status: "closed",
      prices: [
        {
          companyId: "c",
          shares,
          reference: price,
          premium: 0,
          price,
          buy: price,
          sell: price,
          demand: 0,
          supply: 0,
          volume: 3,
        },
      ],
    });
    const history = fixingHistory(
      [session("2026-11-14", 2000, 50), session("2026-11-07", 1000, 100)],
      "c",
      2000,
    );
    expect(history.map((h) => h.date)).toEqual(["2026-11-07", "2026-11-14"]);
    // Before the 2-for-1 division, 100 ¢ for 1 000 shares reads 50 ¢ today.
    expect(history.map((h) => h.adjusted)).toEqual([50, 50]);
    expect(history[0].volume).toBe(3);
  });
});

describe("dividends", () => {
  const dividend = (d: Partial<Dividend>): Dividend => ({
    id: String(++seq),
    companyId: "c",
    accountId: "corp",
    sessionId: "s1",
    perShare: 1.5,
    status: "declared",
    shares: 0,
    total: 0,
    note: null,
    reason: null,
    paidOn: null,
    createdAt: "2026-11-15T10:00:00Z",
    ...d,
  });

  it("rounds each holder down to the credit, without float slips", () => {
    expect(dividendAmount(3, 1.5)).toBe(4);
    // 100 × 0,29 is 28,999… in floating point: computed in hundredths, it is 29.
    expect(dividendAmount(100, 0.29)).toBe(29);
    expect(dividendAmount(1, 0.99)).toBe(0);
    // Past the safe integers, the product goes through BigInt.
    expect(dividendAmount(1_000_000_000_000, 999.99)).toBe(999_990_000_000_000);
  });

  it("pays the investors holding shares, never the corporation itself", () => {
    const issues: ShareIssue[] = [
      {
        id: "e",
        companyId: "c",
        accountId: "corp",
        quantity: 1000,
        reason: "endowment",
        createdAt: "2026-11-01T00:00:00Z",
      },
    ];
    const trades = [
      trade({ accountId: "corp", side: "sell", quantity: 300, price: 100 }),
      trade({ accountId: "a", side: "buy", quantity: 200, price: 100 }),
      trade({ accountId: "b", side: "buy", quantity: 100, price: 100 }),
      trade({ accountId: "b", side: "sell", quantity: 100, price: 100 }),
      trade({ accountId: "d", side: "buy", quantity: 100, price: 100 }),
      trade({ accountId: "x", companyId: "other", side: "buy", quantity: 50, price: 100 }),
    ];
    const holders = holdersOf("c", trades, issues, new Set(["corp"]));
    expect(holders).toEqual([
      { accountId: "a", quantity: 200 },
      { accountId: "d", quantity: 100 },
    ]);
    expect(dividendCost(holders, 0.75)).toEqual({ shares: 300, total: 150 + 75 });
  });

  it("holds an announced dividend, then spends it once paid", () => {
    const corp = accountCash(
      [],
      [trade({ accountId: "corp", side: "sell", quantity: 10, price: 100 })],
      [],
      [],
      [
        dividend({ status: "declared", total: 200 }),
        dividend({ status: "paid", total: 300 }),
        dividend({ status: "cancelled", total: 999 }),
      ],
    );
    // 1000 of proceeds, less 10 of commission.
    expect(corp).toEqual({
      balance: 990 - 300,
      pending: 0,
      reserved: 200,
      available: 990 - 300 - 200,
    });
    const holder = accountCash(
      [],
      [],
      [],
      [{ id: "p", dividendId: "d", accountId: "a", shares: 10, amount: 15, createdAt: "" }],
    );
    expect(holder.balance).toBe(15);
  });

  it("reads the policy in force, and explains a dividend that cannot be announced", () => {
    const policies: DividendPolicy[] = [
      { id: "2", companyId: "c", decidedOn: "2026-11-10", policy: "distributing", note: null },
      { id: "1", companyId: "c", decidedOn: "2026-10-01", policy: "accumulating", note: null },
      { id: "3", companyId: "other", decidedOn: "2026-11-12", policy: "other", note: "rachats" },
    ];
    expect(policyOf(policies, "c")).toBe("distributing");
    expect(policyOf(policies, "nobody")).toBe("none");
    const ok = { policy: "distributing" as const, shares: 300, total: 450, available: 1000 };
    expect(dividendProblem(1.5, ok)).toBeNull();
    expect(dividendProblem(1.5, { ...ok, policy: "accumulating" })).toMatch(/politique/);
    expect(dividendProblem(1.505, ok)).toMatch(/centième/);
    expect(dividendProblem(1.5, { ...ok, shares: 0, total: 0 })).toMatch(/aucun investisseur/);
    expect(dividendProblem(0.01, { ...ok, total: 0 })).toMatch(/trop faible/);
    expect(dividendProblem(1.5, { ...ok, available: 400 })).toMatch(/450 crédits/);
  });
});
