import { fromDayNumber, toDayNumber } from "./dates.ts";
import { earnedBetween, UNFILED } from "./groupHistory.ts";
import type { CompanySeries, Market } from "./market.ts";
import { listedOn } from "./marketEvents.ts";
import { DISTRICT_LABELS, type District } from "./rating.ts";
import { RISK_METHOD } from "./risk.ts";
import { SECTOR_COVERAGE } from "./sectorStats.ts";
import { sectorLabel, type SectorId } from "./sectors.ts";
import type { IsoDate, MarketEvent } from "./types.ts";

/** Median of the known values; null when there is none. */
function median(values: readonly (number | null)[]): number | null {
  const sorted = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Pearson correlation of two paired lists; null under three pairs or without spread. */
export function correlation(a: readonly number[], b: readonly number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 3) return null;
  const ma = a.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const mb = b.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let k = 0; k < n; k++) {
    cov += (a[k] - ma) * (b[k] - mb);
    va += (a[k] - ma) ** 2;
    vb += (b[k] - mb) ** 2;
  }
  return va > 0 && vb > 0 ? cov / Math.sqrt(va * vb) : null;
}

/** The two ends of the production chain: factories sell to the shops, which sell to players. */
export const SUPPLY_CHAIN = {
  upstream: ["usine-production"] as SectorId[],
  downstream: ["boutique-armes", "boutique-equipement", "boutique-specialisee"] as SectorId[],
};

export interface SupplyChain {
  /** Weekly points over the stretch where filed corporations make enough of the market. */
  points: { date: IsoDate; upstream: number; downstream: number }[];
  /** Correlation of the 4-week revenue changes, the shops shifted by `lagWeeks`. */
  correlations: { lagWeeks: number; r: number | null; n: number }[];
  /** The strongest correlation, if any is measured. */
  best: { lagWeeks: number; r: number } | null;
}

const WEEK = 7;
const CHANGE_WEEKS = 4;
const MAX_LAG_WEEKS = 8;

/**
 * Factories against the shops they supply: real revenue per day over the 30 days before each
 * week, and how the 4-week changes of the two move together when the shops are shifted by a few
 * weeks. A positive lag means the factories move first. Only the latest stretch where filed
 * corporations earn at least `SECTOR_COVERAGE` of the market is read. Estimated, and fragile:
 * reports are irregular and the sectors are small.
 */
export function supplyChain(market: Market): SupplyChain {
  const latest = toDayNumber(market.latestDate);
  const first = toDayNumber(market.dates[0]) + 30;
  const grid: number[] = [];
  for (let day = latest; day >= first; day -= WEEK) grid.unshift(day);

  const rows: { day: number; upstream: number; downstream: number; covered: boolean }[] = [];
  for (const day of grid) {
    let all = 0;
    let filed = 0;
    let upstream = 0;
    let downstream = 0;
    for (const life of market.allLives) {
      const rate = earnedBetween(life, day - 30, day) / 30;
      if (rate <= 0) continue;
      all += rate;
      if (!life.sector) continue;
      filed += rate;
      if (SUPPLY_CHAIN.upstream.includes(life.sector)) upstream += rate;
      if (SUPPLY_CHAIN.downstream.includes(life.sector)) downstream += rate;
    }
    rows.push({ day, upstream, downstream, covered: all > 0 && filed / all >= SECTOR_COVERAGE });
  }
  // The latest unbroken stretch of covered weeks.
  let start = rows.length;
  while (start > 0 && rows[start - 1].covered) start--;
  const run = rows.slice(start);

  const change = (key: "upstream" | "downstream") =>
    run.map((r, k) => {
      const before = run[k - CHANGE_WEEKS]?.[key];
      return before && before > 0 && r[key] > 0 ? Math.log(r[key] / before) : null;
    });
  const up = change("upstream");
  const down = change("downstream");
  const correlations = [];
  for (let lag = -MAX_LAG_WEEKS; lag <= MAX_LAG_WEEKS; lag++) {
    const a: number[] = [];
    const b: number[] = [];
    for (let k = 0; k < run.length; k++) {
      const u = up[k];
      const d = down[k + lag];
      if (u !== null && d !== null && d !== undefined) {
        a.push(u);
        b.push(d);
      }
    }
    correlations.push({ lagWeeks: lag, r: a.length >= 12 ? correlation(a, b) : null, n: a.length });
  }
  const best = correlations.reduce<{ lagWeeks: number; r: number } | null>(
    // Near ties go to the shorter delay: the simpler reading.
    (top, c) =>
      c.r !== null &&
      (!top ||
        c.r > top.r + 0.01 ||
        (c.r >= top.r - 0.01 && Math.abs(c.lagWeeks) < Math.abs(top.lagWeeks)))
        ? { lagWeeks: c.lagWeeks, r: c.r }
        : top,
    null,
  );
  return {
    points: run.map((r) => ({
      date: fromDayNumber(r.day),
      upstream: r.upstream,
      downstream: r.downstream,
    })),
    correlations,
    best,
  };
}

