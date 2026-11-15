import { toDayNumber } from "./dates.ts";
import type { CompanySeries, Market } from "./market.ts";
import { listedOn } from "./marketEvents.ts";
import { rateBetween } from "./revenue.ts";
import { revenuePerEmployee, SECTOR_COVERAGE } from "./sectorStats.ts";
import { sectorLabel, type SectorId } from "./sectors.ts";
import type { Consortium, IsoDate } from "./types.ts";

/** How corporations are gathered over time: by sector (fixed) or by consortium (dated). */
export type GroupBy = "sector" | "consortium";

/** Key of the corporations outside any consortium. */
export const INDEPENDENT = "independantes";
/** Key of the corporations not filed under a sector. */
export const UNFILED = "non-classees";

export interface Group {
  /** Sector id, consortium id, or one of `INDEPENDENT` and `UNFILED`. */
  id: string;
  label: string;
  consortium: Consortium | null;
  sector: SectorId | null;
}

interface Known {
  day: number;
  cumulative: number;
}

const knownCache = new WeakMap<CompanySeries, Known[]>();

function known(life: CompanySeries): Known[] {
  let list = knownCache.get(life);
  if (!list) {
    list = life.points.flatMap((p) =>
      p.cumulative === null ? [] : [{ day: toDayNumber(p.date), cumulative: p.cumulative }],
    );
    knownCache.set(life, list);
  }
  return list;
}

/**
 * Cumulative real revenue of a life on `day`, at a constant rate between its reports. Before its
 * first report: from zero on its creation day when KNX dates it, flat otherwise (nothing is
 * counted before KNX saw it). After its last report: flat. Estimated.
 */
export function cumulativeOn(life: CompanySeries, day: number): number {
  const list = known(life);
  if (list.length === 0) return 0;
  const first = list[0];
  if (day <= first.day) {
    const creation =
      life.creation && life.creation.method !== "first-seen"
        ? toDayNumber(life.creation.creation)
        : null;
    if (creation === null || creation >= first.day) return first.cumulative;
    if (day <= creation) return 0;
    return (first.cumulative * (day - creation)) / (first.day - creation);
  }
  const last = list[list.length - 1];
  if (day >= last.day) return last.cumulative;
  let lo = 0;
  let hi = list.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (list[mid].day <= day) lo = mid;
    else hi = mid;
  }
  const a = list[lo];
  const b = list[hi];
  return a.cumulative + ((b.cumulative - a.cumulative) * (day - a.day)) / (b.day - a.day);
}

/** Real revenue a life earned between two days. Estimated; never negative. */
export function earnedBetween(life: CompanySeries, fromDay: number, toDay: number): number {
  if (toDay <= fromDay) return 0;
  return Math.max(0, cumulativeOn(life, toDay) - cumulativeOn(life, fromDay));
}

function sectorGroup(sector: SectorId | null): Group {
  return sector
    ? { id: sector, label: sectorLabel(sector) ?? sector, consortium: null, sector }
    : { id: UNFILED, label: "Non classées", consortium: null, sector: null };
}

function consortiumGroup(consortium: Consortium | null): Group {
  return consortium
    ? { id: consortium.id, label: consortium.name, consortium, sector: null }
    : { id: INDEPENDENT, label: "Indépendantes", consortium: null, sector: null };
}

/**
 * What a life earned between two days, cut by group: its sector, or each consortium it belonged
 * to over those days (the joining day counts, the leaving day no longer does), the rest going to
 * the independents.
 */
export function earnedByGroup(
  life: CompanySeries,
  fromDay: number,
  toDay: number,
  by: GroupBy,
): { group: Group; earned: number }[] {
  const total = earnedBetween(life, fromDay, toDay);
  if (total <= 0) return [];
  if (by === "sector") return [{ group: sectorGroup(life.sector), earned: total }];
  const slices: { group: Group; earned: number }[] = [];
  let inside = 0;
  for (const m of life.memberships) {
    const from = Math.max(fromDay, m.joinedOn ? toDayNumber(m.joinedOn) : -Infinity);
    const to = Math.min(toDay, m.leftOn ? toDayNumber(m.leftOn) : Infinity);
    const earned = earnedBetween(life, from, to);
    if (earned <= 0) continue;
    slices.push({ group: consortiumGroup(m.consortium), earned });
    inside += earned;
  }
  if (total - inside > 0.5) slices.push({ group: consortiumGroup(null), earned: total - inside });
  return slices;
}

