import { addDays, daysBetween } from "./dates.ts";
import { addImperialYears } from "./imperial.ts";
import type { CompanySeries } from "./market.ts";
import type { IsoDate } from "./types.ts";

/** How far KNX projects the published chiffre, in imperial years (one year = one real month). */
export const PROJECTION_YEARS = 3;

/**
 * The published `Chiffre` is cumulative revenue ÷ days of activity. If a company keeps earning
 * `rate` per day, k days after the latest report it reads
 *   chiffre(k) = (cumulative + rate·k) / (days + k),
 * which drifts toward `rate`, fast for a young company and slowly for an old one.
 */
interface Trajectory {
  cumulative: number;
  days: number;
  rate: number;
}

export function chiffreAfter(t: Trajectory, k: number): number {
  return (t.cumulative + t.rate * k) / (t.days + k);
}

export interface CompanyProjection {
  /** Revenue per day of the last 30 days, assumed to hold: the value the chiffre tends to. */
  equilibrium: number;
  /** Change of the published chiffre per day, at the latest report. */
  drift: number;
  /** Published chiffre expected on the horizon. */
  chiffre: number;
  /** Rank expected on the horizon, on the scale of the latest ranks. */
  rank: number;
  /** Places gained by the horizon (positive = climbs). */
  rankChange: number;
  /** Expected published chiffre from the latest report to the horizon. */
  path: { date: IsoDate; value: number }[];
}

export interface Crossing {
  /** The company that moves ahead… */
  passer: CompanySeries;
  /** …of this one. */
  passed: CompanySeries;
  /** Days after the latest report. */
  inDays: number;
  date: IsoDate;
}

export interface MarketProjection {
  horizon: IsoDate;
  days: number;
  /** Projections of the companies the estimate can carry (age known, recent rate measured). */
  bySlug: Map<string, CompanyProjection>;
  /** Every change of order expected before the horizon, soonest first. */
  crossings: Crossing[];
}

/**
 * Projects the published chiffre of every active company to the horizon, assuming each keeps its
 * revenue rate of the last 30 days. Companies the estimate cannot carry (unknown age, no measured
 * rate) are held at their current chiffre so the ranking stays complete.
 */
export function projectMarket(
  companies: readonly CompanySeries[],
  latestDate: IsoDate,
  years = PROJECTION_YEARS,
): MarketProjection {
  const horizon = addImperialYears(latestDate, years);
  const days = daysBetween(latestDate, horizon);
  const active = companies.filter((c) => c.status === "active");

  const entries = active.map((company) => {
    const { latest } = company;
    const projected =
      company.recentRate !== null &&
      latest.cumulative !== null &&
      latest.days !== null &&
      latest.days > 0;
    // A flat trajectory: (c + c·k) / (1 + k) = c.
    const trajectory: Trajectory = projected
      ? {
          cumulative: latest.cumulative ?? 0,
          days: latest.days ?? 1,
          rate: company.recentRate ?? 0,
        }
      : { cumulative: latest.chiffre, days: 1, rate: latest.chiffre };
    const series = Array.from({ length: days + 1 }, (_, k) => chiffreAfter(trajectory, k));
    return { company, projected, trajectory, series };
  });

  const rankAt = (k: number) => {
    const sorted = [...entries].sort(
      (a, b) => b.series[k] - a.series[k] || a.company.latest.rank - b.company.latest.rank,
    );
    return new Map(sorted.map((e, i) => [e.company.slug, i + 1]));
  };
  const now = rankAt(0);
  const then = rankAt(days);

  const step = Math.max(1, Math.round(days / 30));
  const bySlug = new Map<string, CompanyProjection>();
  for (const e of entries) {
    if (!e.projected) continue;
    const { cumulative, days: age, rate } = e.trajectory;
    const rankChange = (now.get(e.company.slug) ?? 0) - (then.get(e.company.slug) ?? 0);
    const path: { date: IsoDate; value: number }[] = [];
    for (let k = 0; k < days; k += step)
      path.push({ date: addDays(latestDate, k), value: e.series[k] });
    path.push({ date: horizon, value: e.series[days] });
    bySlug.set(e.company.slug, {
      equilibrium: rate,
      drift: (rate - cumulative / age) / age,
      chiffre: e.series[days],
      rank: e.company.latest.rank - rankChange,
      rankChange,
      path,
    });
  }

  const crossings: Crossing[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      const start = Math.sign(a.series[0] - b.series[0]);
      if (start === 0) continue;
      for (let k = 1; k <= days; k++) {
        if (Math.sign(a.series[k] - b.series[k]) === -start) {
          const [passer, passed] = start < 0 ? [a, b] : [b, a];
          crossings.push({
            passer: passer.company,
            passed: passed.company,
            inDays: k,
            date: addDays(latestDate, k),
          });
          break;
        }
      }
    }
  }
  crossings.sort((x, y) => x.inDays - y.inDays || x.passed.latest.rank - y.passed.latest.rank);

  return { horizon, days, bySlug, crossings };
}
