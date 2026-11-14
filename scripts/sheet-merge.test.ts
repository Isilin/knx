import { describe, expect, it } from "vite-plus/test";
import {
  columnTrack,
  formerNamesOf,
  mergeTracks,
  removedColumns,
  typedCreations,
  withoutRenamedColumns,
  type SheetData,
} from "./sheet-merge.ts";

/** A sheet written as date → company → chiffre; columns in order of first appearance. */
function sheet(
  table: Record<string, Record<string, number>>,
  extra: {
    capital?: Record<string, Record<string, number>>;
    overrides?: Record<string, string>;
  } = {},
): SheetData {
  const toMaps = (t: Record<string, Record<string, number>>) =>
    new Map(Object.entries(t).map(([date, row]) => [date, new Map(Object.entries(row))]));
  const columns: string[] = [];
  for (const row of Object.values(table))
    for (const name of Object.keys(row)) if (!columns.includes(name)) columns.push(name);
  return {
    columns,
    chiffre: toMaps(table),
    capital: toMaps(extra.capital ?? {}),
    employees: new Map(),
    overrides: new Map(Object.entries(extra.overrides ?? {})),
  };
}

const dates = (track: { cells: Map<string, unknown> }) => [...track.cells.keys()];

describe("columnTrack", () => {
  it("leaves out leading zeros, keeps an idle tail of a living column", () => {
    const data = sheet({
      "2025-01-01": { Metro: 0 },
      "2025-01-02": { Metro: 10 },
      "2025-01-03": { Metro: 0 },
    });
    expect(dates(columnTrack(data, "Metro"))).toEqual(["2025-01-02", "2025-01-03"]);
  });

  it("drops the trailing zeros of a removed column", () => {
    const data = sheet({
      "2025-01-01": { Gone: 5 },
      "2025-01-02": { Gone: 6 },
      "2025-01-03": { Gone: 0 },
    });
    expect(dates(columnTrack(data, "Gone", "2025-01-04T10-00"))).toEqual([
      "2025-01-01",
      "2025-01-02",
    ]);
  });

  it("keeps a zero whose capital was recorded", () => {
    const data = sheet(
      { "2025-01-01": { Gone: 5 }, "2025-01-02": { Gone: 0 } },
      { capital: { "2025-01-02": { Gone: 3_340 } } },
    );
    expect(dates(columnTrack(data, "Gone", "v1"))).toEqual(["2025-01-01", "2025-01-02"]);
  });
});

describe("removedColumns", () => {
  const v1 = sheet({
    "2024-12-31": { Alpha: 99, Gone: 49, Phoenix: 29 },
    "2025-01-01": { Alpha: 100, Gone: 50, Phoenix: 30 },
    "2025-01-02": { Alpha: 101, Gone: 51, Phoenix: 31 },
  });
  // Gone's column deleted; Phoenix destroyed, its column deleted and re-created empty.
  const v2 = sheet({
    "2024-12-31": { Alpha: 99, Phoenix: 0 },
    "2025-01-01": { Alpha: 100, Phoenix: 0 },
    "2025-01-02": { Alpha: 101, Phoenix: 0 },
    "2025-01-03": { Alpha: 102, Phoenix: 0 },
  });
  const current = sheet({
    "2024-12-31": { Alpha: 99, Phoenix: 0 },
    "2025-01-01": { Alpha: 100, Phoenix: 0 },
    "2025-01-02": { Alpha: 101, Phoenix: 0 },
    "2025-01-03": { Alpha: 102, Phoenix: 0 },
    "2025-01-04": { Alpha: 103, Phoenix: 7 },
  });

  const removed = removedColumns(
    [
      { stamp: "2025-01-03T09-00", data: v2 },
      { stamp: "2025-01-02T20-00", data: v1 },
    ],
    current,
  );

  it("finds deleted and emptied columns, with their last state", () => {
    expect(removed.map((t) => [t.name, t.reason, t.source, t.removedIn])).toEqual([
      ["Gone", "removed", "2025-01-02T20-00", "2025-01-03T09-00"],
      ["Phoenix", "replaced", "2025-01-02T20-00", "2025-01-03T09-00"],
    ]);
    expect(removed[1].cells.get("2025-01-02")?.chiffre).toBe(31);
  });

  it("lays out both lives of a name with a gap between them", () => {
    const tracks = [...removed, ...current.columns.map((name) => columnTrack(current, name))];
    const { rows, collisions } = mergeTracks(tracks);
    expect(collisions).toEqual([]);
    const phoenix = [...rows]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, list]) => [date, list.find((r) => r.name === "Phoenix")?.chiffre ?? null]);
    expect(phoenix).toEqual([
      ["2024-12-31", 29],
      ["2025-01-01", 30],
      ["2025-01-02", 31],
      ["2025-01-03", null],
      ["2025-01-04", 7],
    ]);
    expect(rows.get("2025-01-01")?.find((r) => r.name === "Gone")?.archived).toBe(true);
    expect(rows.get("2025-01-04")?.find((r) => r.name === "Phoenix")?.archived).toBe(false);
  });

  it("takes a corrected figure for a correction, not a new column", () => {
    // A report typed in the wrong row, fixed in the next version.
    const typed = sheet({ "2025-01-01": { Seven: 0 }, "2025-01-02": { Seven: 5 } });
    const fixed = sheet({ "2025-01-01": { Seven: 0 }, "2025-01-02": { Seven: 0 } });
    expect(removedColumns([{ stamp: "v1", data: typed }], fixed)).toEqual([]);
  });
});

