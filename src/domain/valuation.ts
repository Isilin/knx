import {
  BALANCE_ITEMS,
  figureAge,
  figuresOn,
  type BalanceItem,
  type BalanceSheet,
  type KnownFigure,
} from "./balance.ts";
import { addDays, daysBetween, toDayNumber } from "./dates.ts";
import type { CompanyPoint, CompanySeries } from "./market.ts";
import type { CompanyRating, RatingCategory, RatingConfidence } from "./rating.ts";
import { SECTORS, type SectorId } from "./sectors.ts";
import { sortFigures, wageOn, wagesBetween, type WageRate } from "./wages.ts";
import {
  listingSteps,
  stepOn,
  type ListingState,
  type ListingStep,
  type SecurityOperation,
} from "./securities.ts";
import type { IsoDate } from "./types.ts";

/**
 * KNX theoretical value of a corporation, then its share price once introduced:
 *
 *   margin   = max(0, robust real revenue − wages)
 *   business = (revenue days × margin × maturity + capital weight × retained capital)
 *              × multiplier of the Agence's category
 *   value    = business + premises + stock
 *
 * - robust real revenue: KNX's real revenue per day over the window, each day capped at a few
 *   ordinary days of the corporation (a director can sell himself one item at any price, then
 *   take the credits back: a one-day spike must not lift the value for a month);
 * - wages: the mean daily wages over the same window, the paid headcount at the wage in force
 *   (the reference of the sector, or the one the Agence audited); paying the team is what the
 *   business costs. Days without a known headcount (before August 2025) take nothing off;
 * - maturity: age ÷ (age + half-maturity), bounded by one: a young house is worth less;
 * - retained capital: the lower of today's capital and its recent mean (an injection counts once
 *   it stays, a withdrawal at once), discounted because the director can take it out tomorrow;
 * - multiplier and band: from the rating in force that day, or the unrated ones;
 * - premises and stock: from the balance sheets the operator records (declared by the direction
 *   or audited), each item at its own weight, a declared figure discounted; a stock fades as the
 *   days pass without a new figure. A plot is worth its price whatever the rating: assets stay
 *   out of the multiplier and the band.
 *
 * The whole history is computed with the settings in force: a theoretical value is a measure,
 * and a change of settings is published, not slipped into one day of the series.
 */

/** v2: the business is worth its margin after wages, not its revenue (28 November 2026). */
export const VALUATION_METHOD = "v2";

export interface ValuationParams {
  /** Days of revenue the business is worth, like a goodwill (fonds de commerce). */
  revenueDays: number;
  /** Days of real revenue read, before each report. */
  revenueWindow: number;
  /** A day counts at most this many ordinary days of the corporation. */
  spikeCap: number;
  /** Days before each period that set the corporation's ordinary day (median of active days). */
  spikeLookback: number;
  /** Age, in days, at which the maturity factor reaches one half. */
  maturityHalf: number;
  /** Share of the retained capital counted in the value. */
  capitalWeight: number;
  /** Days over which the capital is averaged. */
  capitalWindow: number;
  categoryMultipliers: Record<RatingCategory, number>;
  /** Multiplier of a corporation without a rating in force: opacity has a price. */
  unratedMultiplier: number;
  /** Half-width of the published range, by confidence of the rating. */
  confidenceBands: Record<RatingConfidence, number>;
  unratedBand: number;
  /** Days after which a rating no longer counts: the corporation reads as unrated. */
  ratingValidity: number;
  /** Days of known real revenue needed before KNX values a corporation. */
  minHistory: number;
  /** First share price KNX proposes at an introduction. */
  introductionPrice: number;
  /** Share of the plot's price counted: it sells on its own. */
  landWeight: number;
  /** Share of the building's price counted: it sells with its plot. */
  buildingWeight: number;
  /** Share of the fittings counted (decoration, security, furniture): they sell with the shop. */
  fittingsWeight: number;
  /** Share of the stock's purchase cost counted. */
  stockWeight: number;
  /** Weight of a figure the direction declared, against one the Agence audited (counted in full). */
  declaredWeight: number;
  /** Days over which a stock fades to nothing without a new figure: it sells. */
  stockLife: number;
  /**
   * Weight of a declared figure once the corporation is listed: real credits ride on its price,
   * so only what the Agence audited should count.
   */
  listedDeclaredWeight: number;
  /** Share of each trade's amount the exchange keeps, from buyers and sellers alike. */
  commission: number;
  /** Largest share of a corporation's shares one offer may sell. */
  maxOffer: number;
  /** How far an offer's price may stand from the KNX price, either way. */
  offerBand: number;
  /** Share of an order's amount charged each time it is carried to the next session. */
  carryFee: number;
  /**
   * Reference wage of a paid employee, in credits a day, by sector: what KNX assumes a
   * corporation pays when the Agence has no audited figure for it. The DG is not paid.
   */
  sectorWages: Record<SectorId, number>;
  /** Reference wage of a corporation filed under no sector. */
  defaultWage: number;
  /**
   * Daily wage under which the Agence reads wages as « insuffisants pour vivre au quotidien »:
   * filling hunger and thirst costs about 1 000 ¢, more than once a day for an active character.
   */
  livingWage: number;
  /** Share of the sector's reference wage from which wages read as « cohérents ». */
  coherentWageShare: number;
}

