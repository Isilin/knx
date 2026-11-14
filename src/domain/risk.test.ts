import { describe, expect, it } from "vite-plus/test";
import { addDays, daysBetween } from "./dates.ts";
import { buildMarket } from "./market.ts";
import { profileOf, riskAbove, riskBelow, RISK_METHOD, type RiskIndex } from "./risk.ts";
import { datasetByName } from "./testing.ts";
import type { IsoDate, ReportRow } from "./types.ts";

const CREATED: IsoDate = "2026-01-01";
const LATEST: IsoDate = "2026-11-13";

interface Profile {
  name: string;
  created?: IsoDate;
  /** Revenue earned on the n-th day of activity (1-based). */
  revenue: (day: number) => number;
  capital: (date: IsoDate) => number;
  employees: number;
}

/** Reports every five days up to `LATEST`, the published chiffre derived from the revenue. */
function reportsOf(profiles: Profile[], since: IsoDate = "2026-05-01") {
  const dates: IsoDate[] = [];
  for (let d = LATEST; d >= since; d = addDays(d, -5)) dates.unshift(d);
  return dates.map((date) => ({
    date,
    source: "paste" as const,
    rows: profiles.flatMap((p): ReportRow[] => {
      const days = daysBetween(p.created ?? CREATED, date);
      if (days <= 0) return [];
      let cumulative = 0;
      for (let n = 1; n <= days; n++) cumulative += p.revenue(n);
      return [
        {
          name: p.name,
          rank: null,
          chiffre: Math.round(cumulative / days),
          capital: p.capital(date),
          employees: p.employees,
        },
      ];
    }),
  }));
}

function marketOf(profiles: Profile[], since?: IsoDate) {
  return buildMarket(
    datasetByName({
      generatedAt: `${LATEST}T00:00:00Z`,
      companies: profiles.map((p) => ({ name: p.name, creationOverride: p.created ?? CREATED })),
      snapshots: reportsOf(profiles, since),
    }),
  );
}

const SEPTEMBER = daysBetween(CREATED, "2026-09-01");
/** Linear from `start` on `since` to `end` on `LATEST`. */
const slide = (start: number, end: number, since: IsoDate) => (date: IsoDate) =>
  start + ((end - start) * daysBetween(since, date)) / daysBetween(since, LATEST);

const market = marketOf([
  { name: "Steady", revenue: () => 1_000, capital: () => 500_000, employees: 5 },
  {
    name: "Collapse",
    revenue: (n) => (n < SEPTEMBER ? 5_000 : 300),
    capital: slide(2_000_000, 50_000, "2026-05-01"),
    employees: 1,
  },
  { name: "Ceiling", revenue: () => 100_000, capital: () => 29_000_000, employees: 4 },
  { name: "Exposed", revenue: () => 100_000, capital: () => 31_000_000, employees: 5 },
]);
const risk = (slug: string) => market.bySlug.get(slug)?.risk ?? null;
const index = (slug: string, id: RiskIndex["id"]) =>
  risk(slug)?.indices.find((i) => i.id === id) ?? null;

describe("risk levels", () => {
  it("count the cuts a value reaches or falls under", () => {
    const cuts = [0.15, 0.25, 0.4, 0.6, 0.9, 1.3];
    expect(riskAbove(0, cuts)).toBe(1);
    expect(riskAbove(0.15, cuts)).toBe(2);
    expect(riskAbove(5, cuts)).toBe(7);
    expect(riskBelow(1_000, [90, 60, 30, 15, 7, 3])).toBe(1);
    expect(riskBelow(89, [90, 60, 30, 15, 7, 3])).toBe(2);
    expect(riskBelow(0, [90, 60, 30, 15, 7, 3])).toBe(7);
  });

  const quiet = (id: RiskIndex["id"]): RiskIndex => ({ id, level: 1, value: 0, flag: null });

  it("raise the profile to within two levels of the worst critical index", () => {
    const indices = [
      quiet("volatility"),
      quiet("trend"),
      quiet("runway"),
      quiet("retention"),
      quiet("reserve"),
      quiet("team"),
      { id: "exposure", level: 7, value: 1.1, flag: "exposed" } satisfies RiskIndex,
    ];
    expect(profileOf(indices).profile).toBe(7 - RISK_METHOD.floorGap);
  });

  it("weigh other indices without a floor", () => {
    const indices = [
      { id: "volatility", level: 7, value: 2, flag: null } satisfies RiskIndex,
      quiet("trend"),
      quiet("runway"),
      quiet("retention"),
      quiet("reserve"),
      quiet("team"),
      quiet("exposure"),
    ];
    // 0.25 × 7 + 0.75 × 1 = 2.5.
    expect(profileOf(indices)).toEqual({ profile: 3, score: 2.5 });
  });

  it("need five measured indices", () => {
    const none = (id: RiskIndex["id"]): RiskIndex => ({ id, level: null, value: null, flag: null });
    const indices = [quiet("team"), quiet("exposure"), quiet("runway"), quiet("reserve")];
    expect(profileOf([...indices, none("trend")]).profile).toBeNull();
    expect(profileOf([...indices, quiet("trend")]).profile).toBe(1);
  });
});

