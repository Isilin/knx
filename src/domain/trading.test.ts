import { describe, expect, it } from "vite-plus/test";
import type { CashMovement } from "./investors.ts";
import {
  accountCash,
  fixingPlan,
  holdings,
  lastPremiums,
  nextPremium,
  orderProblem,
  premiumDecay,
  reservationFor,
  sidePrices,
  suggestedLimit,
  tradeAmounts,
  type MarketOrder,
  type MarketSession,
  type MarketTrade,
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
    accountId: "a",
    companyId: "c",
    amount,
    commission,
    createdAt: `2026-11-15T11:00:${String(seq).padStart(2, "0")}Z`,
    ...o,
  };
};

describe("premium and prices", () => {
  it("moves with net demand, fades by its half-life, stays in its band", () => {
    expect(premiumDecay(P)).toBeCloseTo(Math.SQRT1_2, 9);
    // 1 000 net shares bought out of 20 000 at sensitivity 0.5: +2.5 %.
    expect(nextPremium(0, 1500, 500, 20_000, P)).toBeCloseTo(0.025, 9);
    expect(nextPremium(0.1, 0, 0, 20_000, P)).toBeCloseTo(0.1 * Math.SQRT1_2, 9);
    expect(nextPremium(0, 50_000, 0, 20_000, P)).toBe(P.premiumBand);
    expect(nextPremium(0, 0, 50_000, 20_000, P)).toBe(-P.premiumBand);
  });

  it("splits the spread around the fixing price, to the hundredth", () => {
    expect(sidePrices(1000, 0.1, P)).toEqual({ price: 1100, buy: 1111, sell: 1089 });
    // A tiny price keeps its spread: the buy rounds up, the sell down.
    expect(sidePrices(0.5, 0, P)).toEqual({ price: 0.5, buy: 0.51, sell: 0.49 });
  });

  it("charges the commission on whole credits, and holds enough for a buy", () => {
    expect(tradeAmounts(3, 333.33, P)).toEqual({ amount: 1000, commission: 10 });
    expect(reservationFor(10, 1111, P)).toBe(11_110 + 112);
  });

  it("suggests limits that fill an ordinary order", () => {
    const { buy, sell } = sidePrices(1000, 0, P);
    expect(suggestedLimit("buy", 1000, 0, P)).toBeGreaterThan(buy);
    expect(suggestedLimit("sell", 1000, 0, P)).toBeLessThan(sell);
  });
});

describe("accounts on the market", () => {
  it("keeps shares at average cost and holds those offered for sale", () => {
    const trades = [
      trade({ side: "buy", quantity: 10, price: 100 }),
      trade({ side: "buy", quantity: 10, price: 200 }),
      trade({ side: "sell", quantity: 5, price: 300 }),
    ];
    const [h] = holdings(trades, [order({ side: "sell", quantity: 4 })]);
    expect(h.quantity).toBe(15);
    expect(h.reserved).toBe(4);
    // Cost 1010 + 2020 for 20 shares; 5 sold at the average cost leave 15 × 151,5.
    expect(h.cost).toBeCloseTo(15 * ((1010 + 2020) / 20), 6);
  });

  it("counts trades and open buy orders in the cash", () => {
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
      order({ side: "buy", quantity: 1, reserved: 999, status: "cancelled" }),
    ];
    expect(accountCash(movements, trades, orders)).toEqual({
      balance: 100_000 - 10_100,
      pending: 0,
      reserved: 6000,
      available: 100_000 - 10_100 - 6000,
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

describe("session close", () => {
  it("fixes each listed corporation from its open orders and last premium", () => {
    const orders = [
      order({ side: "buy", quantity: 600 }),
      order({ side: "sell", quantity: 200 }),
      order({ side: "buy", quantity: 900, status: "cancelled" }),
      order({ side: "buy", quantity: 50, companyId: "other" }),
    ];
    const [p] = fixingPlan(
      [{ companyId: "c", shares: 20_000, reference: 1000, previousPremium: 0.02 }],
      orders,
      P,
    );
    expect(p.demand).toBe(600);
    expect(p.supply).toBe(200);
    expect(p.premium).toBeCloseTo(0.02 * Math.SQRT1_2 + 0.01, 9);
    expect(p.price).toBeCloseTo(1000 * (1 + p.premium), 2);
  });

  it("reads each corporation's premium from the latest closed session", () => {
    const session = (id: string, closedOn: string | null, premium: number): MarketSession => ({
      id,
      openedOn: "2026-11-01",
      closedOn,
      reportDate: closedOn,
      status: closedOn ? "closed" : "open",
      prices: [
        {
          companyId: "c",
          shares: 1,
          reference: 1,
          premium,
          price: 1,
          buy: 1,
          sell: 1,
          demand: 0,
          supply: 0,
        },
      ],
    });
    const premiums = lastPremiums([
      session("2", "2026-11-14", 0.05),
      session("1", "2026-11-07", 0.2),
      session("3", null, 0.9),
    ]);
    expect(premiums.get("c")).toBe(0.05);
  });
});