export const DEFAULT_VALUATION: ValuationParams = {
  revenueDays: 30,
  revenueWindow: 30,
  spikeCap: 4,
  spikeLookback: 90,
  maturityHalf: 90,
  capitalWeight: 0.5,
  capitalWindow: 30,
  categoryMultipliers: {
    omega: 1.2,
    alpha: 1.1,
    beta: 1,
    gamma: 0.9,
    delta: 0.8,
    epsilon: 0.65,
  },
  unratedMultiplier: 0.85,
  confidenceBands: { high: 0.1, standard: 0.2, low: 0.35 },
  unratedBand: 0.35,
  ratingValidity: 150,
  minHistory: 7,
  introductionPrice: 1000,
  landWeight: 1,
  buildingWeight: 0.8,
  fittingsWeight: 0.5,
  stockWeight: 1,
  declaredWeight: 0.5,
  stockLife: 30,
  listedDeclaredWeight: 0,
  commission: 0.01,
  maxOffer: 0.49,
  offerBand: 0.2,
  carryFee: 0.002,
  // Mean wage of the paid employees of each sector, symbolic wages included, rounded to the
  // hundred: the survey of every corporation's wages of 17 April 2026 (48 corporations, 128
  // paid employees).
  sectorWages: {
    "agence-immobiliere": 4700,
    banque: 4400,
    "bar-restaurant": 4500,
    "boutique-armes": 4400,
    "boutique-equipement": 4800,
    "boutique-specialisee": 6000,
    "usine-production": 4300,
    technopole: 5300,
    "atelier-personnalisation": 8900,
  },
  defaultWage: 5400,
  livingWage: 2000,
  coherentWageShare: 0.8,
};

/** Bounds of each lever, checked before publishing settings. */
export const PARAM_BOUNDS = {
  revenueDays: [1, 3650],
  revenueWindow: [7, 365],
  spikeCap: [1.5, 100],
  spikeLookback: [14, 720],
  maturityHalf: [0, 3650],
  capitalWeight: [0, 1],
  capitalWindow: [1, 365],
  multiplier: [0.1, 3],
  band: [0, 0.9],
  ratingValidity: [1, 3650],
  minHistory: [1, 90],
  introductionPrice: [1, 1_000_000],
  assetWeight: [0, 1],
  stockLife: [1, 365],
  commission: [0, 0.1],
  maxOffer: [0.01, 0.99],
  offerBand: [0, 0.9],
  carryFee: [0, 0.05],
  wage: [0, 100_000],
  coherentWageShare: [0, 2],
} as const;

