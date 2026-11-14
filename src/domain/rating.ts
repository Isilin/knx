import { creationReliability, type CreationEstimate } from "./age.ts";
import { addDays, daysBetween, toDayNumber } from "./dates.ts";
import type { CompanyPoint, CompanyScores, CompanyStatus } from "./market.ts";
import { formatDecimal, formatPercent } from "./numbers.ts";
import { regimeOf } from "./regimes.ts";
import { rateBetween } from "./revenue.ts";
import { RISK_METHOD } from "./risk.ts";
import { treasuryBridge } from "./treasury.ts";
import type { Consortium, IsoDate } from "./types.ts";

/**
 * Notation of the Agence impériale de notation des entreprises: eleven criteria on three axes,
 * each scored 0–5 or left out when it does not apply, combined into a score that maps to one of
 * six categories, with a confidence index. A rating is a dated act: what KNX computed and what
 * the operator typed are frozen in it, and the method it followed is recorded by version.
 */

export type RatingCategory = "omega" | "alpha" | "beta" | "gamma" | "delta" | "epsilon";
export type RatingConfidence = "high" | "standard" | "low";
export type RatingOutlook = "positive" | "stable" | "negative";
export type RatingAxis = "accounting" | "economic" | "imperial";
/** Where the corporation is set up: Centre-Ville, Basse-Ville, Haute-Ville. */
export type District = "cv" | "bv" | "hv";

export type CriterionId =
  | "growth"
  | "treasury"
  | "profitability"
  | "wages"
  | "team"
  | "advertising"
  | "integration"
  | "tenders"
  | "legality"
  | "location"
  | "society";

/** `report`: read in the game's report; `estimate`: computed by KNX; `agency`: typed. */
export type CriterionSource = "report" | "estimate" | "agency";

export type WagesLevel = "insufficient" | "decent" | "coherent";
export type PresenceLevel = "none" | "occasional" | "regular";
export type Transparency = "complete" | "partial" | "none" | "inconsistent" | "contradictory";

/** What the operator assesses by hand; everything else KNX reads or computes. */
export interface RatingInputs {
  /** null: not assessed (left out, never held against the corporation). */
  wages: WagesLevel | null;
  advertising: PresenceLevel | null;
  /** Inconsiderate advertising spam. */
  spam: boolean;
  integration: { guild: boolean; logistics: boolean; partnerships: boolean; projects: boolean };
  /** Out of the last five tenders of the sector; null or none held: left out. */
  tenders: { held: number; joined: number; prices: "respected" | "partly" | "ignored" } | null;
  /** Proven irregularities; none ticked reads as none known. */
  legality: { blacklist: boolean; acivis: boolean; wanted: boolean };
  society: PresenceLevel | null;
  /** A large reserve backed by an investment plan the corporation showed. */
  treasuryJustified: boolean;
  transparency: Transparency;
}

export interface CriterionScore {
  id: CriterionId;
  axis: RatingAxis;
  /** 0–5; null when the criterion does not apply. */
  score: number | null;
  /** The measure in words, frozen with the rating (`+6,2 % par an`, `4 personnes`). */
  value: string | null;
  source: CriterionSource;
  /** Why the criterion is left out or adjusted. */
  note: string | null;
}

export interface RatingAssessment {
  criteria: CriterionScore[];
  axes: { id: RatingAxis; score: number | null }[];
  /** Weighted mean of the axes that apply. */
  base: number | null;
  /** Transparency modulation added to the base. */
  transparency: number;
  /** Final score, 0–5; null when no axis applies. */
  score: number | null;
  category: RatingCategory | null;
  /** Why the score was held under a cap: a proven irregularity, or an incomplete evaluation. */
  capped: "legality" | "coverage" | null;
  /** Share of the method's weight the evaluation covers, 0–1. */
  coverage: number;
  confidence: RatingConfidence;
  /** What moved the confidence away from standard. */
  confidenceReasons: string[];
  /** Suggested from the revenue regime; the operator decides. */
  outlook: RatingOutlook;
}

