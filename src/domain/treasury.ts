import type { CompanyPoint, Market } from "./market.ts";
import type { IsoDate } from "./types.ts";

/**
 * How a company's capital went from one report to another over a period:
 *   capital at start + revenue earned − wages + other flows = capital at end.
 * Capital is published; revenue, wages and the remainder are estimated by KNX.
 */
export interface TreasuryBridge {
  start: { date: IsoDate; capital: number };
  end: { date: IsoDate; capital: number };
  /** Revenue earned between the two reports (cumulative difference). Estimated. */
  earned: number;
  /** ± rounding uncertainty on `earned` (and therefore on `otherFlow`). */
  noise: number;
  /** Wages paid over the period; null when a headcount is unknown. Estimated. */
  wages: number | null;
  /**
   * Capital change that neither revenue nor wages explain (wages left in when unknown);
   * negative = money left. Estimated.
   */
  otherFlow: number;
}

/**
 * The bridge over the reports on or after `from` (the whole history when `from` is null).
 *
 * Revenue is the difference of the two cumulative estimates rather than a sum of report-to-report
 * figures: the rounding of every intermediate `Chiffre` cancels out, only the two ends count.
 * The window is the trailing run of reports with a published capital and a positive `Chiffre`, so
 * a reset to 0 never breaks the difference.
 */
export function treasuryBridge(
  points: readonly CompanyPoint[],
  from: IsoDate | null,
): TreasuryBridge | null {
  const run: CompanyPoint[] = [];
  for (let k = points.length - 1; k >= 0; k--) {
    const p = points[k];
    if (from && p.date < from) break;
    const usable = p.capital !== null && p.cumulative !== null && p.chiffre > 0;
    if (!usable) {
      if (run.length > 0) break;
      continue;
    }
    run.unshift(p);
  }
  if (run.length < 2) return null;
  const first = run[0];
  const last = run[run.length - 1];
  const capitalStart = first.capital ?? 0;
  const capitalEnd = last.capital ?? 0;
  // Revenue is never negative; a small negative difference is rounding noise.
  const earned = Math.max(0, (last.cumulative ?? 0) - (first.cumulative ?? 0));
  const paid = run.slice(1).map((p) => p.wages);
  const wages = paid.every((w) => w !== null) ? paid.reduce((s, w) => s + (w ?? 0), 0) : null;
  return {
    start: { date: first.date, capital: capitalStart },
    end: { date: last.date, capital: capitalEnd },
    earned,
    noise: ((first.days ?? 0) + (last.days ?? 0)) / 2,
    wages,
    otherFlow: capitalEnd - capitalStart - earned + (wages ?? 0),
  };
}

export interface TreasuryFlow {
  date: IsoDate;
  previousDate: IsoDate;
  /** Capital change outside revenue and wages between the two reports. Estimated. */
  flow: number;
  noise: number;
  /**
   * Flow as a share of the money available before it: previous capital plus revenue earned in
   * between, less the wages paid (= capital after − flow). An outflow never exceeds −100 %.
   */
  share: number | null;
}

/**
 * Largest flows outside revenue and wages on or after `from`, by size, ignoring those lost in
 * rounding: withdrawals, purchases, injections.
 */
export function largestFlows(
  points: readonly CompanyPoint[],
  from: IsoDate | null,
  limit = 5,
): TreasuryFlow[] {
  const flows: TreasuryFlow[] = [];
  for (let k = 1; k < points.length; k++) {
    const p = points[k];
    const prev = points[k - 1];
    if (from && p.date < from) continue;
    if (p.otherFlow === null || Math.abs(p.otherFlow) <= (p.otherFlowNoise ?? 0)) continue;
    const available = (p.capital ?? 0) - p.otherFlow;
    flows.push({
      date: p.date,
      previousDate: prev.date,
      flow: p.otherFlow,
      noise: p.otherFlowNoise ?? 0,
      share: available > 0 ? p.otherFlow / available : null,
    });
  }
  return flows.sort((a, b) => Math.abs(b.flow) - Math.abs(a.flow)).slice(0, limit);
}

export interface MarketTreasuryPoint {
  date: IsoDate;
  /** Sum of the published capital of every company listed that day. */
  capital: number;
  /** Sum of the published headcount. */
  employees: number;
  /** Companies whose capital was published that day. */
  companies: number;
}

/** Capital and headcount of the whole listing, on every report that published them. */
export function marketTreasury(market: Market): MarketTreasuryPoint[] {
  const byDate = new Map<IsoDate, MarketTreasuryPoint>();
  for (const company of market.allLives) {
    for (const p of company.points) {
      if (p.capital === null) continue;
      const entry = byDate.get(p.date) ?? { date: p.date, capital: 0, employees: 0, companies: 0 };
      entry.capital += p.capital;
      entry.employees += p.employees ?? 0;
      entry.companies += 1;
      byDate.set(p.date, entry);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
