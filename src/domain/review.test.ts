import { describe, expect, it } from "vite-plus/test";
import { todayIn } from "./dates.ts";
import type { DiffRow } from "./diff.ts";
import { averageChange, previousSnapshot, renameKey, reviewReport } from "./review.ts";
import { datasetByName } from "./testing.ts";
import type { ReportRow, Snapshot } from "./types.ts";

const row = (name: string, chiffre: number, capital: number | null = null): ReportRow => ({
  name,
  rank: null,
  chiffre,
  capital,
  employees: null,
});
const diffRow = (key: string, chiffre: number): DiffRow => ({ ...row(key, chiffre), key });
const snapshot = (date: string): Snapshot => ({ date, source: "paste", rows: [] });

describe("previousSnapshot", () => {
  const snapshots = [
    snapshot("2026-11-10"),
    snapshot("2026-11-12"),
    snapshot("2026-11-13"),
    snapshot("2026-11-11"),
  ];

  it("takes the latest report strictly before the date", () => {
    expect(previousSnapshot(snapshots, "2026-11-13")?.date).toBe("2026-11-12");
    expect(previousSnapshot(snapshots, "2026-11-20")?.date).toBe("2026-11-13");
    expect(previousSnapshot(snapshots, "2026-11-10")).toBeNull();
  });
});

describe("averageChange", () => {
  it("averages relative moves over corporations present in both reports", () => {
    expect(
      averageChange(
        [diffRow("A", 100), diffRow("B", 200), diffRow("Gone", 50), diffRow("Zero", 0)],
        [diffRow("A", 110), diffRow("B", 180), diffRow("New", 70), diffRow("Zero", 10)],
      ),
    ).toBeCloseTo(0);
    expect(averageChange([], [diffRow("A", 1)])).toBe(0);
  });
});

describe("reviewReport", () => {
  const dataset = datasetByName({
    generatedAt: "2026-11-13T00:00:00Z",
    snapshots: [
      {
        date: "2026-11-12",
        source: "paste",
        rows: [row("Alpha", 1_000, 50_000), row("Beta", 2_000, 80_000)],
      },
    ],
  });

  it("settles identities, diffs against the previous report and feeds ages to the check", () => {
    const review = reviewReport(
      dataset,
      (id) => (id === "Alpha" ? "2026-11-02" : null),
      "2026-11-13",
      [row("Alpha", 1_000), row("Gamma", 5)],
    );
    expect(review.previous?.date).toBe("2026-11-12");
    expect(review.created).toEqual(["Gamma"]);
    expect(review.closed).toEqual(["Beta"]);
    expect(review.resolved.closures).toEqual(["Beta"]);
    expect(review.averageChange).toBe(0);
  });

  it("follows a rename, and the operator can decline it", () => {
    const rows = [row("Alpha", 1_000, 50_000), row("Beta Prime", 2_010, 80_500)];
    const review = reviewReport(dataset, () => null, "2026-11-13", rows);
    expect(review.proposals.renames.map((r) => [r.from, r.to, r.suggested])).toEqual([
      ["Beta", "Beta Prime", true],
    ]);
    expect(review.resolved.rows.map((r) => r.companyId)).toEqual(["Alpha", "Beta"]);
    expect(review.closed).toEqual([]);

    const declined = reviewReport(dataset, () => null, "2026-11-13", rows, {
      [renameKey(review.proposals.renames[0])]: false,
    });
    expect(declined.created).toEqual(["Beta Prime"]);
    expect(declined.closed).toEqual(["Beta"]);
  });

  it("flags a chiffre that would imply negative revenue for a known age", () => {
    const review = reviewReport(dataset, () => "2026-11-02", "2026-11-13", [
      row("Alpha", 500, 50_000),
      row("Beta", 2_000, 80_000),
    ]);
    expect(review.diff?.outliers.map((o) => o.name)).toEqual(["Alpha"]);
  });

  it("has nothing to compare for the first report", () => {
    const review = reviewReport(
      { companies: [], snapshots: [], events: [] },
      () => null,
      "2026-11-13",
      [row("A", 1)],
    );
    expect(review).toMatchObject({ previous: null, diff: null, averageChange: 0, created: ["A"] });
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
