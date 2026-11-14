import { addDays, daysBetween, toDayNumber } from "./dates.ts";
import type { CompanyPoint, CompanyScores, CompanyStatus } from "./market.ts";
import { regimeOf, type Regime } from "./regimes.ts";
import { rateBetween } from "./revenue.ts";
import { treasuryBridge } from "./treasury.ts";
import type { IsoDate } from "./types.ts";

/**
 * KNX risk profile: seven indices read from the published reports and KNX's revenue estimates,
 * each graded 1 (very low) to 7 (critical), then combined into one profile on the same scale.
 * Every threshold lives in `RISK_METHOD`, so the method can be published as is.
 */

export type RiskLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type RiskIndexId =
  | "volatility"
  | "trend"
  | "runway"
  | "retention"
  | "reserve"
  | "team"
  | "exposure";

/**
 * - `dormant`: the reserve covers more than `dormantReserveDays` of revenue.
 * - `capped`: the capital sits near the piracy threshold; outflows keep it under rather than pay
 *   for anything, so retention says nothing about profitability and is left out.
 * - `not-declining`: the capital did not fall over the window; no runway to count down.
 * - `exposed`: the capital is at or above the piracy threshold.
 */
export type RiskFlag = "dormant" | "capped" | "not-declining" | "exposed";

export interface RiskIndex {
  id: RiskIndexId;
  /** Null when the index cannot be measured, or is left out (see `flag`). */
  level: RiskLevel | null;
  /**
   * The measure behind the level: coefficient of variation (`volatility`), mean of activity and
   * dynamics (`trend`), days (`runway`, `reserve`), share of revenue kept (`retention`),
   * headcount (`team`), capital ÷ piracy threshold (`exposure`).
   */
  value: number | null;
  flag: RiskFlag | null;
}

export interface CompanyRisk {
  /** Combined profile; null when fewer than `RISK_METHOD.minMeasured` indices are measured. */
  profile: RiskLevel | null;
  /** Weighted mean of the measured levels, before the floor of the worst index. */
  score: number | null;
  /** In display order. */
  indices: RiskIndex[];
  measured: number;
  /** Window the indices look at: the last five imperial years. */
  from: IsoDate;
  to: IsoDate;
  regime: Regime | null;
  /** Latest report of the window with the capital at or above the piracy threshold. */
  lastAboveThreshold: IsoDate | null;
}

export const RISK_METHOD = {
  /** Five imperial years (one imperial year is one real month). */
  windowDays: 150,
  /** Above this capital, a corporation can be hacked and robbed (game rule). */
  piracyThreshold: 30_000_000,
  /** Capital at or above this share of the threshold is held at the ceiling (`capped`). */
  ceilingShare: 0.9,
  /** Twelve imperial years of revenue in the till: capital lying idle. */
  dormantReserveDays: 360,
  /** Spacing and span of the 30-day revenue samples behind the volatility. */
  sampleStep: 15,
  sampleSpan: 30,
  minSamples: 5,
  /** Shortest stretch of capital reports the runway is read over. */
  minRunwaySpan: 30,
  /** Coefficient of variation from which levels 2…7 start. */
  volatility: [0.15, 0.25, 0.4, 0.6, 0.9, 1.3],
  /** Mean of activity and dynamics under which levels 2…7 start. */
  trend: [0.2, 0, -0.2, -0.4, -0.6, -0.8],
  /** Days of capital left under which levels 2…7 start. */
  runway: [360, 180, 90, 60, 30, 15],
  /** Share of revenue kept as capital under which levels 2…7 start. */
  retention: [0.25, 0.1, 0, -0.25, -0.5, -1],
  /** Days of revenue in reserve under which levels 2…7 start. */
  reserve: [90, 60, 30, 15, 7, 3],
  /** Level by headcount, DG included: 0, 1, 2, 3, 4, then 5 and more. */
  team: [7, 6, 4, 3, 2, 1] as RiskLevel[],
  /** Capital ÷ threshold from which levels 2, 3 and 4 start; level 7 at the threshold itself. */
  exposure: [0.8, 0.9, 0.97],
  weights: {
    volatility: 0.25,
    runway: 0.2,
    retention: 0.15,
    reserve: 0.15,
    trend: 0.1,
    team: 0.1,
    exposure: 0.05,
  } satisfies Record<RiskIndexId, number>,
  /**
   * Indices that signal an immediate danger (capital running out, capital open to piracy): the
   * profile never sits more than `floorGap` levels below the worst of them.
   */
  critical: ["runway", "exposure"] as RiskIndexId[],
  floorGap: 2,
  /** Fewer measured indices than this and the profile would say more than the data. */
  minMeasured: 5,
} as const;

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  1: "très faible",
  2: "faible",
  3: "contenu",
  4: "modéré",
  5: "élevé",
  6: "très élevé",
  7: "critique",
};