describe("assessRisk", () => {
  it("reads a steady corporation as low risk", () => {
    expect(index("steady", "volatility")?.level).toBe(1);
    expect(index("steady", "runway")).toMatchObject({ level: 1, flag: "not-declining" });
    expect(index("steady", "team")?.level).toBe(1);
    expect(risk("steady")?.measured).toBe(7);
    expect(risk("steady")?.profile).toBeLessThanOrEqual(2);
  });

  it("flags capital lying idle", () => {
    // 500 000 ¢ for 1 000 ¢ a day: 500 days of revenue in reserve.
    expect(index("steady", "reserve")).toMatchObject({ level: 1, flag: "dormant" });
    expect(index("steady", "reserve")?.value).toBeCloseTo(500, 0);
  });

  it("reads a collapse as high risk", () => {
    expect(index("collapse", "volatility")?.level).toBeGreaterThanOrEqual(5);
    expect(index("collapse", "trend")?.level).toBeGreaterThanOrEqual(6);
    // 50 000 ¢ left, losing about 12 400 ¢ a day.
    expect(index("collapse", "runway")?.level).toBe(7);
    expect(index("collapse", "retention")?.level).toBe(7);
    expect(index("collapse", "team")?.level).toBe(6);
    expect(risk("collapse")?.profile).toBeGreaterThanOrEqual(5);
    expect(risk("collapse")?.regime).toBe("declin");
  });

  it("leaves retention out at the piracy ceiling", () => {
    expect(index("ceiling", "retention")).toMatchObject({ level: null, flag: "capped" });
    expect(index("ceiling", "exposure")?.level).toBe(3);
    expect(risk("ceiling")?.lastAboveThreshold).toBeNull();
  });

  it("marks a capital above the piracy threshold as exposed", () => {
    expect(index("exposed", "exposure")).toMatchObject({ level: 7, flag: "exposed" });
    expect(risk("exposed")?.lastAboveThreshold).toBe(LATEST);
    expect(risk("exposed")?.profile).toBeGreaterThanOrEqual(5);
  });

  it("measures what a young corporation allows", () => {
    const young = marketOf(
      [
        { name: "Old", revenue: () => 1_000, capital: () => 100_000, employees: 3 },
        {
          name: "Young",
          created: "2026-10-20",
          revenue: () => 2_000,
          capital: () => 50_000,
          employees: 3,
        },
      ],
      "2026-10-15",
    ).bySlug.get("young")?.risk;
    expect(young?.indices.find((i) => i.id === "volatility")?.level).toBeNull();
    expect(young?.indices.find((i) => i.id === "runway")?.level).toBeNull();
    expect(young?.indices.find((i) => i.id === "team")?.level).toBe(3);
  });

  it("does not grade corporations at rest or closed", () => {
    const rest = marketOf([
      { name: "Busy", revenue: () => 1_000, capital: () => 100_000, employees: 3 },
      { name: "Rest", revenue: () => 0, capital: () => 100_000, employees: 3 },
    ]);
    expect(rest.bySlug.get("rest")?.status).toBe("idle");
    expect(rest.bySlug.get("rest")?.risk).toBeNull();
  });
});