/** A published rating, as stored. */
export interface CompanyRating {
  id: string;
  companyId: string;
  date: IsoDate;
  /** Version of `RATING_METHOD` the rating followed. */
  method: string;
  category: RatingCategory;
  confidence: RatingConfidence;
  outlook: RatingOutlook;
  score: number;
  axes: { id: RatingAxis; score: number | null }[];
  criteria: CriterionScore[];
  inputs: RatingInputs;
  district: District | null;
  rationale: string | null;
}

type Curve = readonly (readonly [x: number, score: number])[];

export const RATING_METHOD = {
  version: "v1",
  /** Five imperial years (one imperial year is one real month). */
  windowDays: 150,
  axes: { accounting: 0.4, economic: 0.3, imperial: 0.3 } satisfies Record<RatingAxis, number>,
  criteria: {
    growth: { axis: "accounting", weight: 0.3 },
    treasury: { axis: "accounting", weight: 0.25 },
    profitability: { axis: "accounting", weight: 0.3 },
    wages: { axis: "accounting", weight: 0.15 },
    team: { axis: "economic", weight: 0.4 },
    advertising: { axis: "economic", weight: 0.25 },
    integration: { axis: "economic", weight: 0.35 },
    tenders: { axis: "imperial", weight: 0.35 },
    legality: { axis: "imperial", weight: 0.35 },
    location: { axis: "imperial", weight: 0.15 },
    society: { axis: "imperial", weight: 0.15 },
  } satisfies Record<CriterionId, { axis: RatingAxis; weight: number }>,
  /**
   * Yearly growth of real revenue → score (linear between points, flat beyond). Monthly revenue
   * swings by a third or more, so the scale is wide.
   */
  growth: [
    [-0.3, 0],
    [-0.2, 1],
    [-0.1, 2],
    [0, 3],
    [0.1, 4],
    [0.2, 5],
  ] as Curve,
  /** Days of revenue in reserve → score: too little is fragile, too much lies idle. */
  treasury: [
    [0, 0],
    [7, 2],
    [30, 4],
    [60, 5],
    [180, 5],
    [360, 4],
    [720, 2.5],
    [1800, 1],
  ] as Curve,
  /** Above this capital, a corporation can be hacked: holding it is imprudent. */
  piracyCap: 1,
  /** Share of revenue kept as capital over the window → score. */
  profitability: [
    [-1, 0],
    [-0.5, 1],
    [-0.2, 2],
    [0, 3],
    [0.15, 4],
    [0.3, 5],
  ] as Curve,
  wages: { insufficient: 1, decent: 3.5, coherent: 5 } satisfies Record<WagesLevel, number>,
  /** Score by headcount, DG included: 0, 1, 2, … 8 and more. Five is the reference. */
  team: [0, 0, 1, 2.5, 4, 5, 4.5, 4, 3.5],
  advertising: { none: 1, occasional: 3, regular: 5 } satisfies Record<PresenceLevel, number>,
  spamPenalty: 2,
  /** Score by number of engagements (consortium, guild, logistics chain, partnerships, projects). */
  integration: [2, 3, 4, 5],
  tenderPrices: { respected: 0, partly: -1, ignored: -2 },
  /** Score by number of proven irregularities: none, one, two or more. */
  legality: [5, 1, 0],
  /** With a proven irregularity, the final score stays under this (Δ at best). */
  legalityCap: 2.99,
  location: { cv: 5, bv: 4, hv: 2 } satisfies Record<District, number>,
  /** Discretion is not disloyalty: absence stays neutral. */
  society: { none: 3, occasional: 4, regular: 5 } satisfies Record<PresenceLevel, number>,
  transparency: {
    complete: 0.25,
    partial: 0.1,
    none: 0,
    inconsistent: -0.1,
    contradictory: -0.25,
  } satisfies Record<Transparency, number>,
  /** Lowest final score of each category, best first. */
  categories: [
    ["omega", 4.5],
    ["alpha", 4],
    ["beta", 3.5],
    ["gamma", 3],
    ["delta", 2.5],
    ["epsilon", -Infinity],
  ] as const satisfies readonly (readonly [RatingCategory, number])[],
  /** Share of the method's weight that must apply for the evaluation to count as complete. */
  fullCoverage: 0.8,
  thinCoverage: 0.6,
  /** Omega and Alpha need a complete evaluation; otherwise the score stays under this (ß). */
  partialCap: 3.99,
} as const;