export interface ShockRow {
  /** Sector id, or `UNFILED`. */
  id: string;
  label: string;
  /** Corporations listed both before and after. */
  companies: number;
  capitalBefore: number;
  capitalAfter: number;
  /** Corporations at or above the piracy threshold, before and after. */
  exposedBefore: number;
  exposedAfter: number;
  /** Real revenue per day over the 30 days before the event, and the 30 after its span. */
  rateBefore: number;
  rateAfter: number;
}

export interface EventShock {
  event: MarketEvent;
  /** The reports read: the last one before the event, the first one after its span. */
  before: IsoDate;
  after: IsoDate;
  rows: ShockRow[];
  /** Share of the capital before held by corporations filed under a sector. */
  coverage: number | null;
}

/**
 * What a market event did to each sector: its capital on the last report before the event and on
 * the first report after its span, how many corporations sat above the piracy threshold, and its
 * daily revenue over the 30 days on each side. Corporations not filed under a sector form their
 * own row. Null when the reports do not frame the event.
 */
export function eventShock(market: Market, event: MarketEvent): EventShock | null {
  const before = market.dates.findLast((d) => d < event.date);
  const afterDay = toDayNumber(event.date) + event.span;
  const after = market.dates.find((d) => toDayNumber(d) >= afterDay);
  if (!before || !after) return null;
  const eventDay = toDayNumber(event.date);
  const threshold = RISK_METHOD.piracyThreshold;
  const rows = new Map<string, ShockRow>();
  let filedCapital = 0;
  let allCapital = 0;
  for (const life of market.allLives) {
    if (!listedOn(life, before) || !listedOn(life, after)) continue;
    const b = life.points.find((p) => p.date === before);
    const a = life.points.find((p) => p.date === after);
    if (!b || !a || b.capital === null || a.capital === null) continue;
    const id = life.sector ?? UNFILED;
    const row = rows.get(id) ?? {
      id,
      label: life.sector ? (sectorLabel(life.sector) ?? id) : "Non classées",
      companies: 0,
      capitalBefore: 0,
      capitalAfter: 0,
      exposedBefore: 0,
      exposedAfter: 0,
      rateBefore: 0,
      rateAfter: 0,
    };
    row.companies += 1;
    row.capitalBefore += b.capital;
    row.capitalAfter += a.capital;
    if (b.capital >= threshold) row.exposedBefore += 1;
    if (a.capital >= threshold) row.exposedAfter += 1;
    row.rateBefore += earnedBetween(life, eventDay - 30, eventDay) / 30;
    row.rateAfter += earnedBetween(life, afterDay, afterDay + 30) / 30;
    rows.set(id, row);
    allCapital += b.capital;
    if (life.sector) filedCapital += b.capital;
  }
  const change = (r: ShockRow) => (r.capitalBefore > 0 ? r.capitalAfter / r.capitalBefore - 1 : 0);
  return {
    event,
    before,
    after,
    rows: [...rows.values()].sort((x, y) => change(x) - change(y)),
    coverage: allCapital > 0 ? filedCapital / allCapital : null,
  };
}

