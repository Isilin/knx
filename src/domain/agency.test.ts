import { describe, expect, it } from "vite-plus/test";
import { ratingDistribution, recentRatings } from "./agency.ts";
import { addDays, daysBetween } from "./dates.ts";
import { buildMarket } from "./market.ts";
import {
  assessRating,
  EMPTY_INPUTS,
  RATING_METHOD,
  type CompanyRating,
  type RatingCategory,
} from "./rating.ts";
import { datasetByName } from "./testing.ts";
import type { CompanyEvent, Dataset, IsoDate, MarketEvent, ReportRow } from "./types.ts";

const CREATED: IsoDate = "2026-01-01";
const LATEST: IsoDate = "2026-11-13";

function reports(capital: (date: IsoDate) => number) {
  const dates: IsoDate[] = [];
  for (let d = LATEST; d >= "2026-05-01"; d = addDays(d, -5)) dates.unshift(d);
  return dates.map((date) => {
    const row = (name: string, cap: number): ReportRow => ({
      name,
      rank: null,
      chiffre: 1_000,
      capital: cap,
      employees: 5,
    });
    return {
      date,
      source: "paste" as const,
      rows: [row("Coffre", capital(date)), row("Voisine", 400_000)],
    };
  });
}

function dataset(capital: (date: IsoDate) => number, extra: Partial<Dataset> = {}): Dataset {
  return {
    ...datasetByName({
      generatedAt: `${LATEST}T00:00:00Z`,
      companies: [
        { name: "Coffre", creationOverride: CREATED },
        { name: "Voisine", creationOverride: CREATED },
      ],
      snapshots: reports(capital),
    }),
    ...extra,
  };
}

const steady = () => 400_000;

/** A rating of « Coffre » on `date`, in the category KNX computes today unless told otherwise. */
function ratingOf(date: IsoDate, category?: RatingCategory, id = "r1"): CompanyRating {
  const company = buildMarket(dataset(steady)).bySlug.get("coffre")!;
  const a = assessRating(company, EMPTY_INPUTS, "cv", LATEST);
  return {
    id,
    companyId: "Coffre",
    date,
    method: RATING_METHOD.version,
    category: category ?? a.category!,
    confidence: a.confidence,
    outlook: "stable",
    score: a.score!,
    axes: a.axes,
    criteria: a.criteria,
    inputs: EMPTY_INPUTS,
    district: "cv",
    rationale: null,
  };
}

const watchOf = (
  capital: (date: IsoDate) => number,
  rating: CompanyRating,
  events: CompanyEvent[] = [],
  marketEvents: MarketEvent[] = [],
) => {
  const market = buildMarket(dataset(capital, { ratings: [rating], events, marketEvents }));
  return market.bySlug.get("coffre")!.watch!;
};

describe("rating watch", () => {
  it("stays quiet while nothing moved", () => {
    const watch = watchOf(steady, ratingOf(addDays(LATEST, -10)));
    expect(watch).toMatchObject({ watched: false, stale: false, reasons: [] });
    expect(watch.recomputed).not.toBeNull();
  });

  it("asks for a review once the rating is over a quarter old", () => {
    const watch = watchOf(steady, ratingOf("2026-07-01"));
    expect(watch.watched).toBe(false);
    expect(watch.stale).toBe(true);
    expect(watch.reasons.map((r) => r.kind)).toEqual(["stale"]);
  });

  it("flags a rating the current reports would change", () => {
    const watch = watchOf(steady, ratingOf(addDays(LATEST, -10), "omega"));
    expect(watch.watched).toBe(true);
    expect(watch.reasons[0]).toMatchObject({ kind: "drift", date: LATEST });
    expect(watch.reasons[0].text).toMatch(/moins bonne que la note publiée/);
  });

  it("flags a new chief executive, an outflow and a capital open to piracy", () => {
    const rated = addDays(LATEST, -30);
    const capital = (date: IsoDate) =>
      date < addDays(LATEST, -20) ? 400_000 : date < addDays(LATEST, -10) ? 100_000 : 31_000_000;
    const ceo: CompanyEvent = {
      id: "e1",
      companyId: "Coffre",
      date: addDays(LATEST, -5),
      kind: "ceo_change",
      details: { person: "Ada" },
      note: null,
      origin: "manual",
    };
    const watch = watchOf(capital, ratingOf(rated), [ceo]);
    const kinds = watch.reasons.map((r) => r.kind);
    expect(watch.watched).toBe(true);
    expect(kinds).toContain("ceo");
    expect(kinds).toContain("outflow");
    expect(kinds).toContain("piracy");
    expect(watch.reasons.find((r) => r.kind === "ceo")?.text).toBe("Changement de DG : Ada.");
  });

  it("ignores what happened before the rating", () => {
    const old: CompanyEvent = {
      id: "e0",
      companyId: "Coffre",
      date: "2026-06-01",
      kind: "ceo_change",
      details: {},
      note: null,
      origin: "manual",
    };
    const breach: MarketEvent = {
      id: "m1",
      date: addDays(LATEST, -3),
      label: "ZD",
      title: "Faille test",
      description: null,
      span: 1,
    };
    const watch = watchOf(steady, ratingOf(addDays(LATEST, -10)), [old], [breach]);
    expect(watch.reasons.map((r) => [r.kind, r.text])).toEqual([
      ["market", "Évènement de marché : Faille test."],
    ]);
  });
});

describe("rating overview", () => {
  const market = buildMarket(
    dataset(steady, {
      ratings: [
        ratingOf("2026-09-01", "gamma", "r1"),
        ratingOf(addDays(LATEST, -10), "beta", "r2"),
      ],
    }),
  );

  it("counts listed corporations by their latest category", () => {
    const d = ratingDistribution(market.companies);
    expect(d.rated).toBe(1);
    expect(d.unrated).toBe(1);
    expect(d.categories.find((c) => c.category === "beta")?.count).toBe(1);
    expect(d.categories.find((c) => c.category === "gamma")?.count).toBe(0);
  });

  it("lists the latest ratings with their move, newest first", () => {
    const moves = recentRatings(market);
    expect(moves.map((m) => [m.rating.id, m.move.text, m.move.up])).toEqual([
      ["r2", "relevée depuis Γ", true],
      ["r1", "première notation", null],
    ]);
    expect(daysBetween(moves[1].rating.date, moves[0].rating.date)).toBeGreaterThan(0);
  });
});
