import { toDayNumber } from "./dates.ts";
import type { CompanySeries, Market } from "./market.ts";
import { rateBetween } from "./revenue.ts";
import { SECTORS, type SectorId } from "./sectors.ts";
import type { IsoDate } from "./types.ts";

/** A sector taken as a whole, on the latest report. Every figure is estimated by KNX. */
export interface SectorSummary {
  id: SectorId;
  label: string;
  /** Corporations of the cote filed under it. */
  listed: number;
  /** Real revenue per day over the last 30 days, every life filed under it. */
  recentRate: number;
  /** Share of the market's real revenue over the last 30 days. */
  weight: number | null;
  /** −1…1: median dynamics of its listed corporations, the typical member of the sector. */
  dynamics: number | null;
  /** −1…1: median activity of its listed corporations. */
  activity: number | null;
}

/** Median of the known values; null when there is none. */
function median(values: readonly (number | null)[]): number | null {
  const known = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (known.length === 0) return null;
  const mid = known.length >> 1;
  return known.length % 2 === 1 ? known[mid] : (known[mid - 1] + known[mid]) / 2;
}

/**
 * Sectors on the latest report, in the fixed order of `SECTORS`, and each corporation's place in
 * its own: share of the sector's revenue, rank by that revenue among the listed ones, and its
 * dynamics and activity against the sector's. Shares count every life that earned in the last
 * 30 days, like the market weight. The sector's dynamics and activity are the medians of its
 * listed corporations: revenue is cheap to inflate in the game, and one burst would otherwise
 * carry a whole sector (a sum saturates the curve as soon as one member multiplies its revenue).
 *
 * Mutates `companies` (the current life of each page) and their `scores`.
 */
export function summarizeSectors(
  allLives: readonly CompanySeries[],
  companies: readonly CompanySeries[],
  marketRate: number,
): Map<SectorId, SectorSummary> {
  const summaries = new Map<SectorId, SectorSummary>();
  for (const { id, label } of SECTORS) {
    const lives = allLives.filter((c) => c.sector === id);
    const listed = companies.filter((c) => c.sector === id && c.status !== "delisted");
    const recentRate = lives.reduce((sum, c) => sum + (c.recentRate ?? 0), 0);

    const summary: SectorSummary = {
      id,
      label,
      listed: listed.length,
      recentRate,
      weight: marketRate > 0 ? recentRate / marketRate : null,
      dynamics: median(listed.map((c) => c.scores.dynamics)),
      activity: median(listed.map((c) => c.scores.activity)),
    };
    summaries.set(id, summary);

    const ranked = listed
      .filter((c) => c.recentRate !== null)
      .sort((a, b) => (b.recentRate ?? 0) - (a.recentRate ?? 0));
    for (const c of companies.filter((c) => c.sector === id)) {
      const index = ranked.indexOf(c);
      c.sectorRank = index >= 0 ? { rank: index + 1, of: listed.length } : null;
      c.scores.sectorWeight =
        c.recentRate !== null && recentRate > 0 ? c.recentRate / recentRate : null;
      const listedNow = c.status !== "delisted";
      c.scores.dynamicsVsSector =
        listedNow && c.scores.dynamics !== null && summary.dynamics !== null
          ? c.scores.dynamics - summary.dynamics
          : null;
      c.scores.activityVsSector =
        listedNow && c.scores.activity !== null && summary.activity !== null
          ? c.scores.activity - summary.activity
          : null;
    }
  }
  return summaries;
}

/** Part of the market's revenue below which a sector share is not drawn. */
export const SECTOR_COVERAGE = 0.9;

interface DayTotals {
  /** Real revenue per day over the 30 days before the report, every life. */
  all: number;
  /** The same, per sector. */
  bySector: Map<SectorId, number>;
}

const totalsCache = new WeakMap<Market, Map<IsoDate, DayTotals>>();

/** Market and sector revenue over the 30 days before each report; computed once per market. */
function dayTotals(market: Market): Map<IsoDate, DayTotals> {
  const cached = totalsCache.get(market);
  if (cached) return cached;
  const totals = new Map<IsoDate, DayTotals>();
  for (const date of market.dates) {
    const day = toDayNumber(date);
    const entry: DayTotals = { all: 0, bySector: new Map() };
    for (const life of market.allLives) {
      const rate = rateBetween(life.points, day - 30, day);
      if (rate === null || rate <= 0) continue;
      entry.all += rate;
      if (life.sector)
        entry.bySector.set(life.sector, (entry.bySector.get(life.sector) ?? 0) + rate);
    }
    totals.set(date, entry);
  }
  totalsCache.set(market, totals);
  return totals;
}

export interface SectorSharePoint {
  date: IsoDate;
  /** Share of the sector's real revenue over the 30 days before the report; null: not drawn. */
  value: number | null;
}

/**
 * A page's share of its sector over time, at each of its reports. The sectors of the closed
 * corporations are not all known: where the corporations filed under a sector earned less than
 * `SECTOR_COVERAGE` of the market's revenue, the sector's total is too partial and the share is
 * left out. Each life is measured on its own; a refounding breaks the line. Estimated.
 */
export function sectorShareHistory(
  market: Market,
  lives: readonly CompanySeries[],
): SectorSharePoint[] {
  const sector = lives.at(-1)?.sector;
  if (!sector) return [];
  const totals = dayTotals(market);
  const out: SectorSharePoint[] = [];
  lives.forEach((life, index) => {
    if (index > 0) out.push({ date: lives[index - 1].closedOn ?? life.firstSeen, value: null });
    for (const p of life.points) {
      const day = toDayNumber(p.date);
      const own = rateBetween(life.points, day - 30, day);
      const entry = totals.get(p.date);
      const total = entry?.bySector.get(sector) ?? 0;
      let classified = 0;
      for (const v of entry?.bySector.values() ?? []) classified += v;
      const covered =
        entry !== undefined && entry.all > 0 && classified / entry.all >= SECTOR_COVERAGE;
      out.push({
        date: p.date,
        value: own === null || !covered || total <= 0 ? null : Math.max(0, own) / total,
      });
    }
  });
  return out;
}