describe("mergeTracks", () => {
  it("prefers the current sheet and reports differing figures", () => {
    const current = sheet({ "2025-01-01": { Alpha: 100 } });
    const old = sheet({ "2025-01-01": { Alpha: 99 } });
    const { rows, collisions } = mergeTracks([
      columnTrack(old, "Alpha", "v1"),
      columnTrack(current, "Alpha"),
    ]);
    expect(rows.get("2025-01-01")?.map((r) => r.chiffre)).toEqual([100]);
    expect(collisions).toEqual([
      { name: "Alpha", date: "2025-01-01", kept: "current", dropped: "v1" },
    ]);
  });
});

describe("withoutRenamedColumns", () => {
  it("drops a removed column whose figures carry on under another name", () => {
    const before = sheet({
      "2025-01-01": { Kessler: 100 },
      "2025-01-02": { Kessler: 101 },
    });
    const after = sheet({
      "2025-01-01": { "Kessler™": 100 },
      "2025-01-02": { "Kessler™": 101 },
    });
    const removed = removedColumns([{ stamp: "v1", data: before }], after);
    const { tracks, renamed } = withoutRenamedColumns(removed, [columnTrack(after, "Kessler™")]);
    expect(tracks).toEqual([]);
    expect(renamed).toEqual([
      { from: "Kessler", to: "Kessler™", removedIn: "current", lastDate: "2025-01-02" },
    ]);
  });

  it("keeps the history of a corporation renamed, then destroyed, under its last name", () => {
    const first = sheet({
      "2025-01-01": { "Don'Expert": 100 },
      "2025-01-02": { "Don'Expert": 101 },
    });
    const renamed = sheet({
      "2025-01-01": { "Armacham Souvenir": 100 },
      "2025-01-02": { "Armacham Souvenir": 101 },
      "2025-01-03": { "Armacham Souvenir": 102 },
    });
    const gone = sheet({ "2025-01-04": { Alpha: 1 } });
    const removed = removedColumns(
      [
        { stamp: "v1", data: first },
        { stamp: "v2", data: renamed },
      ],
      gone,
    );
    const result = withoutRenamedColumns(removed, [columnTrack(gone, "Alpha")]);
    expect(result.tracks.map((t) => t.name)).toEqual(["Armacham Souvenir"]);
    expect([...formerNamesOf(result.renamed)]).toEqual([
      ["Armacham Souvenir", { names: ["Don'Expert"], lastDate: "2025-01-02" }],
    ]);
  });
});

describe("formerNamesOf", () => {
  it("follows renames to the last name, oldest first, once each", () => {
    const hop = (from: string, to: string, removedIn: string, lastDate: string) => ({
      from,
      to,
      removedIn,
      lastDate,
    });
    expect([
      ...formerNamesOf([
        hop("Kessler Distribution™", "NeuroCore Systems", "r011796", "2026-07-01"),
        hop("Hypercore", "Kessler Distribution™", "r009404", "2026-03-24"),
        hop("InMeaBulla", "Metropolis", "r004041", "2025-02-12"),
        hop("InMeaBulla", "Metropolis", "r012676", "2026-10-14"),
      ]),
    ]).toEqual([
      ["Metropolis", { names: ["InMeaBulla"], lastDate: "2025-02-12" }],
      [
        "NeuroCore Systems",
        { names: ["Hypercore", "Kessler Distribution™"], lastDate: "2026-03-24" },
      ],
    ]);
  });
});

describe("typedCreations", () => {
  it("keeps one creation per name and date", () => {
    const a = sheet({ "2025-01-01": { X: 1 } }, { overrides: { X: "2024-05-01" } });
    const b = sheet({ "2025-06-01": { X: 1 } }, { overrides: { X: "2025-05-01" } });
    expect(
      typedCreations([columnTrack(a, "X", "v1"), columnTrack(a, "X"), columnTrack(b, "X")]),
    ).toEqual([
      { name: "X", date: "2024-05-01" },
      { name: "X", date: "2025-05-01" },
    ]);
  });
});
