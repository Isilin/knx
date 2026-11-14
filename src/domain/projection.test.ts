import { describe, expect, it } from "vite-plus/test";
import { datasetByName } from "./testing.ts";
import { buildMarket, type CompanySeries, type CompanyStatus } from "./market.ts";
import { chiffreAfter, projectMarket } from "./projection.ts";

function company(
  name: string,
  rank: number,
  chiffre: number,
  trajectory: { cumulative: number; days: number; rate: number } | null,
  status: CompanyStatus = "active",
): CompanySeries {
  return {
    name,
    slug: name.toLowerCase(),
    status,
    recentRate: trajectory?.rate ?? null,
    latest: {
      rank,
      chiffre,
      cumulative: trajectory?.cumulative ?? null,
      days: trajectory?.days ?? null,
    },
  } as CompanySeries;
}

// Old: 1 000 a day on average over 100 days, earning nothing now.
const old = company("Old", 1, 1_000, { cumulative: 100_000, days: 100, rate: 0 });
// Young: 500 a day over 10 days, now earning 2 000 a day.
const young = company("Young", 2, 500, { cumulative: 5_000, days: 10, rate: 2_000 });
// Unknown age: held at its chiffre.
const flat = company("Flat", 3, 300, null);
const idle = company("Idle", 4, 0, null, "idle");

const projection = projectMarket([old, young, flat, idle], "2026-11-13", 1);

describe("chiffreAfter", () => {
  it("averages the cumulative revenue and the revenue to come", () => {
    expect(chiffreAfter({ cumulative: 100_000, days: 100, rate: 0 }, 25)).toBe(800);
    expect(chiffreAfter({ cumulative: 5_000, days: 10, rate: 2_000 }, 5)).toBe(1_000);
  });
});

describe("projectMarket", () => {
  it("projects to the horizon, one imperial year being one real month", () => {
    expect(projection.horizon).toBe("2026-12-13");
    expect(projection.days).toBe(30);
  });

  it("describes where each chiffre heads and how fast", () => {
    const p = projection.bySlug.get("old")!;
    expect(p.equilibrium).toBe(0);
    expect(p.drift).toBe(-10);
    expect(p.chiffre).toBeCloseTo(100_000 / 130);
    expect(projection.bySlug.get("young")?.drift).toBe(150);
  });

  it("ranks the companies on the horizon", () => {
    expect(projection.bySlug.get("young")).toMatchObject({ rank: 1, rankChange: 1 });
    expect(projection.bySlug.get("old")).toMatchObject({ rank: 2, rankChange: -1 });
  });

  it("draws the expected path from the latest report to the horizon", () => {
    const { path } = projection.bySlug.get("old")!;
    expect(path[0]).toEqual({ date: "2026-11-13", value: 1_000 });
    expect(path.at(-1)?.date).toBe("2026-12-13");
    expect(path).toHaveLength(31);
  });

  it("finds the day one company moves ahead of another", () => {
    // Young: 7 000 / 11 → … → 15 000 / 15 = 1 000 on day 5, when Old reads 100 000 / 105.
    expect(projection.crossings).toHaveLength(1);
    expect(projection.crossings[0]).toMatchObject({
      passer: young,
      passed: old,
      inDays: 5,
      date: "2026-11-18",
    });
  });

  it("holds unknown trajectories flat and leaves idle companies out", () => {
    expect(projection.bySlug.has("flat")).toBe(false);
    expect(projection.bySlug.has("idle")).toBe(false);
  });
});

describe("buildMarket", () => {
  it("attaches the projection from the last 30 days' revenue rate", () => {
    const market = buildMarket(
      datasetByName({
        generatedAt: "2026-11-13T00:00:00Z",
        companies: [{ name: "Iota", creationOverride: "2026-10-01" }],
        snapshots: [
          {
            date: "2026-11-01",
            source: "paste",
            rows: [{ name: "Iota", rank: 1, chiffre: 1_000, capital: null, employees: null }],
          },
          {
            date: "2026-11-11",
            source: "paste",
            rows: [{ name: "Iota", rank: 1, chiffre: 1_100, capital: null, employees: null }],
          },
        ],
      }),
    );
    const iota = market.bySlug.get("iota")!;
    // 31 000 → 1 100×41 = 45 100 over 10 days.
    expect(iota.recentRate).toBe(1_410);
    expect(iota.projection?.equilibrium).toBe(1_410);
    expect(market.projection.horizon).toBe("2027-02-11");
  });
});