export const RISK_INDICES: readonly {
  id: RiskIndexId;
  label: string;
  help: string;
  /** Built on KNX's revenue estimates rather than on published figures alone. */
  estimated: boolean;
}[] = [
  {
    id: "volatility",
    label: "Volatilité des recettes",
    help: "Écart des recettes mensuelles autour de leur moyenne, sur la fenêtre.",
    estimated: true,
  },
  {
    id: "trend",
    label: "Tendance",
    help: "Activité et dynamique des recettes récentes : un repli relève le risque.",
    estimated: true,
  },
  {
    id: "runway",
    label: "Autonomie",
    help: "Durée avant épuisement du capital s'il continue de baisser au rythme de la fenêtre.",
    estimated: true,
  },
  {
    id: "retention",
    label: "Rétention",
    help: "Part des recettes de la fenêtre restée en capital ; négative quand le capital fond.",
    estimated: true,
  },
  {
    id: "reserve",
    label: "Réserve",
    help: "Capital rapporté à la recette des 30 derniers jours.",
    estimated: true,
  },
  {
    id: "team",
    label: "Équipe",
    help: "Effectif publié, DG inclus : une petite équipe repose sur peu de personnes.",
    estimated: false,
  },
  {
    id: "exposure",
    label: "Exposition au piratage",
    help: "Capital rapporté au seuil de 30 M¢ au-delà duquel une corporation peut être piratée.",
    estimated: false,
  },
];

function clampLevel(level: number): RiskLevel {
  return Math.min(7, Math.max(1, Math.round(level))) as RiskLevel;
}

/** 1 + the number of cuts the value reaches (riskier when higher; cuts ascending). */
export function riskAbove(value: number, cuts: readonly number[]): RiskLevel {
  return clampLevel(1 + cuts.filter((cut) => value >= cut).length);
}

/** 1 + the number of cuts the value falls under (riskier when lower; cuts descending). */
export function riskBelow(value: number, cuts: readonly number[]): RiskLevel {
  return clampLevel(1 + cuts.filter((cut) => value < cut).length);
}

const measured = (index: RiskIndex): index is RiskIndex & { level: RiskLevel } =>
  index.level !== null;

/**
 * Weighted mean of the measured levels, raised to within `floorGap` of the worst critical one: a
 * capital about to run out, or open to piracy, cannot hide behind six quiet indices.
 */
export function profileOf(indices: readonly RiskIndex[]): {
  profile: RiskLevel | null;
  score: number | null;
} {
  const levels = indices.filter(measured);
  if (levels.length < RISK_METHOD.minMeasured) return { profile: null, score: null };
  const weight = (i: RiskIndex) => RISK_METHOD.weights[i.id];
  const total = levels.reduce((sum, i) => sum + weight(i), 0);
  const score = levels.reduce((sum, i) => sum + weight(i) * i.level, 0) / total;
  const critical = levels.filter((i) => RISK_METHOD.critical.includes(i.id));
  const floor = Math.max(1, ...critical.map((i) => i.level - RISK_METHOD.floorGap));
  return { profile: clampLevel(Math.max(Math.round(score), floor)), score };
}

function volatility(points: readonly CompanyPoint[], fromDay: number, toDay: number): RiskIndex {
  const { sampleStep, sampleSpan, minSamples } = RISK_METHOD;
  const rates: number[] = [];
  for (let day = toDay; day - sampleSpan >= fromDay; day -= sampleStep) {
    const rate = rateBetween(points, day - sampleSpan, day);
    if (rate !== null) rates.push(Math.max(0, rate));
  }
  const mean = rates.reduce((sum, r) => sum + r, 0) / (rates.length || 1);
  if (rates.length < minSamples || mean <= 0)
    return { id: "volatility", level: null, value: null, flag: null };
  const sd = Math.sqrt(rates.reduce((sum, r) => sum + (r - mean) ** 2, 0) / rates.length);
  const cv = sd / mean;
  return { id: "volatility", level: riskAbove(cv, RISK_METHOD.volatility), value: cv, flag: null };
}

