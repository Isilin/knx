import { describe, expect, it } from "vite-plus/test";
import { addDays, daysBetween } from "./dates.ts";
import { buildMarket } from "./market.ts";
import { applyOp, normalizeDataset } from "./mutations.ts";
import {
  assessRating,
  categoryOf,
  EMPTY_INPUTS,
  interpolate,
  RATING_METHOD,
  ratingCode,
  ratingMove,
  type CompanyRating,
  type RatingInputs,
} from "./rating.ts";
import { datasetByName } from "./testing.ts";
import { buildTimeline } from "./timeline.ts";
import type { CompanyMeta, IsoDate, ReportRow } from "./types.ts";

const blankMeta = (id: string): CompanyMeta => ({
  id,
  name: id,
  formerNames: [],
  consortiumId: null,
  sector: null,
  creationOverride: null,
  closedOn: null,
  logoUrl: null,
  district: null,
});

const CREATED: IsoDate = "2026-01-01";
const LATEST: IsoDate = "2026-11-13";

interface Profile {
  name: string;
  revenue: (day: number) => number;
  capital: (date: IsoDate) => number;
  employees: number;
}

function marketOf(profiles: Profile[]) {
  const dates: IsoDate[] = [];
  for (let d = LATEST; d >= "2026-04-01"; d = addDays(d, -5)) dates.unshift(d);
  return buildMarket(
    datasetByName({
      generatedAt: `${LATEST}T00:00:00Z`,
      companies: profiles.map((p) => ({ name: p.name, creationOverride: CREATED })),
      snapshots: dates.map((date) => ({
        date,
        source: "paste" as const,
        rows: profiles.map((p): ReportRow => {
          const days = daysBetween(CREATED, date);
          let cumulative = 0;
          for (let n = 1; n <= days; n++) cumulative += p.revenue(n);
          return {
            name: p.name,
            rank: null,
            chiffre: Math.round(cumulative / days),
            capital: p.capital(date),
            employees: p.employees,
          };
        }),
      })),
    }),
  );
}

const market = marketOf([
  // Growing: revenue up by a third each imperial year; keeps a fifth of what it earns.
  {
    name: "Essor",
    revenue: (n) => 1_000 * 1.33 ** (n / 30),
    capital: (date) => 200_000 + 0.2 * 1_000 * daysBetween(CREATED, date) * 3,
    employees: 5,
  },
  // Steady revenue, a capital idle for years, a single-handed team.
  { name: "Dormante", revenue: () => 1_000, capital: () => 2_000_000, employees: 1 },
  // At the piracy ceiling.
  { name: "Plafond", revenue: () => 100_000, capital: () => 29_000_000, employees: 4 },
]);
const company = (slug: string) => market.bySlug.get(slug)!;
const criterion = (slug: string, id: string, inputs: RatingInputs = EMPTY_INPUTS) =>
  assessRating(company(slug), inputs, "cv", LATEST).criteria.find((c) => c.id === id)!;

const FULL: RatingInputs = {
  wages: "coherent",
  advertising: "regular",
  spam: false,
  integration: { guild: true, logistics: true, partnerships: false, projects: false },
  tenders: { held: 5, joined: 4, prices: "respected" },
  legality: { blacklist: false, acivis: false, wanted: false },
  society: "occasional",
  treasuryJustified: false,
  transparency: "complete",
};

describe("rating scales", () => {
  it("interpolate between the points of a curve, flat beyond", () => {
    expect(interpolate(RATING_METHOD.growth, -1)).toBe(0);
    expect(interpolate(RATING_METHOD.growth, 0)).toBe(3);
    expect(interpolate(RATING_METHOD.growth, 0.05)).toBeCloseTo(3.5);
    expect(interpolate(RATING_METHOD.growth, 2)).toBe(5);
  });

  it("map scores to categories on the published thresholds", () => {
    expect(categoryOf(4.5)).toBe("omega");
    expect(categoryOf(4.49)).toBe("alpha");
    expect(categoryOf(3.5)).toBe("beta");
    expect(categoryOf(3.0)).toBe("gamma");
    expect(categoryOf(2.5)).toBe("delta");
    expect(categoryOf(2.49)).toBe("epsilon");
    expect(ratingCode("alpha", "high")).toBe("α+");
    expect(ratingCode("beta", "standard")).toBe("ß");
    expect(ratingCode("gamma", "low")).toBe("Γ−");
  });
});

describe("criteria read by KNX", () => {
  it("score growth from the yearly trend of real revenue", () => {
    const growth = criterion("essor", "growth");
    expect(growth.score).toBeGreaterThan(4.5);
    expect(growth.value).toMatch(/par an$/);
    expect(criterion("dormante", "growth").score).toBeCloseTo(3, 0);
  });

  it("mark idle capital down, unless an investment plan backs it", () => {
    // 2 000 000 ¢ for 1 000 ¢ a day: 2 000 days of revenue.
    expect(criterion("dormante", "treasury").score).toBe(1);
    const justified = criterion("dormante", "treasury", {
      ...EMPTY_INPUTS,
      treasuryJustified: true,
    });
    expect(justified).toMatchObject({ score: 5, note: expect.stringMatching(/plan/) });
  });

  it("leave profitability out at the piracy ceiling", () => {
    expect(criterion("plafond", "profitability")).toMatchObject({ score: null });
    expect(criterion("essor", "profitability").score).toBeGreaterThan(3);
  });

  it("score the team against five people, DG included", () => {
    expect(criterion("essor", "team")).toMatchObject({ score: 5, value: "5 personnes" });
    expect(criterion("dormante", "team")).toMatchObject({ score: 0, value: "1 personne" });
    expect(criterion("plafond", "team").score).toBe(4);
  });
});

