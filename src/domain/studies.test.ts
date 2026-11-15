import { describe, expect, it } from "vite-plus/test";
import { addDays, toDayNumber } from "./dates.ts";
import { buildMarket } from "./market.ts";
import {
  correlation,
  districtSectors,
  eventShock,
  revenueQuality,
  supplyChain,
} from "./studies.ts";
import { datasetByName } from "./testing.ts";
import type { MarketEvent, ReportRow } from "./types.ts";

const CREATION = "2026-01-01";
const START = "2026-03-01";
const dates = Array.from({ length: 64 }, (_, k) => addDays(START, 4 * k));

interface Earner {
  rate: (day: number) => number;
  capital: (date: string) => number;
  sector?: string;
  district?: string;
}

/** Published chiffre of a corporation earning `rate(day)` credits each day since CREATION. */
function chiffreOn(date: string, rate: (day: number) => number): number {
  const days = toDayNumber(date) - toDayNumber(CREATION);
  let cumulative = 0;
  for (let d = 0; d < days; d++) cumulative += rate(d);
  return Math.round(cumulative / days);
}

function market(earners: Record<string, Earner>) {
  return buildMarket(
    datasetByName({
      generatedAt: "2026-11-13T00:00:00Z",
      companies: Object.entries(earners).map(([name, e]) => ({
        name,
        creationOverride: CREATION,
        sector: e.sector as never,
        district: e.district as never,
      })),
      snapshots: dates.map((date) => ({
        date,
        source: "paste",
        rows: Object.entries(earners).map(([name, e]): ReportRow => ({
          name,
          rank: null,
          chiffre: chiffreOn(date, e.rate),
          capital: e.capital(date),
          employees: 2,
        })),
      })),
    }),
  );
}

/** A base rate with two bursts of activity, at irregular spacing, `shift` days later. */
const bursts = (base: number, height: number, shift: number) => (d: number) =>
  base +
  height * Math.exp(-(((d - 120 - shift) / 9) ** 2)) +
  height * 0.7 * Math.exp(-(((d - 215 - shift) / 12) ** 2));

describe("correlation", () => {
  it("is 1 for proportional series, −1 for opposed ones", () => {
    expect(correlation([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1);
    expect(correlation([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1);
    expect(correlation([1, 1, 1], [1, 2, 3])).toBeNull();
  });
});

describe("supplyChain", () => {
  // The shops follow the factories two weeks later.
  const m = market({
    Factory: {
      rate: bursts(2_000, 3_000, 0),
      capital: () => 1_000_000,
      sector: "usine-production",
    },
    Shop: { rate: bursts(600, 900, 14), capital: () => 1_000_000, sector: "boutique-armes" },
    Bar: { rate: () => 500, capital: () => 1_000_000, sector: "bar-restaurant" },
  });
  const chain = supplyChain(m);

  it("follows both ends of the chain week by week", () => {
    expect(chain.points.length).toBeGreaterThan(20);
    expect(chain.points.at(-1)?.date).toBe(dates.at(-1));
    expect(chain.correlations).toHaveLength(17);
  });

  it("finds the shops' delay behind the factories", () => {
    expect(chain.best?.lagWeeks).toBe(2);
    expect(chain.best?.r).toBeGreaterThan(0.9);
  });
});

describe("eventShock", () => {
  const event: MarketEvent = {
    id: "e",
    date: addDays(START, 100),
    label: "ZD",
    title: "Faille",
    description: null,
    span: 7,
  };
  const m = market({
    Vault: {
      rate: () => 1_000,
      capital: (date) => (date < event.date ? 35_000_000 : 29_000_000),
      sector: "banque",
    },
    Small: { rate: () => 500, capital: () => 2_000_000, sector: "banque" },
    Loose: { rate: () => 300, capital: () => 1_000_000 },
  });
  const shock = eventShock(m, event)!;

  it("frames the event with the reports around it", () => {
    expect(shock.before < event.date).toBe(true);
    expect(toDayNumber(shock.after)).toBeGreaterThanOrEqual(toDayNumber(event.date) + 7);
  });

  it("measures each sector's capital and its exposure on both sides", () => {
    const bank = shock.rows.find((r) => r.id === "banque")!;
    expect(bank).toMatchObject({
      companies: 2,
      capitalBefore: 37_000_000,
      capitalAfter: 31_000_000,
      exposedBefore: 1,
      exposedAfter: 0,
    });
    expect(bank.rateBefore).toBeCloseTo(1_500, -1);
    expect(shock.rows.find((r) => r.id === "non-classees")?.companies).toBe(1);
    expect(shock.coverage).toBeCloseTo(37 / 38, 3);
  });
});

describe("districtSectors", () => {
  it("counts each district's corporations, sector by sector", () => {
    const m = market({
      A: { rate: () => 1_000, capital: () => 1_000, sector: "banque", district: "cv" },
      B: { rate: () => 1_000, capital: () => 1_000, sector: "banque", district: "bv" },
      C: { rate: () => 2_000, capital: () => 1_000, sector: "technopole", district: "cv" },
    });
    const map = districtSectors(m);
    expect(map.columns.map((c) => [c.label, c.listed])).toEqual([
      ["Centre-Ville", 2],
      ["Basse-Ville", 1],
      ["Haute-Ville", 0],
    ]);
    expect(map.columns[0].weight).toBeCloseTo(0.75, 2);
    const bank = map.rows.find((r) => r.sector === "banque")!;
    expect(bank.cells.map((c) => c.listed)).toEqual([1, 1, 0]);
  });
});

describe("revenueQuality", () => {
  it("reads how much revenue stays in the capital, leaving the ceiling out", () => {
    const day0 = toDayNumber(START);
    const m = market({
      // Keeps everything it earns.
      Saver: {
        rate: () => 1_000,
        capital: (date) => 1_000_000 + 1_000 * (toDayNumber(date) - day0),
        sector: "banque",
      },
      // Earns but its capital never moves.
      Spender: { rate: () => 1_000, capital: () => 1_000_000, sector: "banque" },
      // Held under the piracy threshold.
      Ceiling: { rate: () => 1_000, capital: () => 29_000_000, sector: "technopole" },
    });
    const quality = revenueQuality(m);
    expect(quality.capped).toBe(1);
    expect(quality.measured).toBe(2);
    expect(quality.lowest.map((r) => r.company.name)).toEqual(["Spender", "Saver"]);
    expect(quality.lowest[0].retention).toBeCloseTo(0, 1);
    expect(quality.lowest[1].retention).toBeCloseTo(1, 1);
    expect(quality.sectors.find((s) => s.sector === "banque")?.retention).toBeCloseTo(0.5, 1);
  });
});
