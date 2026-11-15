import { describe, expect, it } from "vite-plus/test";
import type { BalanceSheet } from "./balance.ts";
import { addDays, daysBetween } from "./dates.ts";
import { buildMarket, type CompanySeries } from "./market.ts";
import { EMPTY_INPUTS, type CompanyRating, type RatingCategory } from "./rating.ts";
import type { SecurityOperation } from "./securities.ts";
import { datasetByName } from "./testing.ts";
import type { Dataset, IsoDate, ReportRow } from "./types.ts";
import {
  DEFAULT_VALUATION,
  LifeValuation,
  priceHistory,
  ratingInForce,
  type ValuationSettings,
} from "./valuation.ts";

const CREATED: IsoDate = "2026-01-01";
const LATEST: IsoDate = "2026-11-13";

interface Profile {
  name: string;
  created?: IsoDate;
  /** Revenue earned on a date. */
  revenue: (date: IsoDate) => number;
  capital: (date: IsoDate) => number;
}

/** Daily reports from `since` to `LATEST`, the published chiffre derived from the revenue. */
function datasetOf(profiles: Profile[], since: IsoDate = "2026-08-01"): Dataset {
  const dates: IsoDate[] = [];
  for (let d = since; d <= LATEST; d = addDays(d, 1)) dates.push(d);
  return datasetByName({
    generatedAt: `${LATEST}T00:00:00Z`,
    companies: profiles.map((p) => ({ name: p.name, creationOverride: p.created ?? CREATED })),
    snapshots: dates.map((date) => ({
      date,
      source: "paste" as const,
      rows: profiles.flatMap((p): ReportRow[] => {
        const created = p.created ?? CREATED;
        const days = daysBetween(created, date);
        if (days <= 0) return [];
        let cumulative = 0;
        for (let d = addDays(created, 1); d <= date; d = addDays(d, 1)) cumulative += p.revenue(d);
        return [
          {
            name: p.name,
            rank: null,
            chiffre: Math.round(cumulative / days),
            capital: p.capital(date),
            employees: 3,
          },
        ];
      }),
    })),
  });
}

function rating(
  companyId: string,
  date: IsoDate,
  category: RatingCategory,
  confidence: CompanyRating["confidence"] = "standard",
): CompanyRating {
  return {
    id: `${companyId}-${date}`,
    companyId,
    date,
    method: "v1",
    category,
    confidence,
    outlook: "stable",
    score: 3.5,
    axes: [],
    criteria: [],
    inputs: EMPTY_INPUTS,
    district: null,
    rationale: null,
  };
}

const steady: Profile = { name: "Steady", revenue: () => 10_000, capital: () => 1_000_000 };
const company = (dataset: Dataset, name: string): CompanySeries => {
  const c = buildMarket(dataset).companies.find((x) => x.name === name);
  if (!c) throw new Error(name);
  return c;
};