/** A published version of the settings. The latest one is in force. */
export interface ValuationSettings {
  id: string;
  /** Date it took effect. */
  date: IsoDate;
  /** Version of the formula the settings were set for. */
  method: string;
  params: ValuationParams;
  /** Why the levers moved, published with them. */
  note: string | null;
}

const RATING_CATEGORIES: readonly RatingCategory[] = [
  "omega",
  "alpha",
  "beta",
  "gamma",
  "delta",
  "epsilon",
];
const CONFIDENCES: readonly RatingConfidence[] = ["high", "standard", "low"];
const SECTOR_IDS: readonly SectorId[] = SECTORS.map((s) => s.id);

/** Settings as stored or typed: every lever a finite number, missing ones from the defaults. */
export function cleanParams(raw: unknown): ValuationParams {
  const r = (raw ?? {}) as Partial<Record<keyof ValuationParams, unknown>>;
  const num = (value: unknown, fallback: number) => {
    const n = typeof value === "string" ? Number(value) : value;
    return typeof n === "number" && Number.isFinite(n) ? n : fallback;
  };
  const record = <K extends string>(
    value: unknown,
    keys: readonly K[],
    fallback: Record<K, number>,
  ) => {
    const v = (value ?? {}) as Partial<Record<K, unknown>>;
    return Object.fromEntries(keys.map((k) => [k, num(v[k], fallback[k])])) as Record<K, number>;
  };
  const d = DEFAULT_VALUATION;
  return {
    revenueDays: num(r.revenueDays, d.revenueDays),
    revenueWindow: num(r.revenueWindow, d.revenueWindow),
    spikeCap: num(r.spikeCap, d.spikeCap),
    spikeLookback: num(r.spikeLookback, d.spikeLookback),
    maturityHalf: num(r.maturityHalf, d.maturityHalf),
    capitalWeight: num(r.capitalWeight, d.capitalWeight),
    capitalWindow: num(r.capitalWindow, d.capitalWindow),
    categoryMultipliers: record(r.categoryMultipliers, RATING_CATEGORIES, d.categoryMultipliers),
    unratedMultiplier: num(r.unratedMultiplier, d.unratedMultiplier),
    confidenceBands: record(r.confidenceBands, CONFIDENCES, d.confidenceBands),
    unratedBand: num(r.unratedBand, d.unratedBand),
    ratingValidity: num(r.ratingValidity, d.ratingValidity),
    minHistory: num(r.minHistory, d.minHistory),
    introductionPrice: num(r.introductionPrice, d.introductionPrice),
    landWeight: num(r.landWeight, d.landWeight),
    buildingWeight: num(r.buildingWeight, d.buildingWeight),
    fittingsWeight: num(r.fittingsWeight, d.fittingsWeight),
    stockWeight: num(r.stockWeight, d.stockWeight),
    declaredWeight: num(r.declaredWeight, d.declaredWeight),
    stockLife: num(r.stockLife, d.stockLife),
    listedDeclaredWeight: num(r.listedDeclaredWeight, d.listedDeclaredWeight),
    commission: num(r.commission, d.commission),
    maxOffer: num(r.maxOffer, d.maxOffer),
    offerBand: num(r.offerBand, d.offerBand),
    carryFee: num(r.carryFee, d.carryFee),
    sectorWages: record(r.sectorWages, SECTOR_IDS, d.sectorWages),
    defaultWage: num(r.defaultWage, d.defaultWage),
    livingWage: num(r.livingWage, d.livingWage),
    coherentWageShare: num(r.coherentWageShare, d.coherentWageShare),
  };
}

