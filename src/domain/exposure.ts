import type { Market } from "./market.ts";
import type { MarketTrade } from "./trading.ts";

/**
 * What the Banque impériale, as market maker, stands to pay the players: the shares they hold at
 * today's KNX price, against what they paid. Their latent gains are the house's latent loss.
 */
export interface CompanyExposure {
  companyId: string;
  /** Shares the players hold together. */
  held: number;
  /** Their share of the corporation's shares (the cap applies to it). */
  share: number | null;
  /** At today's KNX price. */
  value: number | null;
  /** What the players paid for the shares they still hold (average cost, commissions in). */
  cost: number;
}

export interface HouseExposure {
  companies: CompanyExposure[];
  /** Credits the house took from buyers minus what it paid sellers, commissions in. */
  cashIn: number;
  commissions: number;
  /** Shares the players hold, at today's KNX prices. */
  owed: number;
  /** owed − cost of those shares: positive, the players gain and the house loses. */
  playersGain: number;
}

export function houseExposure(market: Market, trades: readonly MarketTrade[]): HouseExposure {
  const by = new Map<string, { held: number; cost: number }>();
  let cashIn = 0;
  let commissions = 0;
  const ordered = [...trades].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  // Average cost per account and corporation, so a sale removes its own share of the cost.
  const positions = new Map<string, { quantity: number; cost: number }>();
  for (const t of ordered) {
    commissions += t.commission;
    cashIn += t.side === "buy" ? t.amount + t.commission : -(t.amount - t.commission);
    const key = `${t.accountId}|${t.companyId}`;
    const p = positions.get(key) ?? { quantity: 0, cost: 0 };
    if (t.side === "buy") {
      p.cost += t.amount + t.commission;
      p.quantity += t.quantity;
    } else {
      const average = p.quantity > 0 ? p.cost / p.quantity : 0;
      p.cost -= average * t.quantity;
      p.quantity -= t.quantity;
    }
    positions.set(key, p);
  }
  for (const [key, p] of positions) {
    const companyId = key.split("|")[1];
    const entry = by.get(companyId) ?? { held: 0, cost: 0 };
    entry.held += p.quantity;
    entry.cost += p.cost;
    by.set(companyId, entry);
  }
  let owed = 0;
  let cost = 0;
  const companies = [...by.entries()]
    .filter(([, e]) => e.held > 0)
    .map(([companyId, e]): CompanyExposure => {
      const listing = market.byId.get(companyId)?.valuation?.listing ?? null;
      const value = listing?.price != null ? listing.price * e.held : null;
      owed += value ?? 0;
      cost += e.cost;
      return {
        companyId,
        held: e.held,
        share: listing ? e.held / listing.shares : null,
        value,
        cost: e.cost,
      };
    })
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  return { companies, cashIn, commissions, owed, playersGain: owed - cost };
}