describe("theoretical value", () => {
  it("adds the goodwill of the robust revenue and the discounted capital, unrated", () => {
    const c = company(datasetOf([steady]), "Steady");
    const v = c.valuation?.latest;
    expect(c.valuation?.status).toBe("valued");
    if (!v) throw new Error("no value");
    const age = daysBetween(CREATED, LATEST);
    const maturity = age / (age + DEFAULT_VALUATION.maturityHalf);
    expect(v.revenue).toBeCloseTo(10_000, -2);
    expect(v.maturity).toBeCloseTo(maturity, 6);
    expect(v.retainedCapital).toBe(1_000_000);
    const base = 30 * 10_000 * maturity + 0.5 * 1_000_000;
    expect(v.value / (base * DEFAULT_VALUATION.unratedMultiplier)).toBeCloseTo(1, 2);
    expect(v.rating).toBeNull();
    expect(v.low).toBeCloseTo(v.value * (1 - DEFAULT_VALUATION.unratedBand), 6);
    expect(v.high).toBeCloseTo(v.value * (1 + DEFAULT_VALUATION.unratedBand), 6);
  });

  it("caps a one-day sale to oneself at a few ordinary days", () => {
    const spikeDay = addDays(LATEST, -3);
    const pumped: Profile = {
      ...steady,
      name: "Pumped",
      revenue: (d) => (d === spikeDay ? 2_000_000 : 10_000),
    };
    const v = company(datasetOf([pumped]), "Pumped").valuation?.latest;
    if (!v) throw new Error("no value");
    // Raw: the spike lifts the 30-day mean by about 66 000 ¢ a day.
    expect(v.rawRevenue).toBeGreaterThan(70_000);
    // Capped at 4 ordinary days: one day at 40 000 instead of 10 000, so +1 000 ¢ a day.
    expect(v.revenue).toBeGreaterThan(10_500);
    expect(v.revenue).toBeLessThan(11_500);
  });

  it("lets a lasting rise through once it becomes the ordinary", () => {
    const rise = addDays(LATEST, -60);
    const grower: Profile = {
      ...steady,
      name: "Grower",
      revenue: (d) => (d >= rise ? 30_000 : 10_000),
    };
    const v = company(datasetOf([grower]), "Grower").valuation?.latest;
    expect(v?.revenue).toBeCloseTo(30_000, -2);
  });

  it("counts an injection only once it lasts, a withdrawal at once", () => {
    const injected: Profile = {
      ...steady,
      name: "Injected",
      capital: (d) => (d === LATEST ? 5_000_000 : 1_000_000),
    };
    const drained: Profile = {
      ...steady,
      name: "Drained",
      capital: (d) => (d === LATEST ? 200_000 : 1_000_000),
    };
    const dataset = datasetOf([injected, drained]);
    const up = company(dataset, "Injected").valuation?.latest;
    const down = company(dataset, "Drained").valuation?.latest;
    // Mean of 29 days at 1 M and one at 5 M.
    expect(up?.retainedCapital).toBeCloseTo((29 * 1_000_000 + 5_000_000) / 30, 0);
    expect(down?.retainedCapital).toBe(200_000);
  });

  it("values an older house higher at the same revenue", () => {
    const young: Profile = { ...steady, name: "Young", created: "2026-07-20" };
    const dataset = datasetOf([steady, young]);
    const a = company(dataset, "Steady").valuation?.latest;
    const b = company(dataset, "Young").valuation?.latest;
    expect(a && b && a.operating > b.operating).toBe(true);
  });

  it("waits for a week of known revenue before valuing", () => {
    const fresh: Profile = { ...steady, name: "Fresh", created: addDays(LATEST, -4) };
    const c = company(datasetOf([fresh]), "Fresh");
    expect(c.valuation?.status).toBe("observation");
    expect(c.valuation?.latest).toBeNull();
  });

  it("applies the multiplier and band of the rating in force", () => {
    const base = datasetOf([steady]);
    const rated = company(
      { ...base, ratings: [rating("Steady", "2026-10-01", "alpha", "high")] },
      "Steady",
    ).valuation?.latest;
    const unrated = company(base, "Steady").valuation?.latest;
    if (!rated || !unrated) throw new Error("no value");
    expect(rated.multiplier).toBe(1.1);
    expect(rated.band).toBe(0.1);
    expect(rated.value / unrated.value).toBeCloseTo(1.1 / 0.85, 6);
  });

  it("drops a rating once too old, and never reads one ahead of its date", () => {
    const ratings = [rating("Steady", "2026-03-01", "omega")];
    expect(ratingInForce(ratings, "2026-07-01", 150)?.category).toBe("omega");
    expect(ratingInForce(ratings, "2026-09-01", 150)).toBeNull();
    expect(ratingInForce(ratings, "2026-02-01", 150)).toBeNull();
  });

  it("follows the settings in force over the whole history", () => {
    const base = datasetOf([steady]);
    const settings: ValuationSettings = {
      id: "1",
      date: "2026-11-01",
      method: "v1",
      params: { ...DEFAULT_VALUATION, revenueDays: 60, capitalWeight: 0 },
      note: null,
    };
    const market = buildMarket({ ...base, valuationSettings: [settings] });
    const c = market.companies[0];
    expect(market.valuation.params.revenueDays).toBe(60);
    expect(c.valuation?.latest?.capital).toBe(0);
    // An early report is computed with the same settings.
    const early = new LifeValuation(c, [], market.valuation.params).on("2026-09-15");
    expect(early?.capital).toBe(0);
  });

  it("reports changes over a report, a week and a month", () => {
    const rising: Profile = {
      ...steady,
      name: "Rising",
      capital: (d) => 1_000_000 + 10_000 * daysBetween("2026-08-01", d),
    };
    const change = company(datasetOf([rising]), "Rising").valuation?.change;
    expect(change?.report).not.toBeNull();
    expect((change?.month ?? 0) > (change?.week ?? 0)).toBe(true);
  });
});

describe("share price", () => {
  const op = (o: Partial<SecurityOperation> & Pick<SecurityOperation, "kind" | "date">) => ({
    id: `${o.kind}-${o.date}`,
    companyId: "Steady",
    shares: null,
    ratio: null,
    note: null,
    ...o,
  });

  it("divides the value by the shares once introduced", () => {
    const base = datasetOf([steady]);
    const c = company(
      {
        ...base,
        securityOperations: [op({ kind: "introduction", date: "2026-10-01", shares: 5000 })],
      },
      "Steady",
    );
    const listing = c.valuation?.listing;
    expect(listing?.state).toBe("listed");
    expect(listing?.shares).toBe(5000);
    expect(listing?.price).toBeCloseTo((c.valuation?.latest?.value ?? 0) / 5000, 6);
    expect(company(base, "Steady").valuation?.listing).toBeNull();
  });

  it("adjusts the history to today's share count across a division", () => {
    const base = datasetOf([steady]);
    const operations = [
      op({ kind: "introduction", date: "2026-10-01", shares: 5000 }),
      op({ kind: "split", date: "2026-10-20", ratio: 2 }),
    ];
    const c = company({ ...base, securityOperations: operations }, "Steady");
    expect(c.valuation?.listing?.shares).toBe(10_000);
    const history = priceHistory(new LifeValuation(c, [], DEFAULT_VALUATION).history(), operations);
    expect(history[0].date).toBe("2026-10-01");
    const around = history.filter((p) => p.date === "2026-10-19" || p.date === "2026-10-20");
    // Steady value: no jump at the division.
    expect((around[1].value ?? 0) / (around[0].value ?? 1)).toBeCloseTo(1, 2);
  });

  it("holds the last price while suspended, and stops publishing it", () => {
    const base = datasetOf([steady]);
    const operations = [
      op({ kind: "introduction", date: "2026-10-01", shares: 5000 }),
      op({ kind: "suspension", date: "2026-11-10", note: "enquête de la DAI" }),
    ];
    const c = company({ ...base, securityOperations: operations }, "Steady");
    const listing = c.valuation?.listing;
    expect(listing?.state).toBe("suspended");
    expect(listing?.priceDate).toBe("2026-11-09");
    expect(listing?.note).toBe("enquête de la DAI");
    const history = priceHistory(new LifeValuation(c, [], DEFAULT_VALUATION).history(), operations);
    expect(history.find((p) => p.date === "2026-11-12")?.value).toBeNull();
  });
});