export const CATEGORY_INFO: Record<
  RatingCategory,
  { label: string; symbol: string; meaning: string }
> = {
  omega: {
    label: "Omega",
    symbol: "Ω",
    meaning: "Excellence comptable, économique et impériale",
  },
  alpha: { label: "Alpha", symbol: "α", meaning: "Très haut niveau" },
  beta: { label: "Beta", symbol: "ß", meaning: "Entreprise solide et satisfaisante" },
  gamma: {
    label: "Gamma",
    symbol: "Γ",
    meaning: "Niveau intermédiaire, des améliorations sont nécessaires",
  },
  delta: { label: "Delta", symbol: "Δ", meaning: "Faiblesses importantes" },
  epsilon: {
    label: "Epsilon",
    symbol: "ε",
    meaning: "Niveau très faible ou entreprise gravement défaillante",
  },
};

export const CONFIDENCE_INFO: Record<RatingConfidence, { sign: string; label: string }> = {
  high: { sign: "+", label: "confiance élevée" },
  standard: { sign: "", label: "confiance standard" },
  low: { sign: "−", label: "confiance faible" },
};

export const OUTLOOK_LABELS: Record<RatingOutlook, string> = {
  positive: "positive",
  stable: "stable",
  negative: "négative",
};

export const AXIS_LABELS: Record<RatingAxis, string> = {
  accounting: "Comptable",
  economic: "Économique",
  imperial: "Impérial",
};

export const CRITERION_LABELS: Record<CriterionId, string> = {
  growth: "Croissance",
  treasury: "Trésorerie",
  profitability: "Rentabilité",
  wages: "Salaires",
  team: "Équipe",
  advertising: "Publicité",
  integration: "Intégration économique",
  tenders: "Marchés publics",
  legality: "Légalité",
  location: "Localisation",
  society: "Vie impériale",
};

export const DISTRICT_LABELS: Record<District, string> = {
  cv: "Centre-Ville",
  bv: "Basse-Ville",
  hv: "Haute-Ville",
};

export const EMPTY_INPUTS: RatingInputs = {
  wages: null,
  advertising: null,
  spam: false,
  integration: { guild: false, logistics: false, partnerships: false, projects: false },
  tenders: null,
  legality: { blacklist: false, acivis: false, wanted: false },
  society: null,
  treasuryJustified: false,
  transparency: "none",
};

const CATEGORY_ORDER: readonly RatingCategory[] = RATING_METHOD.categories.map(([c]) => c);

/** Rank of a category, 0 for Omega: lower is better. */
export function categoryRank(category: RatingCategory): number {
  return CATEGORY_ORDER.indexOf(category);
}

export function isDistrict(value: unknown): value is District {
  return value === "cv" || value === "bv" || value === "hv";
}