/** Checks every lever against its bounds; throws in the operator's words. */
export function checkParams(params: ValuationParams): void {
  const within = (label: string, value: number, [min, max]: readonly [number, number]) => {
    if (!(value >= min && value <= max)) throw new Error(`${label} : entre ${min} et ${max}`);
  };
  const whole = (label: string, value: number) => {
    if (!Number.isInteger(value)) throw new Error(`${label} : un nombre entier de jours`);
  };
  const b = PARAM_BOUNDS;
  within("Jours de recettes", params.revenueDays, b.revenueDays);
  within("Fenêtre du CA", params.revenueWindow, b.revenueWindow);
  whole("Fenêtre du CA", params.revenueWindow);
  within("Écrêtement des pics", params.spikeCap, b.spikeCap);
  within("Historique du jour ordinaire", params.spikeLookback, b.spikeLookback);
  whole("Historique du jour ordinaire", params.spikeLookback);
  within("Demi-maturité", params.maturityHalf, b.maturityHalf);
  within("Poids du capital", params.capitalWeight, b.capitalWeight);
  within("Fenêtre du capital", params.capitalWindow, b.capitalWindow);
  whole("Fenêtre du capital", params.capitalWindow);
  for (const c of RATING_CATEGORIES)
    within(`Multiplicateur ${c}`, params.categoryMultipliers[c], b.multiplier);
  within("Multiplicateur non notée", params.unratedMultiplier, b.multiplier);
  for (const c of CONFIDENCES) within(`Fourchette ${c}`, params.confidenceBands[c], b.band);
  within("Fourchette non notée", params.unratedBand, b.band);
  within("Validité d'une notation", params.ratingValidity, b.ratingValidity);
  whole("Validité d'une notation", params.ratingValidity);
  within("Historique minimal", params.minHistory, b.minHistory);
  whole("Historique minimal", params.minHistory);
  within("Cours d'introduction proposé", params.introductionPrice, b.introductionPrice);
  within("Poids du terrain", params.landWeight, b.assetWeight);
  within("Poids du bâtiment", params.buildingWeight, b.assetWeight);
  within("Poids de l'aménagement", params.fittingsWeight, b.assetWeight);
  within("Poids du stock", params.stockWeight, b.assetWeight);
  within("Poids d'un chiffre déclaré", params.declaredWeight, b.assetWeight);
  within("Durée de vie du stock", params.stockLife, b.stockLife);
  whole("Durée de vie du stock", params.stockLife);
  within("Chiffre déclaré, corporation cotée", params.listedDeclaredWeight, b.assetWeight);
  within("Commission", params.commission, b.commission);
  within("Part maximale d'une offre", params.maxOffer, b.maxOffer);
  within("Bande du prix d'offre", params.offerBand, b.offerBand);
  within("Frais de report", params.carryFee, b.carryFee);
  const credits = (label: string, value: number) => {
    within(label, value, b.wage);
    if (!Number.isInteger(value)) throw new Error(`${label} : un nombre entier de crédits`);
  };
  for (const s of SECTORS) credits(`Salaire de référence, ${s.short}`, params.sectorWages[s.id]);
  credits("Salaire de référence, tous secteurs", params.defaultWage);
  credits("Minimum vital", params.livingWage);
  within("Seuil des salaires cohérents", params.coherentWageShare, b.coherentWageShare);
}

/** The settings in force: the latest published version, or the defaults. */
export function settingsInForce(versions: readonly ValuationSettings[]): {
  params: ValuationParams;
  version: ValuationSettings | null;
} {
  const version = versions.at(-1) ?? null;
  return { params: version?.params ?? DEFAULT_VALUATION, version };
}

/** Published versions, oldest first. */
export function sortSettings(versions: readonly ValuationSettings[]): ValuationSettings[] {
  return [...versions].sort((a, b) => a.date.localeCompare(b.date));
}

// ——— Revenue ———

/** Real revenue per day over the days `(from, to]`, from one report to the next. */
interface Period {
  from: number;
  to: number;
  value: number;
}

/**
 * Periods of known real revenue of a life. A report at 0 means the corporation earned nothing
 * since the previous one; a period after a report at 0 is unknown and left out.
 */
