import { describe, expect, it } from "vite-plus/test";
import { todayIn } from "./dates.ts";
import { averageChange, previousSnapshot, reviewReport } from "./review.ts";
import type { Snapshot, SnapshotRow } from "./types.ts";

const row = (name: string, chiffre: number): SnapshotRow => ({
  name,
  rank: null,
  chiffre,
  capital: null,
  employees: null,
});
const snapshot = (date: string, rows: SnapshotRow[]): Snapshot => ({ date, source: "paste", rows });

describe("previousSnapshot", () => {
  const snapshots = [
    snapshot("2026-11-10", []),
    snapshot("2026-11-12", []),
    snapshot("2026-11-13", []),
    snapshot("2026-11-11", []),
  ];

  it("takes the latest report strictly before the date", () => {
    expect(previousSnapshot(snapshots, "2026-11-13")?.date).toBe("2026-11-12");
    expect(previousSnapshot(snapshots, "2026-11-20")?.date).toBe("2026-11-13");
    expect(previousSnapshot(snapshots, "2026-11-10")).toBeNull();
  });
});

describe("averageChange", () => {
  it("averages relative moves over companies present in both reports", () => {
    expect(
      averageChange(
        [row("A", 100), row("B", 200), row("Gone", 50), row("Zero", 0)],
        [row("A", 110), row("B", 180), row("New", 70), row("Zero", 10)],
      ),
    ).toBeCloseTo(0);
    expect(averageChange([], [row("A", 1)])).toBe(0);
  });
});

describe("reviewReport", () => {
  const snapshots = [snapshot("2026-11-12", [row("Alpha", 1_000), row("Beta", 2_000)])];

  it("diffs against the previous report and feeds ages to the outlier check", () => {
    const review = reviewReport(
      snapshots,
      (name) => (name === "Alpha" ? "2026-11-02" : null),
      "2026-11-13",
      [row("Alpha", 1_000), row("Gamma", 5)],
    );
    expect(review.previous?.date).toBe("2026-11-12");
    expect(review.diff?.newcomers).toEqual(["Gamma"]);
    expect(review.diff?.missing).toEqual(["Beta"]);
    expect(review.averageChange).toBe(0);
  });

  it("flags a chiffre that would imply negative revenue for a known age", () => {
    const review = reviewReport(snapshots, () => "2026-11-02", "2026-11-13", [
      row("Alpha", 500),
      row("Beta", 2_000),
    ]);
    expect(review.diff?.outliers.map((o) => o.name)).toEqual(["Alpha"]);
  });

  it("has nothing to compare for the first report", () => {
    expect(reviewReport([], () => null, "2026-11-13", [row("A", 1)])).toEqual({
      previous: null,
      diff: null,
      averageChange: 0,
    });
  });
});

describe("todayIn", () => {
  it("follows the Paris calendar around midnight UTC", () => {
    expect(todayIn("Europe/Paris", new Date("2026-11-13T22:59:00Z"))).toBe("2026-11-13");
    expect(todayIn("Europe/Paris", new Date("2026-11-13T23:01:00Z"))).toBe("2026-11-14");
    expect(todayIn("Europe/Paris", new Date("2026-07-13T21:59:00Z"))).toBe("2026-07-13");
    expect(todayIn("Europe/Paris", new Date("2026-07-13T22:01:00Z"))).toBe("2026-07-14");
    expect(todayIn("UTC", new Date("2026-11-13T23:01:00Z"))).toBe("2026-11-13");
  });
});
