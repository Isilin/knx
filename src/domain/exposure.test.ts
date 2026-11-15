import { describe, expect, it } from "vite-plus/test";
import { houseExposure } from "./exposure.ts";
import type { Market } from "./market.ts";
import { tradeAmounts, type MarketTrade } from "./trading.ts";
import { DEFAULT_VALUATION } from "./valuation.ts";

let seq = 0;
const trade = (o: Pick<MarketTrade, "accountId" | "side" | "quantity" | "price">): MarketTrade => ({
  id: String(++seq),
  sessionId: "s",
  orderId: String(seq),
  companyId: "c",
  ...tradeAmounts(o.quantity, o.price, DEFAULT_VALUATION),
  createdAt: `2026-11-15T10:00:${String(seq).padStart(2, "0")}Z`,
  ...o,
});

/** Only what the exposure reads: the listing of each corporation. */
const market = {
  byId: new Map([["c", { valuation: { listing: { price: 150, shares: 1000 } } }]]),
} as unknown as Market;

describe("house exposure", () => {
  it("weighs what the players hold at today's price against what they paid", () => {
    const exposure = houseExposure(market, [
      trade({ accountId: "a", side: "buy", quantity: 100, price: 100 }),
      trade({ accountId: "b", side: "buy", quantity: 50, price: 120 }),
      trade({ accountId: "a", side: "sell", quantity: 40, price: 140 }),
    ]);
    const [c] = exposure.companies;
    expect(c.held).toBe(110);
    expect(c.share).toBeCloseTo(0.11, 9);
    expect(exposure.owed).toBe(110 * 150);
    // a keeps 60 at 101 each (commission in), b 50 at 6060 in all.
    expect(c.cost).toBeCloseTo(60 * 101 + 6060, 6);
    expect(exposure.playersGain).toBeCloseTo(110 * 150 - (60 * 101 + 6060), 6);
    // Buyers paid 10 100 + 6 060; the seller got 5 600 − 56.
    expect(exposure.cashIn).toBe(10_100 + 6060 - (5600 - 56));
    expect(exposure.commissions).toBe(100 + 60 + 56);
  });
});
