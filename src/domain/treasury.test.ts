import { describe, expect, it } from "vite-plus/test";
import { buildMarket } from "./market.ts";
import { largestFlows, marketTreasury, treasuryBridge } from "./treasury.ts";
import type { Dataset } from "./types.ts";

const dataset: Dataset = {
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
};

const market = buildMarket(dataset);
const kappa = market.bySlug.get("kappa")!;

describe("flows outside revenue", () => {
  it("splits each capital change into revenue and the rest", () => {
    const [, , second, third] = kappa.points;
    // 11-01 → 11-03: cumulative 1 000×31 = 31 000 → 1 100×33 = 36 300, so 5 300 earned while
    // capital fell by 10 000.
    expect(second.otherFlow).toBeCloseTo(-15_300);
    expect(second.otherFlowNoise).toBeCloseTo(32);
    // 11-03 → 11-05: 36 300 → 38 500, so 2 200 earned while capital rose by 110 000.
    expect(third.otherFlow).toBeCloseTo(107_800);
  });

  it("needs a published capital on both reports", () => {
    expect(kappa.points[1].otherFlow).toBeNull();
  });

  it("counts every capital change of a company at 0 as a flow outside revenue", () => {
    const zeta = market.bySlug.get("zeta")!;
    expect(zeta.points[1].otherFlow).toBe(-1_000);
    expect(zeta.points[1].otherFlowNoise).toBe(0);
  });
});

describe("treasuryBridge", () => {
  it("bridges the capital over the whole history from the cumulative difference", () => {
    expect(treasuryBridge(kappa.points, null)).toEqual({
      start: { date: "2026-11-01", capital: 100_000 },
      end: { date: "2026-11-05", capital: 200_000 },
      earned: 7_500,
      noise: 33,
      otherFlow: 92_500,
    });
  });

  it("starts at the first report of the period", () => {
    const bridge = treasuryBridge(kappa.points, "2026-11-03");
    expect(bridge?.start).toEqual({ date: "2026-11-03", capital: 90_000 });
    expect(bridge?.earned).toBe(2_200);
    expect(bridge?.otherFlow).toBe(107_800);
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
    // 90 000 of capital + 2 200 earned, then 107 800 came in.
    expect(flows[0].share).toBeCloseTo(107_800 / 92_200);
    // 100 000 of capital + 5 300 earned, then 15 300 left.
    expect(flows[1].previousDate).toBe("2026-11-01");
    expect(flows[1].share).toBeCloseTo(-15_300 / 105_300);
  });

  it("never reports an outflow above the money available", () => {
    const company = buildMarket({
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
    }).bySlug.get("drain")!;
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