function revenuePeriods(points: readonly CompanyPoint[]): Period[] {
  const periods: Period[] = [];
  for (let k = 1; k < points.length; k++) {
    const p = points[k];
    const from = toDayNumber(points[k - 1].date);
    const to = toDayNumber(p.date);
    if (to <= from) continue;
    if (p.realDaily !== null) periods.push({ from, to, value: p.realDaily });
    else if (p.chiffre === 0) periods.push({ from, to, value: 0 });
  }
  return periods;
}

/**
 * Periods of known wages of a life, per day: the paid headcount of both reports at the wage in
 * force. A period whose headcount is unknown (before August 2025) is left out.
 */
function wagePeriods(points: readonly CompanyPoint[], wageOf: (date: IsoDate) => number): Period[] {
  const periods: Period[] = [];
  for (let k = 1; k < points.length; k++) {
    const p = points[k];
    const from = toDayNumber(points[k - 1].date);
    const to = toDayNumber(p.date);
    if (to <= from) continue;
    const paid = wagesBetween(points[k - 1].employees, p.employees, to - from, wageOf(p.date));
    if (paid !== null) periods.push({ from, to, value: paid / (to - from) });
  }
  return periods;
}

const overlap = (p: Period, from: number, to: number) =>
  Math.max(0, Math.min(p.to, to) - Math.max(p.from, from));

/** Revenue and wages of a life, with each period's capped revenue worked out once. */
class RevenueBook {
  private readonly periods: Period[];
  private readonly wages: Period[];
  private readonly params: ValuationParams;
  private readonly capped = new Map<number, number>();

  constructor(
    points: readonly CompanyPoint[],
    params: ValuationParams,
    wageOf: (date: IsoDate) => number,
  ) {
    this.periods = revenuePeriods(points);
    this.wages = wagePeriods(points, wageOf);
    this.params = params;
  }

  /**
   * Mean daily wages over the revenue window ending on `day`, on the days whose headcount is
   * known; 0 when none is (wages unknown, nothing taken off).
   */
  payroll(day: number): number {
    const start = day - this.params.revenueWindow;
    let days = 0;
    let paid = 0;
    for (const p of this.wages) {
      if (p.to <= start || p.from >= day) continue;
      const d = overlap(p, start, day);
      days += d;
      paid += d * p.value;
    }
    return days > 0 ? paid / days : 0;
  }

  /** Median active day over the `spikeLookback` days before `end`; null with too few. */
  private ordinaryDay(end: number): number | null {
    const start = end - this.params.spikeLookback;
    const items: [value: number, days: number][] = [];
    let total = 0;
    for (const p of this.periods) {
      if (p.from >= end) break;
      if (p.to <= start || p.value <= 0) continue;
      const days = overlap(p, start, end);
      if (days > 0) {
        items.push([p.value, days]);
        total += days;
      }
    }
    if (total < this.params.minHistory) return null;
    items.sort((a, b) => a[0] - b[0]);
    let seen = 0;
    for (const [value, days] of items) {
      seen += days;
      if (seen >= total / 2) return value;
    }
    return items[items.length - 1][0];
  }

  private cappedValue(index: number): number {
    let value = this.capped.get(index);
    if (value === undefined) {
      const p = this.periods[index];
      const ordinary = p.value > 0 ? this.ordinaryDay(p.from) : null;
      value = ordinary === null ? p.value : Math.min(p.value, this.params.spikeCap * ordinary);
      this.capped.set(index, value);
    }
    return value;
  }

  /** Mean real revenue over the window ending on `day`: capped, raw, and the days known. */
  window(day: number): { capped: number; raw: number; days: number } | null {
    const start = day - this.params.revenueWindow;
    let days = 0;
    let capped = 0;
    let raw = 0;
    this.periods.forEach((p, index) => {
      if (p.to <= start || p.from >= day) return;
      const d = overlap(p, start, day);
      days += d;
      raw += d * p.value;
      capped += d * this.cappedValue(index);
    });
    if (days < this.params.minHistory) return null;
    return { capped: capped / days, raw: raw / days, days };
  }
}

// ——— Value ———

