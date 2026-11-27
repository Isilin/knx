import { describe, expect, it } from "vite-plus/test";
import { datasetByName } from "./testing.ts";
import { buildMarket } from "./market.ts";
import { largestFlows, marketTreasury, treasuryBridge } from "./treasury.ts";
import { DEFAULT_VALUATION } from "./valuation.ts";

const dataset = datasetByName({
  generatedAt: "2026-11-13T00:00:00Z",
  companies: [{ name: "Kappa", creationOverride: "2026-10-01" }],
  snapshots: [
    {
      date: "2026-10-30",
      source: "sheet",
      rows: [{ name: "Kappa", rank: null, chiffre: 950, capital: null, employees: null }],
    },
    {
      date: "2026-11-01",
      source: "paste",
      rows: [
        { name: "Kappa", rank: 1, chiffre: 1_000, capital: 100_000, employees: 2 },
        { name: "Omega", rank: 2, chiffre: 500, capital: 10_000, employees: 1 },
        { name: "Zeta", rank: 3, chiffre: 0, capital: 5_000, employees: 0 },
      ],
    },
    {
      date: "2026-11-03",
      source: "paste",
      rows: [
        { name: "Kappa", rank: 1, chiffre: 1_100, capital: 90_000, employees: 3 },
        { name: "Omega", rank: 3, chiffre: 0, capital: 9_000, employees: 1 },
        { name: "Zeta", rank: 2, chiffre: 0, capital: 4_000, employees: 0 },
      ],
    },
    {
      date: "2026-11-05",
      source: "paste",
      rows: [
        { name: "Kappa", rank: 1, chiffre: 1_100, capital: 200_000, employees: 3 },
        { name: "Omega", rank: 2, chiffre: 300, capital: 9_500, employees: 2 },
        { name: "Zeta", rank: 3, chiffre: 0, capital: 4_000, employees: 0 },
      ],
    },
  ],
});

const market = buildMarket(dataset);
const kappa = market.bySlug.get("kappa")!;

// Kappa has no sector: its employees are paid the reference wage of the whole market.
const WAGE = DEFAULT_VALUATION.defaultWage;

describe("flows outside revenue", () => {
  it("splits each capital change into revenue, wages and the rest", () => {
    const [, , second, third] = kappa.points;
    // 11-01 → 11-03: cumulative 1 000×31 = 31 000 → 1 100×33 = 36 300, so 5 300 earned while
    // capital fell by 10 000; 1 then 2 paid employees (the DG is not paid) over two nights.
    expect(second.wages).toBe(1.5 * 2 * WAGE);
    expect(second.otherFlow).toBeCloseTo(-15_300 + 1.5 * 2 * WAGE);
    expect(second.otherFlowNoise).toBeCloseTo(32);
    // 11-03 → 11-05: 36 300 → 38 500, so 2 200 earned while capital rose by 110 000.
    expect(third.wages).toBe(2 * 2 * WAGE);
    expect(third.otherFlow).toBeCloseTo(107_800 + 2 * 2 * WAGE);
  });

  it("needs a published capital on both reports", () => {
    expect(kappa.points[1].otherFlow).toBeNull();
  });

  it("leaves the wages in the flow when a headcount is unknown", () => {
    expect(kappa.points[1].wages).toBeNull();
  });

  it("counts every capital change of a company at 0 as a flow outside revenue", () => {
    const zeta = market.bySlug.get("zeta")!;
    expect(zeta.points[1].wages).toBe(0);
    expect(zeta.points[1].otherFlow).toBe(-1_000);
    expect(zeta.points[1].otherFlowNoise).toBe(0);
  });

  it("pays the wage the Agence audited rather than the reference", () => {
    const audited = buildMarket({
      ...dataset,
      wageFigures: [
        {
          id: "1",
          companyId: "Kappa",
          date: "2026-11-04",
          wage: 1_000,
          source: "audited",
          note: null,
        },
      ],
    }).bySlug.get("kappa")!;
    // The first figure covers the days before it too.
    expect(audited.points[2].wages).toBe(1.5 * 2 * 1_000);
    expect(audited.points[3].wages).toBe(2 * 2 * 1_000);
    expect(audited.payroll).toEqual({
      paid: 2,
      rate: { wage: 1_000, origin: { kind: "figure", date: "2026-11-04", source: "audited" } },
      daily: 2_000,
    });
  });

  it("states the daily payroll on the latest report", () => {
    expect(kappa.payroll).toEqual({
      paid: 2,
      rate: { wage: WAGE, origin: { kind: "default" } },
      daily: 2 * WAGE,
    });
  });
});