export interface GroupRace {
  group: Group;
  /** Real revenue earned since the start, at the latest report. */
  total: number;
  /** The starting line (0), then every report after it. */
  points: { date: IsoDate; value: number }[];
}

/**
 * Real revenue each group earned since `start`, report by report, heaviest first. A corporation's
 * revenue goes to the consortium it belonged to when it earned it: a corporation that changes
 * consortium carries its revenue from one line to the other from that day. Estimated.
 */
export function groupRace(market: Market, start: IsoDate, by: GroupBy): GroupRace[] {
  const startDay = toDayNumber(start);
  const dates = [start, ...market.dates.filter((d) => d > start)];
  const days = dates.map(toDayNumber);
  const races = new Map<string, GroupRace>();
  for (const life of market.allLives) {
    if (life.latest.date <= start) continue;
    days.forEach((day, index) => {
      for (const { group, earned } of earnedByGroup(life, startDay, day, by)) {
        let race = races.get(group.id);
        if (!race) {
          race = { group, total: 0, points: dates.map((date) => ({ date, value: 0 })) };
          races.set(group.id, race);
        }
        race.points[index].value += earned;
      }
    });
  }
  for (const race of races.values()) race.total = race.points[race.points.length - 1].value;
  return [...races.values()].filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
}

export interface Contribution {
  group: Group;
  /** Real revenue per day over the earlier window. */
  before: number;
  /** Real revenue per day over the latest window. */
  after: number;
  delta: number;
}

/**
 * How the market's revenue moved between two windows of `days` (the latest one and the one
 * before it), group by group: the deltas add up to the market's. Estimated.
 */
export function growthContribution(
  market: Market,
  days: number,
  by: GroupBy,
): { days: number; before: number; after: number; groups: Contribution[] } {
  const latest = toDayNumber(market.latestDate);
  const groups = new Map<string, Contribution>();
  const add = (group: Group, field: "before" | "after", earned: number) => {
    const entry = groups.get(group.id) ?? { group, before: 0, after: 0, delta: 0 };
    entry[field] += earned / days;
    groups.set(group.id, entry);
  };
  for (const life of market.allLives) {
    for (const { group, earned } of earnedByGroup(life, latest - 2 * days, latest - days, by))
      add(group, "before", earned);
    for (const { group, earned } of earnedByGroup(life, latest - days, latest, by))
      add(group, "after", earned);
  }
  const list = [...groups.values()].map((g) => ({ ...g, delta: g.after - g.before }));
  return {
    days,
    before: list.reduce((sum, g) => sum + g.before, 0),
    after: list.reduce((sum, g) => sum + g.after, 0),
    groups: list.sort((a, b) => b.delta - a.delta),
  };
}

