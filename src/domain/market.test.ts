import { describe, expect, it } from "vite-plus/test";
import { buildMarket, inferGroups, slugify, smoothedRealDaily } from "./market.ts";
import type { Dataset } from "./types.ts";

const dataset: Dataset = {
  generatedAt: "2026-11-13T00:00:00Z",
  companies: [{ name: "Gamma", creationOverride: "2026-10-01" }],
  snapshots: [
    {
      date: "2026-11-10",
      source: "sheet",
      rows: [
        { name: "Alpha Corp", rank: null, chiffre: 1_000, capital: null, employees: null },
        { name: "Alpha Bank", rank: null, chiffre: 800, capital: null, employees: null },
        { name: "Gamma", rank: null, chiffre: 500, capital: null, employees: null },
        { name: "Delta", rank: null, chiffre: 10, capital: null, employees: null },
      ],
    },
    {
      date: "2026-11-12",
      source: "paste",
      rows: [
        { name: "Alpha Corp", rank: 2, chiffre: 990, capital: 5, employees: 1 },
        { name: "Alpha Bank", rank: 3, chiffre: 790, capital: 5, employees: 1 },
        { name: "Gamma", rank: 1, chiffre: 1_200, capital: 5, employees: 3 },
        { name: "Epsilon", rank: 4, chiffre: 0, capital: 3, employees: 0 },
      ],
    },
  ],
};

describe("buildMarket", () => {
  const market = buildMarket(dataset);

  it("summarises the latest report", () => {
    expect(market.facts).toMatchObject({
      date: "2026-11-12",
      previousDate: "2026-11-10",
      gap: 2,
      listed: 4,
      active: 3,
      idle: 1,
      newcomers: ["Epsilon"],
      delisted: ["Delta"],
    });
  });

  it("tracks ranks, statuses and published changes", () => {
    const gamma = market.bySlug.get("gamma")!;
    expect(gamma.latest.rank).toBe(1);
    expect(gamma.rankChange).toBe(2);
    expect(gamma.chiffreChange).toBeCloseTo(1.4);
    expect(market.bySlug.get("delta")?.status).toBe("delisted");
    expect(market.bySlug.get("epsilon")?.status).toBe("idle");
  });

  it("derives real revenue from the published averages and the creation date", () => {
    const gamma = market.bySlug.get("gamma")!;
    // Day 40 → 42: cumulative 500×40 = 20 000 → 1 200×42 = 50 400, i.e. 15 200 per day.
    expect(gamma.latest.days).toBe(42);
    expect(gamma.latest.realDaily).toBe(15_200);
    expect(gamma.latest.performance).toBeCloseTo(15_200 / 500 - 1);
  });

  it("infers groups from a shared brand word", () => {
    expect(market.bySlug.get("alpha-corp")?.group).toBe("Alpha");
    expect(market.bySlug.get("gamma")?.group).toBeNull();
  });
});

describe("helpers", () => {
  it("slugifies names with marks and symbols", () => {
    expect(slugify("Kessler Industries™")).toBe("kessler-industries");
    expect(slugify("La Trame Fukyû")).toBe("la-trame-fukyu");
    expect(slugify("L'Impact")).toBe("l-impact");
  });

  it("ignores articles when inferring groups", () => {
    const groups = inferGroups([
      "La Tech'",
      "La Trame Fukyû",
      "Sovereign Muse",
      "Sovereign Factory",
    ]);
    expect(groups.get("La Tech'")).toBeUndefined();
    expect(groups.get("Sovereign Muse")).toBe("Sovereign");
  });
});

describe("smoothedRealDaily", () => {
  it("averages real revenue over the trailing window", () => {
    const gamma = buildMarket({
      ...dataset,
      snapshots: [
        ...dataset.snapshots,
        {
          date: "2026-11-22",
          source: "paste",
          rows: [{ name: "Gamma", rank: 1, chiffre: 1_150, capital: 5, employees: 3 }],
        },
      ],
    }).bySlug.get("gamma")!;
    const trend = smoothedRealDaily(gamma.points);
    // 10 → 22 Nov: 500×40 = 20 000 → 1 150×52 = 59 800 over 12 days.
    expect(trend.at(-1)?.value).toBeCloseTo((59_800 - 20_000) / 12);
    expect(trend[0].value).toBeNull();
  });
});