/** What the value reads of a life: its reports, and what sets its wages. */
export type ValuedLife = Pick<CompanySeries, "points" | "sector" | "wageFigures">;

/** An asset of the balance sheet as the value counts it. */
export interface CountedAsset extends KnownFigure {
  /** Credits counted in the value: amount × item weight × source weight (× fading, stock). */
  counted: number;
  /** Weight of its source: 1 audited, the declared weight otherwise. */
  trust: number;
  /** Stock only: share left after fading, 0–1. */
  fade?: number;
}

export interface ValuationPoint {
  date: IsoDate;
  /** Theoretical value of the corporation, in credits: business + premises + stock. */
  value: number;
  /** Published range: the business × (1 ± band), the assets as counted. */
  low: number;
  high: number;
  /** Base × multiplier: the going concern, before what it owns. */
  business: number;
  /** Premises counted: plot, building, fittings. */
  premises: number;
  /** Stock counted. */
  stock: number;
  /** Each item of the balance sheet in force that day; null when never given. */
  assets: Record<BalanceItem, CountedAsset | null>;
  /** Revenue days × margin × maturity. */
  operating: number;
  /** Mean daily wages over the window (0 when the headcount is unknown). Estimated. */
  payroll: number;
  /** Robust revenue less the wages, per day, never below 0. */
  margin: number;
  /** Capital weight × retained capital. */
  capital: number;
  /** Operating + capital, before the Agence's multiplier. */
  base: number;
  multiplier: number;
  band: number;
  /** Robust real revenue per day over the window. */
  revenue: number;
  /** The same mean without capping: the gap is what the capping removed. */
  rawRevenue: number;
  /** Days of known revenue in the window. */
  revenueDays: number;
  /** Activity days of the life. */
  age: number;
  maturity: number;
  /** Lower of the day's capital and its recent mean. */
  retainedCapital: number;
  /** Rating in force that day; null: unrated (or rating too old). */
  rating: CompanyRating | null;
}

/** Rating in force on `date`: the latest one on or before it, unless too old. */
export function ratingInForce(
  ratings: readonly CompanyRating[],
  date: IsoDate,
  validity: number,
): CompanyRating | null {
  let found: CompanyRating | null = null;
  for (const r of ratings) if (r.date <= date && (!found || r.date >= found.date)) found = r;
  return found && daysBetween(found.date, date) <= validity ? found : null;
}

/** Everything needed to value one life on any of its report dates. */
export class LifeValuation {
  readonly life: ValuedLife;
  readonly params: ValuationParams;
  private readonly ratings: readonly CompanyRating[];
  private readonly sheets: readonly BalanceSheet[];
  private readonly steps: ListingStep[];
  private readonly book: RevenueBook;
  private readonly cache = new Map<number, ValuationPoint | null>();

  constructor(
    life: ValuedLife,
    ratings: readonly CompanyRating[],
    params: ValuationParams,
    sheets: readonly BalanceSheet[] = [],
    operations: readonly SecurityOperation[] = [],
  ) {
    this.life = life;
    this.ratings = ratings;
    this.params = params;
    this.sheets = sheets;
    this.steps = listingSteps(operations);
    // The wages follow these settings, not those of the market: a draft of the levers moves them.
    const figures = sortFigures(life.wageFigures);
    this.book = new RevenueBook(
      life.points,
      params,
      (date) => wageOn(figures, life.sector, params, date).wage,
    );
  }

  /** The wage in force on `date` with these settings, and where it comes from. */
  wageOn(date: IsoDate): WageRate {
    return wageOn(sortFigures(this.life.wageFigures), this.life.sector, this.params, date);
  }

