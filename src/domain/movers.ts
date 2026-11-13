import type { CompanySeries, Market } from "./market.ts";

export interface Movers {
  /** Earned more per day than their lifetime average over the last period. */
  up: CompanySeries[];
  /** Earned something, but less than their lifetime average. */
  down: CompanySeries[];
  /** No measurable revenue over the last period (within rounding). */
  silent: CompanySeries[];
  /** Gained places in the ranking. */
  climbers: CompanySeries[];
}

/** Who moved between the two latest reports. */
export function computeMovers(market: Market, limit = 5): Movers {
  const current = market.companies.filter(
    (c) =>
      c.status === "active" &&
      c.previous?.date === market.facts.previousDate &&
      c.latest.performance !== null,
  );
  const earning = current.filter((c) => (c.latest.realDaily ?? 0) > (c.latest.realDailyNoise ?? 0));
  const silent = current.filter((c) => (c.latest.realDaily ?? 0) <= (c.latest.realDailyNoise ?? 0));
  const byPerformance = [...earning].sort(
    (a, b) => (b.latest.performance ?? 0) - (a.latest.performance ?? 0),
  );
  return {
    up: byPerformance.filter((c) => (c.latest.performance ?? 0) > 0).slice(0, limit),
    down: byPerformance
      .filter((c) => (c.latest.performance ?? 0) < 0)
      .reverse()
      .slice(0, limit),
    silent: silent.sort((a, b) => a.latest.rank - b.latest.rank),
    climbers: market.companies
      .filter((c) => (c.rankChange ?? 0) > 0)
      .sort((a, b) => (b.rankChange ?? 0) - (a.rankChange ?? 0))
      .slice(0, limit),
  };
}
