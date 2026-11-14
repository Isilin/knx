import { toDayNumber } from "./dates.ts";
import type { CompanyPoint, CompanySeries } from "./market.ts";
import type { IsoDate } from "./types.ts";

export interface RacePoint {
  date: IsoDate;
  /** Real revenue earned since the start of the race. Estimated. */
  value: number;
}

export interface RaceEntry {
  company: CompanySeries;
  /** Real revenue earned since the start of the race, at the latest report. Estimated. */
  total: number;
  /** The starting line (value 0), then every report after it. */
  points: RacePoint[];
}

type KnownPoint = CompanyPoint & { cumulative: number };

/**
 * Where a corporation stands on the starting line: its cumulative revenue on `start`, read
 * between the reports around it at a constant rate. A corporation created after `start` starts
 * from zero on its creation date; one first seen after `start` (history too short to tell)
 * starts from its first report.
 */
function origin(company: CompanySeries, known: KnownPoint[], start: IsoDate): RacePoint | null {
  const after = known.findIndex((p) => p.date > start);
  if (after === -1) return null;
  if (after > 0) {
    const a = known[after - 1];
    if (a.date === start) return { date: start, value: a.cumulative };
    const b = known[after];
    const share =
      (toDayNumber(start) - toDayNumber(a.date)) / (toDayNumber(b.date) - toDayNumber(a.date));
    return { date: start, value: a.cumulative + (b.cumulative - a.cumulative) * share };
  }
  const creation = company.creation?.creation;
  if (creation && creation >= start && creation < known[0].date)
    return { date: creation, value: 0 };
  return { date: known[0].date, value: known[0].cumulative };
}

/**
 * The corporations listed on `latest` that earned the most real revenue since `start`, each with
 * its running total: every line leaves zero on the starting line, so the order of the race reads
 * from the slopes, not from a lifetime average. Corporations without a creation estimate cannot
 * be measured and stay out. Estimated.
 */
export function revenueRace(
  companies: readonly CompanySeries[],
  start: IsoDate,
  latest: IsoDate,
  limit = 10,
): RaceEntry[] {
  const entries: RaceEntry[] = [];
  for (const company of companies) {
    if (company.status === "delisted" || company.latest.date !== latest) continue;
    const known = company.points.filter((p): p is KnownPoint => p.cumulative !== null);
    if (known.at(-1)?.date !== latest) continue;
    const from = origin(company, known, start);
    if (!from) continue;
    // Rounding of the published chiffre can dip a total below zero by a few credits.
    const points: RacePoint[] = [
      { date: from.date, value: 0 },
      ...known
        .filter((p) => p.date > from.date)
        .map((p) => ({ date: p.date, value: Math.max(0, p.cumulative - from.value) })),
    ];
    const total = points[points.length - 1].value;
    if (total > 0) entries.push({ company, total, points });
  }
  return entries.sort((a, b) => b.total - a.total).slice(0, limit);
}
