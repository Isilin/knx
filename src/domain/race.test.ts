import { describe, expect, it } from "vite-plus/test";
import { buildMarket } from "./market.ts";
import { revenueRace } from "./race.ts";
import { datasetByName } from "./testing.ts";
import type { ReportRow } from "./types.ts";

const row = (name: string, chiffre: number): ReportRow => ({
  name,
  rank: null,
  chiffre,
  capital: null,
  employees: null,
});

// Creation dates are set by hand, so cumulative revenue is chiffre × days since creation.
const market = buildMarket(
  datasetByName({
    generatedAt: "2026-10-21T00:00:00Z",
    companies: [
      { name: "Rentière", creationOverride: "2026-01-01" },
      { name: "Fusée", creationOverride: "2026-01-01" },
      { name: "Nouvelle", creationOverride: "2026-10-08" },
      { name: "Fermée", creationOverride: "2026-01-01", closedOn: "2026-10-21" },
    ],
    snapshots: [
      {
        date: "2026-10-01",
        source: "sheet",
        // Cumulative: 273 000, 27 300, 2 730 000.
        rows: [row("Rentière", 1_000), row("Fusée", 100), row("Fermée", 10_000)],
      },
      {
        date: "2026-10-11",
        source: "sheet",
        // Cumulative: 274 510, 56 600, 1 500, 2 830 000.
        rows: [
          row("Rentière", 970),
          row("Fusée", 200),
          row("Nouvelle", 500),
          row("Fermée", 10_000),
        ],
      },
      {
        date: "2026-10-21",
        source: "sheet",
        // Cumulative: 275 420, 87 900, 7 800.
        rows: [row("Rentière", 940), row("Fusée", 300), row("Nouvelle", 600)],
      },
    ],
  }),
);

const race = (start: string, limit?: number) =>
  revenueRace(market.companies, start, market.latestDate, limit);

describe("revenueRace", () => {
  it("ranks by revenue earned since the start, not by the published average", () => {
    expect(race("2026-10-06").map((e) => e.company.name)).toEqual([
      "Fusée",
      "Nouvelle",
      "Rentière",
    ]);
  });

  it("starts every line at zero, reading the starting line between two reports", () => {
    const [fusee, , rentiere] = race("2026-10-06");
    expect(fusee.points[0]).toEqual({ date: "2026-10-06", value: 0 });
    // Halfway between 27 300 and 56 600 on the starting line.
    expect(fusee.points.map((p) => p.date)).toEqual(["2026-10-06", "2026-10-11", "2026-10-21"]);
    expect(fusee.points[1].value).toBeCloseTo(56_600 - 41_950);
    expect(fusee.total).toBeCloseTo(87_900 - 41_950);
    expect(rentiere.total).toBeCloseTo(275_420 - 273_755);
  });

  it("starts on the report itself when the race opens on a report day", () => {
    const fusee = race("2026-10-11")[0];
    expect(fusee.points).toEqual([
      { date: "2026-10-11", value: 0 },
      { date: "2026-10-21", value: 31_300 },
    ]);
  });

  it("starts a corporation created during the race from zero on its creation date", () => {
    const nouvelle = race("2026-10-06").find((e) => e.company.name === "Nouvelle")!;
    expect(nouvelle.points).toEqual([
      { date: "2026-10-08", value: 0 },
      { date: "2026-10-11", value: 1_500 },
      { date: "2026-10-21", value: 7_800 },
    ]);
  });

  it("starts from the first report when the history begins after the start", () => {
    const rentiere = race("2026-09-01").find((e) => e.company.name === "Rentière")!;
    expect(rentiere.points[0]).toEqual({ date: "2026-10-01", value: 0 });
    expect(rentiere.total).toBe(275_420 - 273_000);
  });

  it("leaves out closed corporations and keeps the leaders only", () => {
    expect(race("2026-09-01").some((e) => e.company.name === "Fermée")).toBe(false);
    expect(race("2026-10-06", 2).map((e) => e.company.name)).toEqual(["Fusée", "Nouvelle"]);
  });
});
