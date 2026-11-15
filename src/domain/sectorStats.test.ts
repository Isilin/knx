import { describe, expect, it } from "vite-plus/test";
import { toDayNumber } from "./dates.ts";
import { buildMarket } from "./market.ts";
import { groupedMarketMap } from "./regimes.ts";
import { concentrationOf, sectorConsortiumMatrix, sectorShareHistory } from "./sectorStats.ts";
import { datasetByName } from "./testing.ts";
import type { ReportRow } from "./types.ts";

const CREATION = "2026-01-01";
const dates = Array.from({ length: 14 }, (_, k) => {
  const d = new Date(Date.UTC(2026, 5, 1 + 10 * k));
  return d.toISOString().slice(0, 10);
});

/** Published chiffre of a corporation earning `rate(day)` credits each day since CREATION. */
function chiffreOn(date: string, rate: (day: number) => number): number {
  const days = toDayNumber(date) - toDayNumber(CREATION);
  let cumulative = 0;
  for (let d = 0; d < days; d++) cumulative += rate(d);
  return Math.round(cumulative / days);
}

const lastMonth = toDayNumber(dates.at(-1)!) - toDayNumber(CREATION) - 30;
const earners: Record<string, { rate: (day: number) => number; sector?: string }> = {
  Steady: { rate: () => 1_000, sector: "banque" },
  // Earns three times more over the last 30 days.
  Rising: { rate: (d) => (d >= lastMonth ? 1_500 : 500), sector: "banque" },
  Asleep: { rate: () => 0, sector: "banque" },
  Tech: { rate: () => 2_000, sector: "technopole" },
  Unfiled: { rate: () => 300 },
};

function dataset(unfiledRate?: number) {
  const named = Object.entries(earners).map(([name, e]) => ({
    name,
    rate: name === "Unfiled" && unfiledRate !== undefined ? () => unfiledRate : e.rate,
    sector: e.sector,
  }));
  return datasetByName({
    generatedAt: "2026-11-13T00:00:00Z",
    companies: named.map(({ name, sector }) => ({
      name,
      creationOverride: CREATION,
      sector: sector as never,
    })),
    snapshots: dates.map((date) => ({
      date,
      source: "paste",
      rows: named.map(({ name, rate }): ReportRow => ({
        name,
        rank: null,
        chiffre: chiffreOn(date, rate),
        capital: 1_000,
        employees: 1,
      })),
    })),
  });
}

const market = (unfiledRate?: number) => buildMarket(dataset(unfiledRate));

describe("summarizeSectors", () => {
  const m = market();
  const bank = m.sectors.get("banque")!;

  it("sums each sector and weighs it in the market", () => {
    expect(bank.listed).toBe(3);
    expect(bank.recentRate).toBeCloseTo(2_500, -1);
    const total = 1_000 + 1_500 + 2_000 + 300;
    expect(bank.weight).toBeCloseTo(2_500 / total, 2);
    expect(m.sectors.get("usine-production")).toMatchObject({ listed: 0, weight: 0 });
  });

  it("gives each corporation its share and rank in its sector", () => {
    const steady = m.bySlug.get("steady")!;
    const rising = m.bySlug.get("rising")!;
    const asleep = m.bySlug.get("asleep")!;
    expect(steady.scores.sectorWeight! + rising.scores.sectorWeight!).toBeCloseTo(1, 5);
    expect(rising.sectorRank).toEqual({ rank: 1, of: 3 });
    expect(steady.sectorRank).toEqual({ rank: 2, of: 3 });
    expect(asleep.status).toBe("idle");
    expect(m.bySlug.get("unfiled")!.scores.sectorWeight).toBeNull();
    expect(m.bySlug.get("tech")!.scores.sectorWeight).toBeCloseTo(1, 5);
  });

  it("reads dynamics against the median of the sector", () => {
    const steady = m.bySlug.get("steady")!;
    const rising = m.bySlug.get("rising")!;
    expect(bank.dynamics).toBeGreaterThan(0);
    expect(rising.scores.dynamicsVsSector).toBeGreaterThan(0);
    expect(steady.scores.dynamicsVsSector).toBeLessThan(0);
    expect(rising.scores.dynamicsVsSector).toBeCloseTo(rising.scores.dynamics! - bank.dynamics!);
    // Alone in its sector: the sector is itself.
    expect(m.bySlug.get("tech")!.scores.dynamicsVsSector).toBeCloseTo(0);
  });
});