describe("treasuryBridge", () => {
  it("bridges the capital over the whole history from the cumulative difference", () => {
    const wages = (1.5 * 2 + 2 * 2) * WAGE;
    expect(treasuryBridge(kappa.points, null)).toEqual({
      start: { date: "2026-11-01", capital: 100_000 },
      end: { date: "2026-11-05", capital: 200_000 },
      earned: 7_500,
      noise: 33,
      wages,
      otherFlow: 92_500 + wages,
    });
  });

  it("starts at the first report of the period", () => {
    const bridge = treasuryBridge(kappa.points, "2026-11-03");
    expect(bridge?.start).toEqual({ date: "2026-11-03", capital: 90_000 });
    expect(bridge?.earned).toBe(2_200);
    expect(bridge?.wages).toBe(2 * 2 * WAGE);
    expect(bridge?.otherFlow).toBe(107_800 + 2 * 2 * WAGE);
  });

  it("leaves the wages in the remainder when a headcount is unknown", () => {
    const blind = buildMarket(
      datasetByName({
        generatedAt: "2026-11-13T00:00:00Z",
        companies: [{ name: "Blind", creationOverride: "2026-10-01" }],
        snapshots: [
          {
            date: "2026-11-01",
            source: "paste",
            rows: [{ name: "Blind", rank: 1, chiffre: 1_000, capital: 100_000, employees: 4 }],
          },
          {
            date: "2026-11-03",
            source: "paste",
            rows: [{ name: "Blind", rank: 1, chiffre: 1_100, capital: 90_000, employees: null }],
          },
        ],
      }),
    ).bySlug.get("blind")!;
    const bridge = treasuryBridge(blind.points, null);
    expect(bridge?.wages).toBeNull();
    expect(bridge?.otherFlow).toBe(-15_300);
  });

  it("refuses to bridge across a reset or a company at 0", () => {
    expect(treasuryBridge(market.bySlug.get("omega")!.points, null)).toBeNull();
    expect(treasuryBridge(market.bySlug.get("zeta")!.points, null)).toBeNull();
  });
});

describe("largestFlows", () => {
  it("ranks flows by size with their share of the money available before them", () => {
    const flows = largestFlows(kappa.points, null);
    expect(flows.map((f) => f.date)).toEqual(["2026-11-05", "2026-11-03"]);
    // 90 000 of capital + 2 200 earned − the wages, then the rest came in.
    const lastWages = 2 * 2 * WAGE;
    expect(flows[0].share).toBeCloseTo((107_800 + lastWages) / (92_200 - lastWages));
    // 100 000 of capital + 5 300 earned − the wages, then the rest moved.
    const firstWages = 1.5 * 2 * WAGE;
    expect(flows[1].previousDate).toBe("2026-11-01");
    expect(flows[1].share).toBeCloseTo((-15_300 + firstWages) / (105_300 - firstWages));
  });

  it("never reports an outflow above the money available", () => {
    const company = buildMarket(
      datasetByName({
        generatedAt: "2026-11-13T00:00:00Z",
        companies: [{ name: "Drain", creationOverride: "2026-10-01" }],
        snapshots: [
          {
            date: "2026-11-01",
            source: "paste",
            rows: [{ name: "Drain", rank: 1, chiffre: 1_000, capital: 1_000, employees: 1 }],
          },
          {
            date: "2026-11-11",
            source: "paste",
            rows: [{ name: "Drain", rank: 1, chiffre: 1_500, capital: 0, employees: 1 }],
          },
        ],
      }),
    ).bySlug.get("drain")!;
    // 31 000 → 1 500×41 = 61 500: 30 500 earned, all of it gone with the 1 000 of capital.
    const [flow] = largestFlows(company.points, null);
    expect(flow.flow).toBeCloseTo(-31_500);
    expect(flow.share).toBeCloseTo(-1);
  });

  it("keeps only the period", () => {
    expect(largestFlows(kappa.points, "2026-11-04")).toHaveLength(1);
  });
});

describe("marketTreasury", () => {
  it("sums capital and headcount on the reports that publish them", () => {
    expect(marketTreasury(market)).toEqual([
      { date: "2026-11-01", capital: 115_000, employees: 3, companies: 3 },
      { date: "2026-11-03", capital: 103_000, employees: 4, companies: 3 },
      { date: "2026-11-05", capital: 213_500, employees: 5, companies: 3 },
    ]);
  });
});
