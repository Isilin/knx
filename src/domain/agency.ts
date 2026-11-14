import { addDays, daysBetween } from "./dates.ts";
import { formatImperialDate } from "./imperial.ts";
import type { CompanySeries, Market } from "./market.ts";
import { formatPercent, formatScore2 } from "./numbers.ts";
import {
  assessRating,
  categoryRank,
  RATING_METHOD,
  ratingCode,
  ratingMove,
  type CompanyRating,
  type RatingCategory,
  type RatingConfidence,
} from "./rating.ts";
import { RISK_METHOD } from "./risk.ts";
import { largestFlows } from "./treasury.ts";
import type { CompanyEvent, IsoDate, MarketEvent } from "./types.ts";

/**
 * What KNX watches between two ratings of the Agence: whether the data the rating rests on have
 * moved enough, or something happened, for the Agence to look again.
 */

export type WatchKind = "drift" | "ceo" | "closed" | "outflow" | "piracy" | "market" | "stale";

export interface WatchReason {
  kind: WatchKind;
  date: IsoDate | null;
  text: string;
}

export interface RatingWatch {
  /** Something material changed since the rating: « sous surveillance ». */
  watched: boolean;
  /** Only the rating's age calls for a review: « à revoir ». */
  stale: boolean;
  reasons: WatchReason[];
  /**
   * The rating recomputed with today's reports, the Agence's assessments kept as frozen; null
   * when the method changed since.
   */
  recomputed: { category: RatingCategory; confidence: RatingConfidence; score: number } | null;
}

export const WATCH_RULES = {
  /** A quarter: three real months, three imperial years. */
  staleDays: 90,
  /** An outflow of a quarter of the money available or more. */
  outflowShare: -0.25,
} as const;

export function watchRating(
  company: CompanySeries,
  rating: CompanyRating,
  events: readonly CompanyEvent[],
  marketEvents: readonly MarketEvent[],
  asOf: IsoDate,
): RatingWatch {
  const reasons: WatchReason[] = [];
  const after = (date: IsoDate) => date > rating.date;

  let recomputed: RatingWatch["recomputed"] = null;
  if (rating.method === RATING_METHOD.version && company.status !== "delisted") {
    const now = assessRating(company, rating.inputs, rating.district, asOf);
    if (now.category && now.score !== null) {
      recomputed = { category: now.category, confidence: now.confidence, score: now.score };
      if (now.category !== rating.category)
        reasons.push({
          kind: "drift",
          date: asOf,
          text: `Recalculée sur le relevé du ${formatImperialDate(asOf)}, la note serait ${ratingCode(now.category, now.confidence)} (${formatScore2(now.score)}/5) : ${categoryRank(now.category) < categoryRank(rating.category) ? "meilleure" : "moins bonne"} que la note publiée.`,
        });
    }
  }

  for (const event of events) {
    if (!after(event.date)) continue;
    if (event.kind === "ceo_change")
      reasons.push({
        kind: "ceo",
        date: event.date,
        text: `Changement de DG${event.details.person ? ` : ${event.details.person}` : ""}.`,
      });
    if (event.kind === "closed")
      reasons.push({ kind: "closed", date: event.date, text: "Fermeture enregistrée." });
  }
  if (company.closedOn && after(company.closedOn) && !reasons.some((r) => r.kind === "closed"))
    reasons.push({ kind: "closed", date: company.closedOn, text: "Absente du rapport : fermée." });

  for (const flow of largestFlows(company.points, addDays(rating.date, 1), Infinity))
    if (flow.flow < 0 && (flow.share ?? 0) <= WATCH_RULES.outflowShare)
      reasons.push({
        kind: "outflow",
        date: flow.date,
        text: `Sortie hors CA de ${formatPercent(flow.share ?? 0)} du disponible.`,
      });

  const exposed = company.points.filter(
    (p) => after(p.date) && p.capital !== null && p.capital >= RISK_METHOD.piracyThreshold,
  );
  if (exposed.length > 0)
    reasons.push({
      kind: "piracy",
      date: exposed[exposed.length - 1].date,
      text: "Capital au-dessus du seuil de piratage de 30 M¢.",
    });

  for (const event of marketEvents)
    if (after(event.date))
      reasons.push({
        kind: "market",
        date: event.date,
        text: `Évènement de marché : ${event.title}.`,
      });

  const age = daysBetween(rating.date, asOf);
  if (age > WATCH_RULES.staleDays)
    reasons.push({
      kind: "stale",
      date: null,
      text: `Notation vieille de ${age} jours, plus d'un trimestre.`,
    });

  reasons.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const watched = reasons.some((r) => r.kind !== "stale");
  return { watched, stale: !watched && age > WATCH_RULES.staleDays, reasons, recomputed };
}

/** Listed corporations by the category of their latest rating, best first, then the unrated. */
export function ratingDistribution(companies: readonly CompanySeries[]): {
  categories: { category: RatingCategory; count: number }[];
  unrated: number;
  rated: number;
} {
  const listed = companies.filter((c) => c.status !== "delisted");
  const order = RATING_METHOD.categories.map(([c]) => c);
  const categories = order.map((category) => ({
    category,
    count: listed.filter((c) => c.rating?.category === category).length,
  }));
  const rated = categories.reduce((s, c) => s + c.count, 0);
  return { categories, unrated: listed.length - rated, rated };
}

export interface RatingMoveEntry {
  company: CompanySeries;
  rating: CompanyRating;
  move: { text: string; up: boolean | null };
}

/** The latest ratings published, newest first, with how each moved. */
export function recentRatings(market: Market, limit = 6): RatingMoveEntry[] {
  const entries: RatingMoveEntry[] = [];
  for (const [companyId, ratings] of market.ratings) {
    const company = market.byId.get(companyId);
    if (!company) continue;
    ratings.forEach((rating, index) =>
      entries.push({ company, rating, move: ratingMove(rating, ratings[index - 1] ?? null) }),
    );
  }
  return entries
    .sort(
      (a, b) =>
        b.rating.date.localeCompare(a.rating.date) || b.rating.id.localeCompare(a.rating.id),
    )
    .slice(0, limit);
}