/** Median of the known values; null when there is none. */
function median(values: readonly (number | null)[]): number | null {
  const sorted = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface SectorRegimePoint {
  date: IsoDate;
  /** Median activity of the sector's corporations listed that day. */
  activity: number | null;
  /** Median dynamics of the same corporations. */
  dynamics: number | null;
  /** Share of the market's revenue over the 30 days before; null where too few are filed. */
  share: number | null;
}

export interface SectorTrail {
  sector: SectorId;
  label: string;
  /** Oldest first; the last one is the latest report. */
  points: SectorRegimePoint[];
}

/** Report dates about evenly spread over the last `span` days, oldest first, the latest last. */
function sampleDates(market: Market, span: number, steps: number): IsoDate[] {
  const latest = toDayNumber(market.latestDate);
  const picked: IsoDate[] = [];
  for (let k = steps; k >= 0; k--) {
    const target = latest - (span * k) / steps;
    let best: IsoDate | null = null;
    for (const date of market.dates) {
      const day = toDayNumber(date);
      if (day > target) break;
      best = date;
    }
    if (best && !picked.includes(best)) picked.push(best);
  }
  return picked;
}

/**
 * Where each sector stood on activity and dynamics over the last `span` days: the medians of its
 * corporations listed at each sampled report, computed as KNX computes them on the latest report,
 * and its share of the market's revenue. Estimated.
 */
export function sectorRegimes(market: Market, span = 90, steps = 6): SectorTrail[] {
  const dates = sampleDates(market, span, steps);
  const trails = new Map<SectorId, SectorTrail>();
  for (const sector of market.sectors.values())
    if (sector.listed > 0)
      trails.set(sector.id, { sector: sector.id, label: sector.label, points: [] });

  for (const date of dates) {
    const day = toDayNumber(date);
    const scores = new Map<SectorId, { dynamics: number | null; activity: number | null }[]>();
    const earned = new Map<SectorId, number>();
    let all = 0;
    let filed = 0;
    for (const life of market.allLives) {
      const recent = rateBetween(life.points, day - 30, day);
      if (recent !== null && recent > 0) {
        all += recent;
        if (life.sector) {
          filed += recent;
          earned.set(life.sector, (earned.get(life.sector) ?? 0) + recent);
        }
      }
      if (!life.sector || !trails.has(life.sector) || !listedOn(life, date)) continue;
      const point = life.points.findLast((p) => p.date <= date);
      if (!point || point.chiffre === 0) continue;
      const before = rateBetween(life.points, day - 120, day - 30);
      const list = scores.get(life.sector) ?? [];
      list.push({
        dynamics:
          recent !== null && before !== null && before > 0
            ? Math.tanh((2.5 * (recent - before)) / before)
            : null,
        activity: recent !== null ? Math.tanh(recent / point.chiffre - 1) : null,
      });
      scores.set(life.sector, list);
    }
    const covered = all > 0 && filed / all >= SECTOR_COVERAGE;
    for (const trail of trails.values()) {
      const list = scores.get(trail.sector) ?? [];
      trail.points.push({
        date,
        dynamics: median(list.map((s) => s.dynamics)),
        activity: median(list.map((s) => s.activity)),
        share: covered ? (earned.get(trail.sector) ?? 0) / all : null,
      });
    }
  }
  return [...trails.values()];
}

export interface ConsortiumPortfolio {
  consortium: Consortium;
  /** Listed members today, heaviest first. */
  members: CompanySeries[];
  /** Their real revenue per day over the last 30 days. */
  recentRate: number;
  /** Share of the market's revenue over the last 30 days. */
  weight: number;
  /** Share of the consortium's revenue made by its heaviest member. */
  dependency: number | null;
  /** Its revenue by sector, heaviest first. */
  bySector: { group: Group; rate: number; share: number }[];
  /** Dated joinings and leavings, newest first. */
  moves: { company: CompanySeries; kind: "join" | "leave"; date: IsoDate }[];
  /** Corporations that belonged to it and no longer do, or have closed. */
  former: CompanySeries[];
}

/** Each consortium as a holding: members, revenue by sector, dependence on one member, moves. */
export function consortiumPortfolios(market: Market): ConsortiumPortfolio[] {
  const total = market.companies.reduce((sum, c) => sum + Math.max(0, c.scores.weight ?? 0), 0);
  return market.consortiums
    .map((consortium) => {
      const members = market.companies
        .filter((c) => c.status !== "delisted" && c.consortium?.id === consortium.id)
        .sort((a, b) => (b.recentRate ?? -1) - (a.recentRate ?? -1));
      const recentRate = members.reduce((sum, c) => sum + (c.recentRate ?? 0), 0);
      const bySector = new Map<string, { group: Group; rate: number; share: number }>();
      for (const c of members) {
        const group = sectorGroup(c.sector);
        const entry = bySector.get(group.id) ?? { group, rate: 0, share: 0 };
        entry.rate += c.recentRate ?? 0;
        bySector.set(group.id, entry);
      }
      for (const entry of bySector.values())
        entry.share = recentRate > 0 ? entry.rate / recentRate : 0;
      const moves: ConsortiumPortfolio["moves"] = [];
      const former: CompanySeries[] = [];
      for (const c of market.companies) {
        const periods = c.memberships.filter((m) => m.consortium.id === consortium.id);
        if (periods.length === 0) continue;
        for (const m of periods) {
          if (m.joinedOn) moves.push({ company: c, kind: "join", date: m.joinedOn });
          if (m.leftOn) moves.push({ company: c, kind: "leave", date: m.leftOn });
        }
        if (!members.includes(c)) former.push(c);
      }
      return {
        consortium,
        members,
        recentRate,
        weight:
          members.reduce((sum, c) => sum + Math.max(0, c.scores.weight ?? 0), 0) / (total || 1),
        dependency: recentRate > 0 ? (members[0]?.recentRate ?? 0) / recentRate : null,
        bySector: [...bySector.values()].sort((a, b) => b.rate - a.rate),
        moves: moves.sort((a, b) => b.date.localeCompare(a.date)),
        former,
      };
    })
    .filter((p) => p.members.length > 0 || p.former.length > 0)
    .sort((a, b) => b.recentRate - a.recentRate);
}

export interface EffectRow {
  id: string;
  label: string;
  help: string;
  /** Median among consortium members, and among independents. */
  members: number | null;
  independents: number | null;
  /** How the value reads: points out of 100, a 1–7 level, or a ratio. */
  unit: "points" | "level" | "ratio";
  /** Whether a higher value is better. */
  higherIsBetter: boolean;
}

export interface MoveEffect {
  company: CompanySeries;
  consortium: Consortium;
  kind: "join" | "leave";
  date: IsoDate;
  /** Real revenue per day over the 30 days before the move, and after it (up to 30 days). */
  before: number | null;
  after: number | null;
}

/**
 * Consortium members against independent corporations, each measured against its own sector so
 * sectors of unequal sizes do not weigh in, and the revenue around each dated move. A comparison
 * of medians on small numbers: it describes, it does not prove that a consortium makes the
 * difference.
 */
export function consortiumEffect(market: Market): {
  rows: EffectRow[];
  members: number;
  independents: number;
  moves: MoveEffect[];
} {
  const active = market.companies.filter((c) => c.status === "active" && c.sector !== null);
  const members = active.filter((c) => c.consortium !== null);
  const independents = active.filter((c) => c.consortium === null);
  const productivityGap = (c: CompanySeries) => {
    const own = revenuePerEmployee(c);
    const sector = c.sector ? market.sectors.get(c.sector)?.revenuePerEmployee : null;
    return own !== null && sector ? own / sector - 1 : null;
  };
  const row = (
    id: string,
    label: string,
    help: string,
    value: (c: CompanySeries) => number | null,
    unit: EffectRow["unit"],
    higherIsBetter: boolean,
  ): EffectRow => ({
    id,
    label,
    help,
    members: median(members.map(value)),
    independents: median(independents.map(value)),
    unit,
    higherIsBetter,
  });

  const latest = toDayNumber(market.latestDate);
  const moves: MoveEffect[] = [];
  for (const c of market.companies) {
    const lives = market.lives.get(c.profileId) ?? [c];
    const earned = (from: number, to: number) =>
      lives.reduce((sum, life) => sum + earnedBetween(life, from, to), 0);
    for (const m of c.memberships)
      for (const [kind, date] of [
        ["join", m.joinedOn],
        ["leave", m.leftOn],
      ] as const) {
        if (!date) continue;
        const day = toDayNumber(date);
        const afterDays = Math.min(30, latest - day);
        moves.push({
          company: c,
          consortium: m.consortium,
          kind,
          date,
          before: earned(day - 30, day) / 30,
          after: afterDays >= 7 ? earned(day, day + afterDays) / afterDays : null,
        });
      }
  }

  return {
    rows: [
      row(
        "dynamics",
        "Dynamique face au secteur",
        "Dynamique de la corporation moins la médiane de son secteur, en points.",
        (c) => c.scores.dynamicsVsSector,
        "points",
        true,
      ),
      row(
        "activity",
        "Activité face au secteur",
        "Activité de la corporation moins la médiane de son secteur, en points.",
        (c) => c.scores.activityVsSector,
        "points",
        true,
      ),
      row(
        "productivity",
        "Recette par employé face au secteur",
        "Recette par employé rapportée à la médiane de son secteur.",
        productivityGap,
        "ratio",
        true,
      ),
      row(
        "risk",
        "Profil de risque",
        "Profil de risque KNX, de 1 (très faible) à 7 (critique).",
        (c) => c.risk?.profile ?? null,
        "level",
        false,
      ),
    ],
    members: members.length,
    independents: independents.length,
    moves: moves.sort((a, b) => b.date.localeCompare(a.date)),
  };
}