  /** The balance sheet in force on `date`, each item counted at its weight. */
  assetsOn(date: IsoDate): Record<BalanceItem, CountedAsset | null> {
    const { params } = this;
    const figures = figuresOn(this.sheets, date);
    // Listed, real credits ride on the price: a declared figure weighs what the levers say then.
    const state = stepOn(this.steps, date)?.state;
    const listed = state === "listed" || state === "suspended";
    const declared = listed ? params.listedDeclaredWeight : params.declaredWeight;
    const weights: Record<BalanceItem, number> = {
      land: params.landWeight,
      building: params.buildingWeight,
      fittings: params.fittingsWeight,
      stock: params.stockWeight,
    };
    const counted = {} as Record<BalanceItem, CountedAsset | null>;
    for (const item of BALANCE_ITEMS) {
      const figure = figures[item];
      if (!figure) {
        counted[item] = null;
        continue;
      }
      const trust = figure.source === "audited" ? 1 : declared;
      const fade =
        item === "stock" ? Math.max(0, 1 - figureAge(figure, date) / params.stockLife) : undefined;
      counted[item] = {
        ...figure,
        trust,
        counted: figure.amount * weights[item] * trust * (fade ?? 1),
        ...(fade === undefined ? {} : { fade }),
      };
    }
    return counted;
  }

  /** Value on the report at `index`; null when KNX cannot say (no age, too little history). */
  at(index: number): ValuationPoint | null {
    if (this.cache.has(index)) return this.cache.get(index) ?? null;
    const value = this.compute(index);
    this.cache.set(index, value);
    return value;
  }

  private compute(index: number): ValuationPoint | null {
    const points = this.life.points;
    const p = points[index];
    if (!p || p.days === null) return null;
    const day = toDayNumber(p.date);
    const revenue = this.book.window(day);
    if (!revenue) return null;
    const { params } = this;
    const maturity = p.days / (p.days + params.maturityHalf);
    // Capital: the day's figure, held down to its recent mean.
    let sum = 0;
    let count = 0;
    for (let k = index; k >= 0; k--) {
      const q = points[k];
      if (toDayNumber(q.date) <= day - params.capitalWindow) break;
      if (q.capital !== null) {
        sum += q.capital;
        count += 1;
      }
    }
    const mean = count > 0 ? sum / count : 0;
    const retainedCapital = Math.max(0, p.capital === null ? mean : Math.min(p.capital, mean));
    const rating = ratingInForce(this.ratings, p.date, params.ratingValidity);
    const multiplier = rating
      ? params.categoryMultipliers[rating.category]
      : params.unratedMultiplier;
    const band = rating ? params.confidenceBands[rating.confidence] : params.unratedBand;
    const payroll = this.book.payroll(day);
    // Paying the team is what the business costs: it is worth what is left, never less than 0.
    const margin = Math.max(0, revenue.capped - payroll);
    const operating = params.revenueDays * margin * maturity;
    const capital = params.capitalWeight * retainedCapital;
    const base = operating + capital;
    const business = base * multiplier;
    const assets = this.assetsOn(p.date);
    const premises =
      (assets.land?.counted ?? 0) +
      (assets.building?.counted ?? 0) +
      (assets.fittings?.counted ?? 0);
    const stock = assets.stock?.counted ?? 0;
    const owned = premises + stock;
    return {
      date: p.date,
      value: business + owned,
      low: business * (1 - band) + owned,
      high: business * (1 + band) + owned,
      business,
      premises,
      stock,
      assets,
      operating,
      payroll,
      margin,
      capital,
      base,
      multiplier,
      band,
      revenue: revenue.capped,
      rawRevenue: revenue.raw,
      revenueDays: revenue.days,
      age: p.days,
      maturity,
      retainedCapital,
      rating,
    };
  }

  /** Index of the latest report on or before `date`; −1 when none. */
  indexOn(date: IsoDate): number {
    const points = this.life.points;
    for (let k = points.length - 1; k >= 0; k--) if (points[k].date <= date) return k;
    return -1;
  }

  /** Value on the latest report on or before `date`. */
  on(date: IsoDate): ValuationPoint | null {
    const index = this.indexOn(date);
    return index < 0 ? null : this.at(index);
  }