/** Linear between the curve's points, flat beyond its ends. */
export function interpolate(curve: Curve, x: number): number {
  if (x <= curve[0][0]) return curve[0][1];
  for (let k = 1; k < curve.length; k++) {
    const [x1, y1] = curve[k];
    if (x <= x1) {
      const [x0, y0] = curve[k - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return curve[curve.length - 1][1];
}

export function categoryOf(score: number): RatingCategory {
  return RATING_METHOD.categories.find(([, min]) => score >= min)?.[0] ?? "epsilon";
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const clamp5 = (value: number) => Math.min(5, Math.max(0, value));

/** `4,2 ans` for a span of days, in imperial years. */
function years(days: number): string {
  const y = days / 30;
  if (y >= 100) return "plus de 100 ans";
  return `${formatDecimal(y)} ${y < 2 ? "an" : "ans"}`;
}

export interface RatingCompany {
  status: CompanyStatus;
  points: readonly CompanyPoint[];
  latest: CompanyPoint;
  scores: CompanyScores;
  recentRate: number | null;
  creation: CreationEstimate | null;
  consortium: Consortium | null;
}

type CriterionDraft = Omit<CriterionScore, "axis">;

function growth(company: RatingCompany, asOf: IsoDate): CriterionDraft {
  const { creation, points } = company;
  const base = { id: "growth", source: "estimate" } as const;
  if (!creation || creation.method === "first-seen")
    return { ...base, score: null, value: null, note: "date de création inconnue" };
  if (daysBetween(creation.creation, asOf) < RATING_METHOD.windowDays)
    return { ...base, score: null, value: null, note: "moins de cinq ans d'activité" };
  // Real revenue per day over each of the last five imperial years, newest first.
  const day = toDayNumber(asOf);
  const samples: { x: number; y: number }[] = [];
  for (let k = 0; k < 5; k++) {
    const rate = rateBetween(points, day - 30 * (k + 1), day - 30 * k);
    if (rate !== null) samples.push({ x: -k, y: Math.max(0, rate) });
  }
  const mean = samples.reduce((s, p) => s + p.y, 0) / (samples.length || 1);
  if (samples.length < 4 || mean <= 0)
    return { ...base, score: null, value: null, note: "historique des recettes insuffisant" };
  const mx = samples.reduce((s, p) => s + p.x, 0) / samples.length;
  const slope =
    samples.reduce((s, p) => s + (p.x - mx) * (p.y - mean), 0) /
    samples.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  const yearly = slope / mean;
  return {
    ...base,
    score: round2(interpolate(RATING_METHOD.growth, yearly)),
    value: `${formatPercent(yearly)} par an`,
    note: null,
  };
}

function treasury(company: RatingCompany, inputs: RatingInputs): CriterionDraft {
  const capital = company.latest.capital;
  const rate = company.recentRate;
  const base = { id: "treasury", source: "estimate" } as const;
  if (capital === null) return { ...base, score: null, value: null, note: "capital non relevé" };
  if (rate === null || rate <= 0)
    return { ...base, score: null, value: null, note: "aucune recette sur 30 jours" };
  const days = capital / rate;
  const value = `${years(days)} de recettes`;
  if (capital >= RISK_METHOD.piracyThreshold)
    return {
      ...base,
      score: Math.min(RATING_METHOD.piracyCap, interpolate(RATING_METHOD.treasury, days)),
      value,
      note: "capital au-delà du seuil de piratage",
    };
  if (inputs.treasuryJustified && days > 180)
    return { ...base, score: 5, value, note: "réserve justifiée par un plan d'investissement" };
  return { ...base, score: round2(interpolate(RATING_METHOD.treasury, days)), value, note: null };
}

function profitability(company: RatingCompany, asOf: IsoDate): CriterionDraft {
  const base = { id: "profitability", source: "estimate" } as const;
  const capital = company.latest.capital;
  if (capital !== null && capital >= RISK_METHOD.piracyThreshold * RISK_METHOD.ceilingShare)
    return {
      ...base,
      score: null,
      value: null,
      note: "capital au plafond : les sorties le gardent sous le seuil",
    };
  const bridge = treasuryBridge(company.points, addDays(asOf, -RATING_METHOD.windowDays));
  if (!bridge || bridge.earned <= 0)
    return { ...base, score: null, value: null, note: "trésorerie non ventilable" };
  const kept = (bridge.end.capital - bridge.start.capital) / bridge.earned;
  return {
    ...base,
    score: round2(interpolate(RATING_METHOD.profitability, kept)),
    value: `${formatPercent(kept)} des recettes conservées`,
    note: null,
  };
}

const WAGES_WORDS: Record<WagesLevel, string> = {
  insufficient: "insuffisants pour vivre au quotidien",
  decent: "décents",
  coherent: "cohérents avec l'activité",
};

const PRESENCE_WORDS: Record<PresenceLevel, string> = {
  none: "absente",
  occasional: "ponctuelle",
  regular: "régulière",
};

function team(employees: number | null): CriterionDraft {
  const base = { id: "team", source: "report" } as const;
  if (employees === null) return { ...base, score: null, value: null, note: "effectif non relevé" };
  const table = RATING_METHOD.team;
  return {
    ...base,
    score: table[Math.min(Math.max(0, employees), table.length - 1)],
    value: `${employees} personne${employees > 1 ? "s" : ""}`,
    note: null,
  };
}

function integration(company: RatingCompany, inputs: RatingInputs): CriterionDraft {
  const ties = [
    company.consortium ? `consortium ${company.consortium.name}` : null,
    inputs.integration.guild ? "guilde" : null,
    inputs.integration.logistics ? "chaîne logistique" : null,
    inputs.integration.partnerships ? "partenariats" : null,
    inputs.integration.projects ? "projets collectifs" : null,
  ].filter((t): t is string => t !== null);
  const table = RATING_METHOD.integration;
  return {
    id: "integration",
    source: "agency",
    score: table[Math.min(ties.length, table.length - 1)],
    value: ties.length > 0 ? ties.join(", ") : "aucun engagement connu",
    note: null,
  };
}

function tenders(inputs: RatingInputs): CriterionDraft {
  const base = { id: "tenders", source: "agency" } as const;
  const t = inputs.tenders;
  if (!t || t.held <= 0)
    return { ...base, score: null, value: null, note: "aucun appel d'offres dans le secteur" };
  const joined = Math.min(Math.max(0, t.joined), t.held);
  const prices = {
    respected: "prix respectés",
    partly: "prix en partie respectés",
    ignored: "prix ignorés",
  };
  return {
    ...base,
    score: round2(clamp5((5 * joined) / t.held + RATING_METHOD.tenderPrices[t.prices])),
    value: `${joined} sur ${t.held} appel${t.held > 1 ? "s" : ""} d'offres${joined > 0 ? `, ${prices[t.prices]}` : ""}`,
    note: null,
  };
}

function legality(inputs: RatingInputs): CriterionDraft {
  const found = [
    inputs.legality.blacklist ? "liste noire" : null,
    inputs.legality.acivis ? "emploi d'acivis" : null,
    inputs.legality.wanted ? "emploi de criminels recherchés" : null,
  ].filter((t): t is string => t !== null);
  const table = RATING_METHOD.legality;
  return {
    id: "legality",
    source: "agency",
    score: table[Math.min(found.length, table.length - 1)],
    value: found.length > 0 ? found.join(", ") : "aucune irrégularité connue",
    note: null,
  };
}

/**
 * Scores a corporation under the current method, as of `asOf`. Criteria that do not apply are
 * left out and the weights of the others rescaled, never scored zero.
 */
export function assessRating(
  company: RatingCompany,
  inputs: RatingInputs,
  district: District | null,
  asOf: IsoDate,
): RatingAssessment {
  const parts: CriterionDraft[] = [
    growth(company, asOf),
    treasury(company, inputs),
    profitability(company, asOf),
    {
      id: "wages",
      source: "agency",
      score: inputs.wages ? RATING_METHOD.wages[inputs.wages] : null,
      value: inputs.wages ? WAGES_WORDS[inputs.wages] : null,
      note: inputs.wages ? null : "non évalués",
    },
    team(company.latest.employees),
    {
      id: "advertising",
      source: "agency",
      score: inputs.advertising
        ? clamp5(
            RATING_METHOD.advertising[inputs.advertising] -
              (inputs.spam ? RATING_METHOD.spamPenalty : 0),
          )
        : null,
      value: inputs.advertising
        ? `${PRESENCE_WORDS[inputs.advertising]}${inputs.spam ? ", spam" : ""}`
        : null,
      note: inputs.advertising ? null : "non évaluée",
    },
    integration(company, inputs),
    tenders(inputs),
    legality(inputs),
    {
      id: "location",
      source: "agency",
      score: district ? RATING_METHOD.location[district] : null,
      value: district ? DISTRICT_LABELS[district] : null,
      note: district ? null : "quartier non renseigné",
    },
    {
      id: "society",
      source: "agency",
      score: inputs.society ? RATING_METHOD.society[inputs.society] : null,
      value: inputs.society ? PRESENCE_WORDS[inputs.society] : null,
      note: inputs.society ? null : "non évaluée",
    },
  ];
  const criteria: CriterionScore[] = parts.map((p) => ({
    ...p,
    axis: RATING_METHOD.criteria[p.id].axis,
  }));

  const axisIds = Object.keys(RATING_METHOD.axes) as RatingAxis[];
  const axes = axisIds.map((id) => {
    const scored = criteria.filter((c) => c.axis === id && c.score !== null);
    const weight = scored.reduce((s, c) => s + RATING_METHOD.criteria[c.id].weight, 0);
    const score =
      weight > 0
        ? scored.reduce((s, c) => s + RATING_METHOD.criteria[c.id].weight * (c.score ?? 0), 0) /
          weight
        : null;
    return { id, score: score === null ? null : round2(score) };
  });
  const applying = axes.filter((a) => a.score !== null);
  const axisWeight = applying.reduce((s, a) => s + RATING_METHOD.axes[a.id], 0);
  const base =
    axisWeight > 0
      ? applying.reduce((s, a) => s + RATING_METHOD.axes[a.id] * (a.score ?? 0), 0) / axisWeight
      : null;
  const totalWeight = criteria.reduce(
    (s, c) => s + RATING_METHOD.axes[c.axis] * RATING_METHOD.criteria[c.id].weight,
    0,
  );
  const coverage =
    criteria
      .filter((c) => c.score !== null)
      .reduce((s, c) => s + RATING_METHOD.axes[c.axis] * RATING_METHOD.criteria[c.id].weight, 0) /
    totalWeight;

  const modulation = RATING_METHOD.transparency[inputs.transparency];
  const irregular = Object.values(inputs.legality).some(Boolean);
  let score = base === null ? null : clamp5(base + modulation);
  let capped: RatingAssessment["capped"] = null;
  if (score !== null && irregular && score > RATING_METHOD.legalityCap) {
    score = RATING_METHOD.legalityCap;
    capped = "legality";
  } else if (
    score !== null &&
    coverage < RATING_METHOD.fullCoverage &&
    score > RATING_METHOD.partialCap
  ) {
    score = RATING_METHOD.partialCap;
    capped = "coverage";
  }
  if (score !== null) score = round2(score);

  // Confidence: how well the data back the score, not how good the score is.
  const reasons: string[] = [];
  let balance = 0;
  if (coverage < RATING_METHOD.thinCoverage) {
    balance -= 1;
    reasons.push(`${Math.round(coverage * 100)} % de la grille évaluée`);
  }
  const reliability = company.creation ? creationReliability(company.creation) : null;
  if (!reliability || reliability.tone === "low") {
    balance -= 1;
    reasons.push("date de création incertaine");
  }
  const firstCapital = company.points.find((p) => p.capital !== null);
  if (!firstCapital || daysBetween(firstCapital.date, asOf) < RATING_METHOD.windowDays) {
    balance -= 1;
    reasons.push("capital relevé depuis moins de cinq ans");
  }
  if (modulation > 0) {
    balance += 1;
    reasons.push("données transmises et cohérentes");
  } else if (modulation < 0) {
    balance -= 1;
    reasons.push("incohérences dans les données transmises");
  }
  const confidence: RatingConfidence =
    balance >= 1 && coverage >= RATING_METHOD.fullCoverage
      ? "high"
      : balance <= -1
        ? "low"
        : "standard";

  const regime = regimeOf(company.scores);
  return {
    criteria,
    axes,
    base: base === null ? null : round2(base),
    transparency: modulation,
    score,
    category: score === null ? null : categoryOf(score),
    capped,
    coverage: round2(coverage),
    confidence,
    confidenceReasons: reasons,
    outlook: regime === "essor" ? "positive" : regime === "declin" ? "negative" : "stable",
  };
}

/** How a rating moved against the one before it; `up` null when the category held. */
export function ratingMove(
  rating: Pick<CompanyRating, "category">,
  previous: Pick<CompanyRating, "category" | "confidence"> | null,
): { text: string; up: boolean | null } {
  if (!previous) return { text: "première notation", up: null };
  const from = ratingCode(previous.category, previous.confidence);
  const delta = categoryRank(previous.category) - categoryRank(rating.category);
  if (delta > 0) return { text: `relevée depuis ${from}`, up: true };
  if (delta < 0) return { text: `abaissée depuis ${from}`, up: false };
  return { text: `confirmée (${from} auparavant)`, up: null };
}

/** `α+`, `Γ−`, `ß`. */
export function ratingCode(category: RatingCategory, confidence: RatingConfidence): string {
  return `${CATEGORY_INFO[category].symbol}${CONFIDENCE_INFO[confidence].sign}`;
}