function trend(scores: CompanyScores): RiskIndex {
  const parts = [scores.activity, scores.dynamics].filter((v): v is number => v !== null);
  if (parts.length === 0) return { id: "trend", level: null, value: null, flag: null };
  const t = parts.reduce((sum, v) => sum + v, 0) / parts.length;
  return { id: "trend", level: riskBelow(t, RISK_METHOD.trend), value: t, flag: null };
}

function runway(points: readonly CompanyPoint[], from: IsoDate, latest: CompanyPoint): RiskIndex {
  const first = points.find((p) => p.date >= from && p.capital !== null);
  const end = latest.capital;
  if (!first || first.capital === null || end === null)
    return { id: "runway", level: null, value: null, flag: null };
  const span = daysBetween(first.date, latest.date);
  if (span < RISK_METHOD.minRunwaySpan)
    return { id: "runway", level: null, value: null, flag: null };
  const burn = (first.capital - end) / span;
  if (burn <= 0) return { id: "runway", level: 1, value: null, flag: "not-declining" };
  const days = end / burn;
  return { id: "runway", level: riskBelow(days, RISK_METHOD.runway), value: days, flag: null };
}

function retention(points: readonly CompanyPoint[], from: IsoDate, capital: number | null) {
  const bridge = treasuryBridge(points, from);
  if (!bridge || bridge.earned <= 0)
    return { id: "retention", level: null, value: null, flag: null } satisfies RiskIndex;
  const kept = (bridge.end.capital - bridge.start.capital) / bridge.earned;
  const ceiling = RISK_METHOD.piracyThreshold * RISK_METHOD.ceilingShare;
  if (capital !== null && capital >= ceiling)
    return { id: "retention", level: null, value: kept, flag: "capped" } satisfies RiskIndex;
  return {
    id: "retention",
    level: riskBelow(kept, RISK_METHOD.retention),
    value: kept,
    flag: null,
  } satisfies RiskIndex;
}

function reserve(capital: number | null, rate: number | null): RiskIndex {
  if (capital === null || rate === null || rate <= 0)
    return { id: "reserve", level: null, value: null, flag: null };
  const days = capital / rate;
  return {
    id: "reserve",
    level: riskBelow(days, RISK_METHOD.reserve),
    value: days,
    flag: days > RISK_METHOD.dormantReserveDays ? "dormant" : null,
  };
}

function team(employees: number | null): RiskIndex {
  if (employees === null) return { id: "team", level: null, value: null, flag: null };
  const table = RISK_METHOD.team;
  return {
    id: "team",
    level: table[Math.min(Math.max(0, employees), table.length - 1)],
    value: employees,
    flag: null,
  };
}

function exposure(capital: number | null): RiskIndex {
  if (capital === null) return { id: "exposure", level: null, value: null, flag: null };
  const ratio = capital / RISK_METHOD.piracyThreshold;
  if (ratio >= 1) return { id: "exposure", level: 7, value: ratio, flag: "exposed" };
  return {
    id: "exposure",
    level: riskAbove(ratio, RISK_METHOD.exposure),
    value: ratio,
    flag: null,
  };
}

export interface RiskInput {
  status: CompanyStatus;
  points: readonly CompanyPoint[];
  latest: CompanyPoint;
  scores: CompanyScores;
  /** Real revenue per day over the last 30 days. Estimated. */
  recentRate: number | null;
}

/**
 * Risk profile of a listed, active corporation as of `asOf` (the latest report); null for a
 * corporation at rest or closed, whose figures no longer describe a running business.
 */
export function assessRisk(company: RiskInput, asOf: IsoDate): CompanyRisk | null {
  if (company.status !== "active") return null;
  const from = addDays(asOf, -RISK_METHOD.windowDays);
  const { points, latest } = company;
  const indices: Record<RiskIndexId, RiskIndex> = {
    volatility: volatility(points, toDayNumber(from), toDayNumber(asOf)),
    trend: trend(company.scores),
    runway: runway(points, from, latest),
    retention: retention(points, from, latest.capital),
    reserve: reserve(latest.capital, company.recentRate),
    team: team(latest.employees),
    exposure: exposure(latest.capital),
  };
  const ordered = RISK_INDICES.map((info) => indices[info.id]);
  const above = points.filter(
    (p) => p.date >= from && p.capital !== null && p.capital >= RISK_METHOD.piracyThreshold,
  );
  return {
    ...profileOf(ordered),
    indices: ordered,
    measured: ordered.filter(measured).length,
    from,
    to: asOf,
    regime: regimeOf(company.scores),
    lastAboveThreshold: above.at(-1)?.date ?? null,
  };
}