export interface DistrictColumn {
  district: District | null;
  label: string;
  listed: number;
  /** Share of the market's revenue over 30 days. */
  weight: number;
  /** Median dynamics of its listed corporations. */
  dynamics: number | null;
}

export interface DistrictMap {
  columns: DistrictColumn[];
  /** One row per sector holding listed corporations: count and share of the market per district. */
  rows: { sector: SectorId; label: string; cells: { listed: number; weight: number }[] }[];
}

/** Where the sectors stand in the city: each district's corporations, sector by sector. */
export function districtSectors(market: Market): DistrictMap {
  const listed = market.companies.filter((c) => c.status !== "delisted");
  const districts: (District | null)[] = [
    ...(Object.keys(DISTRICT_LABELS) as District[]),
    ...(listed.some((c) => c.district === null) ? [null] : []),
  ];
  const weight = (list: readonly CompanySeries[]) =>
    list.reduce((sum, c) => sum + Math.max(0, c.scores.weight ?? 0), 0);
  const columns = districts.map((district) => {
    const members = listed.filter((c) => c.district === district);
    return {
      district,
      label: district ? DISTRICT_LABELS[district] : "Non renseigné",
      listed: members.length,
      weight: weight(members),
      dynamics: median(members.map((c) => c.scores.dynamics)),
    };
  });
  const rows = [...market.sectors.values()]
    .filter((s) => s.listed > 0)
    .map((s) => ({
      sector: s.id,
      label: s.label,
      cells: districts.map((district) => {
        const members = listed.filter((c) => c.sector === s.id && c.district === district);
        return { listed: members.length, weight: weight(members) };
      }),
    }));
  return { columns: columns.filter((c) => c.listed > 0 || c.district !== null), rows };
}

export interface RetentionRow {
  company: CompanySeries;
  /** Share of the window's revenue found again in the capital; negative when it melted. */
  retention: number;
}

export interface RevenueQuality {
  /** Median retention per sector, held-at-the-ceiling corporations left out. */
  sectors: { sector: SectorId; label: string; retention: number | null; measured: number }[];
  /** The lowest retentions among the measured corporations, lowest first. */
  lowest: RetentionRow[];
  /** Corporations held near the piracy threshold, whose outflows say nothing. */
  capped: number;
  measured: number;
}

/**
 * How much of what each corporation earns stays in its capital, over the risk window (five
 * imperial years): the « Rétention » index of the risk profile. A low retention has many causes
 * (wages, purchases, withdrawals, or revenue inflated by selling to oneself); KNX does not say
 * which. Corporations held near the piracy threshold are left out: they must take money out.
 */
export function revenueQuality(market: Market, lowest = 8): RevenueQuality {
  const rows: RetentionRow[] = [];
  let capped = 0;
  for (const c of market.companies) {
    const index = c.risk?.indices.find((i) => i.id === "retention");
    if (!index || index.value === null) continue;
    if (index.flag === "capped") {
      capped++;
      continue;
    }
    rows.push({ company: c, retention: index.value });
  }
  const sectors = [...market.sectors.values()]
    .filter((s) => s.listed > 0)
    .map((s) => {
      const members = rows.filter((r) => r.company.sector === s.id);
      return {
        sector: s.id,
        label: s.label,
        retention: median(members.map((r) => r.retention)),
        measured: members.length,
      };
    })
    .sort((a, b) => (a.retention ?? Infinity) - (b.retention ?? Infinity));
  return {
    sectors,
    lowest: [...rows].sort((a, b) => a.retention - b.retention).slice(0, lowest),
    capped,
    measured: rows.length,
  };
}