describe("balance sheets", () => {
  const sheet = (
    o: Partial<BalanceSheet> & Pick<BalanceSheet, "date" | "source">,
  ): BalanceSheet => ({
    id: `${o.date}-${o.source}`,
    companyId: "Steady",
    land: null,
    building: null,
    fittings: null,
    stock: null,
    note: null,
    ...o,
  });

  it("adds the premises at their weights, outside the multiplier and the band", () => {
    const base = datasetOf([steady]);
    const plain = company(base, "Steady").valuation?.latest;
    const owned = company(
      {
        ...base,
        balanceSheets: [
          sheet({
            date: "2026-11-01",
            source: "audited",
            land: 1_000_000,
            building: 2_000_000,
            fittings: 400_000,
          }),
        ],
      },
      "Steady",
    ).valuation?.latest;
    if (!plain || !owned) throw new Error("no value");
    // Audited: plot 100 %, building 80 %, fittings 50 %.
    expect(owned.premises).toBe(1_000_000 + 1_600_000 + 200_000);
    expect(owned.business).toBeCloseTo(plain.business, 6);
    expect(owned.value - plain.value).toBeCloseTo(2_800_000, 6);
    expect(owned.high - owned.low).toBeCloseTo(plain.high - plain.low, 6);
  });

  it("discounts a declared figure and fades a stock without a new one", () => {
    const base = datasetOf([steady]);
    const v = company(
      {
        ...base,
        balanceSheets: [sheet({ date: addDays(LATEST, -15), source: "declared", stock: 800_000 })],
      },
      "Steady",
    ).valuation?.latest;
    // 800 000 × 100 % × 50 % (declared) × 50 % (15 days of 30).
    expect(v?.stock).toBeCloseTo(200_000, 6);
    expect(v?.assets.stock?.fade).toBeCloseTo(0.5, 6);
    const gone = company(
      {
        ...base,
        balanceSheets: [sheet({ date: addDays(LATEST, -40), source: "audited", stock: 800_000 })],
      },
      "Steady",
    ).valuation?.latest;
    expect(gone?.stock).toBe(0);
  });

  it("keeps each item's latest figure, and never reads a sheet ahead of its date", () => {
    const base = datasetOf([steady]);
    const sheets = [
      sheet({ date: "2026-10-01", source: "audited", land: 500_000, stock: 100_000 }),
      sheet({ date: addDays(LATEST, -3), source: "audited", stock: 300_000 }),
      sheet({ date: "2026-12-01", source: "audited", land: 9_000_000 }),
    ];
    const v = company({ ...base, balanceSheets: sheets }, "Steady").valuation?.latest;
    expect(v?.assets.land?.amount).toBe(500_000);
    expect(v?.assets.land?.date).toBe("2026-10-01");
    expect(v?.assets.stock?.amount).toBe(300_000);
  });
});

describe("listed corporations", () => {
  it("weighs a declared figure at the listed weight once the shares are listed", () => {
    const base = datasetOf([steady]);
    const sheet: BalanceSheet = {
      id: "b",
      companyId: "Steady",
      date: "2026-10-01",
      land: 1_000_000,
      building: null,
      fittings: null,
      stock: null,
      source: "declared",
      note: null,
    };
    const unlisted = company({ ...base, balanceSheets: [sheet] }, "Steady").valuation?.latest;
    const listed = company(
      {
        ...base,
        balanceSheets: [sheet],
        securityOperations: [
          {
            id: "i",
            companyId: "Steady",
            date: "2026-10-15",
            kind: "introduction",
            shares: 1000,
            ratio: null,
            note: null,
          },
        ],
      },
      "Steady",
    ).valuation?.latest;
    expect(unlisted?.premises).toBe(500_000);
    // Default listed weight: a declared figure no longer counts.
    expect(listed?.premises).toBe(0);
    expect(listed?.assets.land?.trust).toBe(0);
  });
});
