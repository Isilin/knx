import { toDayNumber } from "./dates.ts";
import type { CompanySeries, Market } from "./market.ts";
import { rateBetween } from "./revenue.ts";
import { SECTORS, type SectorId } from "./sectors.ts";
import type { Consortium, IsoDate } from "./types.ts";

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
  /** Published headcount of its listed corporations, chief executives included. */
  employees: number;
  /** Published capital of its listed corporations. */
  capital: number;
  /**
   * Herfindahl index of the revenue shares of its listed corporations over 30 days, 0…1: 1 when
   * one corporation earns everything, 1/n when n share it equally.
   */
  hhi: number | null;
  /** The corporation that earns the most, and its share of the sector. */
  leader: { company: CompanySeries; share: number } | null;
  /** Median real revenue per day per employee of its active corporations. */
  revenuePerEmployee: number | null;
  /** Median revenue of 30 days per credit of capital of its active corporations. */
  revenueToCapital: number | null;
}

/** Real revenue per day per employee over the last 30 days; the chief executive counts. */
export function revenuePerEmployee(c: CompanySeries): number | null {
  const employees = c.latest.employees ?? 0;
  return c.recentRate !== null && employees > 0 ? c.recentRate / employees : null;
}

/** Revenue of the last 30 days for each credit of published capital. */
export function revenueToCapital(c: CompanySeries): number | null {
  const capital = c.latest.capital ?? 0;
  return c.recentRate !== null && capital > 0 ? (c.recentRate * 30) / capital : null;
}

export type ConcentrationLevel = "domine" | "concentre" | "modere" | "ouvert";

/**
 * Reading of a Herfindahl index, highest first. The 0.15 and 0.25 thresholds are those of the
 * competition authorities; above 0.5, one corporation makes most of the sector.
 */
export const CONCENTRATION_LEVELS: readonly {
  id: ConcentrationLevel;
  label: string;
  min: number;
  help: string;
}[] = [
  {
    id: "domine",
    label: "Dominé",
    min: 0.5,
    help: "Une corporation fait l'essentiel des recettes.",
  },
  {
    id: "concentre",
    label: "Concentré",
    min: 0.25,
    help: "Deux ou trois corporations se partagent les recettes.",
  },
  {
    id: "modere",
    label: "Modérément concentré",
    min: 0.15,
    help: "Quelques corporations pèsent plus que les autres.",
  },
  {
    id: "ouvert",
    label: "Ouvert",
    min: 0,
    help: "Les recettes se répartissent entre de nombreuses corporations.",
  },
];

export function concentrationOf(hhi: number): (typeof CONCENTRATION_LEVELS)[number] {
  return CONCENTRATION_LEVELS.find((level) => hhi >= level.min) ?? CONCENTRATION_LEVELS[3];
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
    const active = listed.filter((c) => c.status === "active");
    const earning = listed.filter((c) => (c.recentRate ?? 0) > 0);
    const listedRate = earning.reduce((sum, c) => sum + (c.recentRate ?? 0), 0);
    const top = earning.reduce<CompanySeries | null>(
      (best, c) => (!best || (c.recentRate ?? 0) > (best.recentRate ?? 0) ? c : best),
      null,
    );

    const summary: SectorSummary = {
      id,
      label,
      listed: listed.length,
      recentRate,
      weight: marketRate > 0 ? recentRate / marketRate : null,
      dynamics: median(listed.map((c) => c.scores.dynamics)),
      activity: median(listed.map((c) => c.scores.activity)),
      employees: listed.reduce((sum, c) => sum + (c.latest.employees ?? 0), 0),
      capital: listed.reduce((sum, c) => sum + (c.latest.capital ?? 0), 0),
      hhi:
        listedRate > 0
          ? earning.reduce((sum, c) => sum + ((c.recentRate ?? 0) / listedRate) ** 2, 0)
          : null,
      leader:
        top && listedRate > 0 ? { company: top, share: (top.recentRate ?? 0) / listedRate } : null,
      revenuePerEmployee: median(active.map(revenuePerEmployee)),
      revenueToCapital: median(active.map(revenueToCapital)),
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

/** One column of the sector × consortium table: a consortium, or the independent corporations. */
export interface MatrixColumn {
  consortium: Consortium | null;
  /** Its listed corporations. */
  listed: number;
  /** Share of the market's real revenue over 30 days. */
  weight: number;
}

export interface SectorMatrix {
  columns: MatrixColumn[];
  /** One row per sector holding listed corporations; each cell heaviest first. */
  rows: { sector: SectorSummary; cells: CompanySeries[][] }[];
  /** Listed corporations not filed under a sector yet. */
  unfiled: CompanySeries[];
}

/**
 * Where each consortium stands, sector by sector, on the latest report: its listed members in
 * each sector, and the independent corporations last. Membership is today's.
 */
export function sectorConsortiumMatrix(market: Market): SectorMatrix {
  const listed = market.companies.filter((c) => c.status !== "delisted");
  const byRate = (a: CompanySeries, b: CompanySeries) =>
    (b.recentRate ?? -1) - (a.recentRate ?? -1) || a.latest.rank - b.latest.rank;
  const column = (consortium: Consortium | null): MatrixColumn => {
    const members = listed.filter((c) => (c.consortium?.id ?? null) === (consortium?.id ?? null));
    return {
      consortium,
      listed: members.length,
      weight: members.reduce((sum, c) => sum + (c.scores.weight ?? 0), 0),
    };
  };
  const columns = [...market.consortiums.map(column).filter((col) => col.listed > 0), column(null)];
  const rows = [...market.sectors.values()]
    .filter((sector) => sector.listed > 0)
    .map((sector) => ({
      sector,
      cells: columns.map((col) =>
        listed
          .filter(
            (c) =>
              c.sector === sector.id && (c.consortium?.id ?? null) === (col.consortium?.id ?? null),
          )
          .sort(byRate),
      ),
    }));
  return { columns, rows, unfiled: listed.filter((c) => c.sector === null).sort(byRate) };
}