describe("criteria assessed by the Agence", () => {
  it("leave out what was not assessed, never scoring it zero", () => {
    const a = assessRating(company("essor"), EMPTY_INPUTS, null, LATEST);
    for (const id of ["wages", "advertising", "tenders", "location", "society"])
      expect(a.criteria.find((c) => c.id === id)?.score).toBeNull();
    expect(a.criteria.find((c) => c.id === "legality")).toMatchObject({
      score: 5,
      value: "aucune irrégularité connue",
    });
  });

  it("score tenders on those actually held, with the price advice", () => {
    const tenders = (t: RatingInputs["tenders"]) =>
      criterion("essor", "tenders", { ...EMPTY_INPUTS, tenders: t });
    expect(tenders({ held: 5, joined: 5, prices: "respected" }).score).toBe(5);
    expect(tenders({ held: 2, joined: 1, prices: "partly" }).score).toBe(1.5);
    expect(tenders({ held: 0, joined: 0, prices: "respected" }).score).toBeNull();
  });

  it("take the spam penalty off advertising", () => {
    expect(
      criterion("essor", "advertising", { ...EMPTY_INPUTS, advertising: "regular", spam: true })
        .score,
    ).toBe(3);
  });

  it("count the consortium as an engagement", () => {
    expect(criterion("essor", "integration")).toMatchObject({
      score: 2,
      value: "aucun engagement connu",
    });
    expect(criterion("essor", "integration", FULL).score).toBe(4);
  });
});

describe("assessRating", () => {
  it("combines the axes and adds the transparency modulation", () => {
    const a = assessRating(company("essor"), FULL, "cv", LATEST);
    expect(a.coverage).toBe(1);
    expect(a.transparency).toBe(0.25);
    expect(a.score).toBeCloseTo((a.base ?? 0) + 0.25, 1);
    expect(a.category).toMatch(/omega|alpha/);
    expect(a.capped).toBeNull();
  });

  it("holds Omega and Alpha back on an incomplete evaluation", () => {
    const a = assessRating(
      company("essor"),
      { ...EMPTY_INPUTS, transparency: "complete" },
      "cv",
      LATEST,
    );
    expect(a.coverage).toBeLessThan(RATING_METHOD.fullCoverage);
    expect(a.score).toBeLessThanOrEqual(RATING_METHOD.partialCap);
  });

  it("caps the score after a proven irregularity", () => {
    const a = assessRating(
      company("essor"),
      { ...FULL, legality: { blacklist: false, acivis: true, wanted: false } },
      "cv",
      LATEST,
    );
    expect(a.capped).toBe("legality");
    expect(a.score).toBe(RATING_METHOD.legalityCap);
    expect(a.category).toBe("delta");
  });

  it("reads confidence from the data, not from the score", () => {
    const full = assessRating(company("essor"), FULL, "cv", LATEST);
    expect(full.confidence).toBe("high");
    expect(full.confidenceReasons).toEqual(["données transmises et cohérentes"]);
    // Sending nothing optional does not lower confidence by itself.
    const silent = assessRating(company("essor"), EMPTY_INPUTS, null, LATEST);
    expect(silent.confidence).toBe("standard");
    const contradicted = assessRating(
      company("essor"),
      { ...FULL, transparency: "contradictory" },
      "cv",
      LATEST,
    );
    expect(contradicted.confidence).toBe("low");
  });
});

describe("published ratings", () => {
  const assessment = assessRating(company("essor"), FULL, "cv", LATEST);
  const rating = (id: string, date: IsoDate, category: CompanyRating["category"]) => ({
    id,
    companyId: company("essor").id,
    date,
    method: RATING_METHOD.version,
    category,
    confidence: "standard" as const,
    outlook: "stable" as const,
    score: 3.6,
    axes: assessment.axes,
    criteria: assessment.criteria,
    inputs: FULL,
    district: "cv" as const,
    rationale: null,
  });

  it("say how a rating moved against the one before", () => {
    expect(ratingMove(rating("1", LATEST, "beta"), null).text).toBe("première notation");
    expect(ratingMove(rating("2", LATEST, "alpha"), rating("1", "2026-10-01", "beta"))).toEqual({
      text: "relevée depuis ß",
      up: true,
    });
    expect(ratingMove(rating("2", LATEST, "gamma"), rating("1", "2026-10-01", "beta")).up).toBe(
      false,
    );
  });

  it("are stored once per corporation and date, then withdrawn", () => {
    const base = normalizeDataset({ generatedAt: LATEST, companies: [], snapshots: [] });
    const dataset = { ...base, companies: [{ ...blankMeta(company("essor").id), name: "Essor" }] };
    const once = applyOp(dataset, { type: "saveRating", rating: rating("r1", LATEST, "beta") });
    expect(once.ratings).toHaveLength(1);
    expect(() =>
      applyOp(once, { type: "saveRating", rating: rating("r2", LATEST, "alpha") }),
    ).toThrow("une notation existe déjà");
    expect(applyOp(once, { type: "deleteRating", id: "r1" }).ratings).toEqual([]);
  });

  it("appear in the corporation's history", () => {
    const entries = buildTimeline(
      company("essor"),
      [],
      [],
      [rating("r1", "2026-10-01", "beta"), rating("r2", LATEST, "alpha")],
    );
    expect(entries.filter((e) => e.origin === "agency").map((e) => [e.title, e.note])).toEqual([
      ["Notation α de l'Agence impériale", "Relevée depuis ß · 3,60/5 · perspective stable."],
      ["Notation ß de l'Agence impériale", "Première notation · 3,60/5 · perspective stable."],
    ]);
  });
});