describe("sectorShareHistory", () => {
  it("follows the share of the sector at each report", () => {
    const m = market();
    const steady = m.bySlug.get("steady")!;
    const history = sectorShareHistory(m, [steady]);
    expect(history).toHaveLength(dates.length);
    expect(history.at(-1)!.value).toBeCloseTo(1_000 / 2_500, 2);
    expect(history[0].value).toBeNull(); // no 30 days of history yet
  });

  it("leaves the share out where unfiled corporations weigh too much", () => {
    const m = market(5_000);
    const history = sectorShareHistory(m, [m.bySlug.get("steady")!]);
    expect(history.every((p) => p.value === null)).toBe(true);
    expect(sectorShareHistory(m, [m.bySlug.get("unfiled")!])).toEqual([]);
  });
});

describe("concentration and productivity", () => {
  const bank = market().sectors.get("banque")!;

  it("measures how the sector's revenue is shared out", () => {
    // Steady earns 1 000 a day, Rising 1 500: shares of 0,4 and 0,6.
    expect(bank.hhi).toBeCloseTo(0.4 ** 2 + 0.6 ** 2, 2);
    expect(bank.leader?.company.name).toBe("Rising");
    expect(bank.leader?.share).toBeCloseTo(0.6, 2);
    expect(concentrationOf(bank.hhi!).id).toBe("domine");
    expect(concentrationOf(0.2).id).toBe("modere");
    expect(concentrationOf(0.05).id).toBe("ouvert");
  });

  it("takes the median productivity of the active corporations", () => {
    // One employee and 1 000 ¢ of capital each; the idle one is left out.
    expect(bank.employees).toBe(3);
    expect(bank.capital).toBe(3_000);
    expect(bank.revenuePerEmployee).toBeCloseTo(1_250, -1);
    expect(bank.revenueToCapital).toBeCloseTo(37.5, 0);
  });
});

describe("sectorConsortiumMatrix", () => {
  const data = dataset();
  data.consortiums = [{ id: "k", name: "Maison", color: "cyan" }];
  data.memberships = [
    { id: "m", profileId: "Rising", consortiumId: "k", joinedOn: null, leftOn: null },
  ];
  const matrix = sectorConsortiumMatrix(buildMarket(data));

  it("puts each listed corporation under its sector and today's consortium", () => {
    expect(matrix.columns.map((c) => c.consortium?.name ?? "indépendantes")).toEqual([
      "Maison",
      "indépendantes",
    ]);
    const bank = matrix.rows.find((r) => r.sector.id === "banque")!;
    expect(bank.cells[0].map((c) => c.name)).toEqual(["Rising"]);
    expect(bank.cells[1].map((c) => c.name)).toEqual(["Steady", "Asleep"]);
    expect(matrix.rows.map((r) => r.sector.id)).toEqual(["banque", "technopole"]);
    expect(matrix.unfiled.map((c) => c.name)).toEqual(["Unfiled"]);
  });
});

describe("groupedMarketMap", () => {
  it("cuts the map into sector blocks, heaviest first, covering the whole market", () => {
    const { groups } = groupedMarketMap(market(), "sector");
    expect(groups.map((g) => g.id)).toEqual(["banque", "technopole", "non-classees"]);
    expect(groups.reduce((sum, g) => sum + g.weight, 0)).toBeCloseTo(1, 5);
    expect(groups[2].label).toBe("Non classées");
  });

  it("folds the smallest corporations of a block into its own remainder", () => {
    const { groups } = groupedMarketMap(market(), "consortium", 0.35);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Indépendantes");
    const others = groups[0].tiles.find((t) => t.kind === "others");
    expect(others?.kind === "others" && others.companies.map((c) => c.name).sort()).toEqual([
      "Rising",
      "Steady",
      "Unfiled",
    ]);
  });
});