  /** Value on every report on or after `from` (all of them when null). */
  history(from: IsoDate | null = null): ValuationPoint[] {
    const out: ValuationPoint[] = [];
    this.life.points.forEach((p, index) => {
      if (from && p.date < from) return;
      const v = this.at(index);
      if (v) out.push(v);
    });
    return out;
  }
}

// ——— Summary for the cote ———

export interface CompanyListing {
  state: ListingState;
  introducedOn: IsoDate;
  /** Shares outstanding today. */
  shares: number;
  /** When the current state began: introduction, suspension, resumption or exit. */
  since: IsoDate;
  /** Note of the operation that set the current state. */
  note: string | null;
  /**
   * Share price: today's for a listed corporation; the last one published before a suspension
   * or an exit. Null when KNX could not value it that day.
   */
  price: number | null;
  /** Date of that price. */
  priceDate: IsoDate | null;
}

export interface CompanyValuation {
  /** `observation`: too little known revenue yet; `unknown-age`: no creation date to read. */
  status: "valued" | "observation" | "unknown-age";
  latest: ValuationPoint | null;
  /** Change of value since the previous report, a week and a month earlier. */
  change: { report: number | null; week: number | null; month: number | null };
  /**
   * Report each change is read from: reports are not daily, so « a week earlier » is the latest
   * report at least seven days older, which can be older still.
   */
  changeFrom: { report: IsoDate | null; week: IsoDate | null; month: IsoDate | null };
  listing: CompanyListing | null;
}

const ratio = (now: ValuationPoint | null, then: ValuationPoint | null) =>
  now && then && then.value > 0 ? now.value / then.value - 1 : null;

/** What the cote and the page header show of a life's value and listing. */
export function summarizeValuation(
  valuation: LifeValuation,
  operations: readonly SecurityOperation[],
): CompanyValuation {
  const points = valuation.life.points;
  const last = points.length - 1;
  const latest = valuation.at(last);
  const lastDate = points[last].date;
  const previous = last > 0 ? valuation.at(last - 1) : null;
  const shift = (days: number) => {
    const day = toDayNumber(lastDate) - days;
    for (let k = last - 1; k >= 0; k--)
      if (toDayNumber(points[k].date) <= day) return valuation.at(k);
    return null;
  };
  const week = shift(7);
  const month = shift(30);
  const status = latest ? "valued" : points[last].days === null ? "unknown-age" : "observation";

  const step = listingSteps(operations).at(-1) ?? null;
  let listing: CompanyListing | null = null;
  if (step) {
    // Suspended or withdrawn: the last price published, on the report before that day. Prices
    // are always read with today's share count, like the chart.
    const priced = step.state === "listed" ? latest : valuation.on(addDays(step.date, -1));
    listing = {
      state: step.state,
      introducedOn: step.introducedOn,
      shares: step.shares,
      since: step.date,
      note: step.operation.note,
      price: priced ? priced.value / step.shares : null,
      priceDate: priced?.date ?? null,
    };
  }
  return {
    status,
    latest,
    change: {
      report: ratio(latest, previous),
      week: ratio(latest, week),
      month: ratio(latest, month),
    },
    changeFrom: {
      report: latest && previous ? previous.date : null,
      week: latest && week ? week.date : null,
      month: latest && month ? month.date : null,
    },
    listing,
  };
}

/**
 * Share price over time, adjusted to today's share count: divisions and consolidations never
 * show as a fall or a jump. Only the days the shares were listed; null while suspended.
 */
export function priceHistory(
  values: readonly ValuationPoint[],
  operations: readonly SecurityOperation[],
): { date: IsoDate; value: number | null }[] {
  const steps = listingSteps(operations);
  const current = steps.at(-1);
  if (!current) return [];
  const shares = current.shares;
  return values
    .filter((v) => v.date >= current.introducedOn)
    .map((v) => {
      const step = stepOn(steps, v.date);
      if (!step || step.introducedOn !== current.introducedOn) return { date: v.date, value: null };
      return { date: v.date, value: step.state === "listed" ? v.value / shares : null };
    });
}
