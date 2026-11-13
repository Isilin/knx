import { describe, expect, it } from "vite-plus/test";
import { activityDays, estimateCreation, lastLife } from "./age.ts";
import { addDays } from "./dates.ts";

/** Simulates the game: cumulative revenue ÷ days of activity, rounded to the credit. */
function simulate(creation: string, dailyRevenue: (day: number) => number, reportDays: number[]) {
  return reportDays.map((day) => {
    let cumulative = 0;
    for (let d = 1; d <= day; d++) cumulative += dailyRevenue(d);
    return { date: addDays(creation, day), chiffre: Math.round(cumulative / day) };
  });
}

describe("estimateCreation", () => {
  it("recovers the creation date when the company has idle days", () => {
    const creation = "2019-04-02";
    // Day 2016 is idle (a multiple of 9): the average falls by about 1/2016 that day.
    const points = simulate(
      creation,
      (d) => (d % 9 === 0 ? 0 : 500_000 + (d % 7) * 1_000),
      [2010, 2014, 2015, 2016, 2017, 2020],
    );
    const estimate = estimateCreation(points);
    expect(estimate?.method).toBe("bounds");
    // Never older than the truth (revenue is never negative), and close to it.
    const error = activityDays(estimate!.creation, creation);
    expect(error).toBeGreaterThanOrEqual(-1);
    expect(error).toBeLessThan(30);
  });

  it("keeps the estimate inside the window allowed by the history", () => {
    const points = simulate("2024-12-30", (d) => (d < 4 ? 900_000 : 50_000), [3, 5, 9, 14]);
    const estimate = estimateCreation(points)!;
    expect(estimate.creation <= estimate.latestPossible).toBe(true);
    expect(estimate.creation >= "2007-01-01").toBe(true);
  });

  it("prefers a hand-typed creation date", () => {
    const estimate = estimateCreation([{ date: "2025-02-01", chiffre: 10 }], "2025-01-15");
    expect(estimate).toMatchObject({ creation: "2025-01-15", method: "manual" });
  });

  it("falls back to the first report when nothing constrains the age", () => {
    const estimate = estimateCreation([
      { date: "2026-11-11", chiffre: 60_919 },
      { date: "2026-11-13", chiffre: 75_082 },
    ]);
    expect(estimate).toMatchObject({ method: "first-seen", creation: "2026-11-10" });
  });

  it("has nothing to say about a company that never earned anything", () => {
    expect(estimateCreation([{ date: "2026-11-13", chiffre: 0 }])).toBeNull();
  });
});

describe("lastLife", () => {
  it("restarts after a reset to zero", () => {
    const life = lastLife([
      { date: "2025-01-01", chiffre: 0 },
      { date: "2025-01-02", chiffre: 50 },
      { date: "2025-01-03", chiffre: 0 },
      { date: "2025-01-04", chiffre: 80 },
    ]);
    expect(life.map((p) => p.date)).toEqual(["2025-01-04"]);
  });
});
