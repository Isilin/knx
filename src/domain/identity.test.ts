import { describe, expect, it } from "vite-plus/test";
import {
  isRefounding,
  proposeIdentities,
  resolveReport,
  suggestedDecisions,
  type IdentityInput,
} from "./identity.ts";
import type { CompanyMeta, ReportRow, Snapshot } from "./types.ts";

const company = (id: string, name: string, closedOn: string | null = null): CompanyMeta => ({
  id,
  name,
  formerNames: [],
  consortiumId: null,
  sector: null,
  creationOverride: null,
  closedOn,
  logoUrl: null,
});

const line = (
  name: string,
  chiffre: number,
  capital: number | null = 100_000,
  employees: number | null = 2,
): ReportRow => ({ name, rank: null, chiffre, capital, employees });

const companies = [
  company("1", "Kessler Industries"),
  company("2", "Paradox"),
  company("3", "Seven"),
  company("4", "Foo Corp"),
  company("5", "Metropolis", "2026-10-01"),
];

const previous: Snapshot = {
  date: "2026-11-11",
  source: "paste",
  rows: [
    { companyId: "1", rank: 1, chiffre: 194_000, capital: 2_000_000, employees: 5 },
    { companyId: "2", rank: 2, chiffre: 57_894, capital: 785_352, employees: 2 },
    { companyId: "3", rank: 3, chiffre: 4_700, capital: 50_000, employees: 1 },
    { companyId: "4", rank: 4, chiffre: 12_000, capital: 400_000, employees: 3 },
  ],
};

const input = (rows: ReportRow[], extra: Partial<IdentityInput> = {}): IdentityInput => ({
  companies,
  snapshots: [previous],
  date: "2026-11-13",
  rows,
  ...extra,
});

describe("isRefounding", () => {
  it("recognises a chiffre back to zero after activity", () => {
    expect(isRefounding(line("Paradox", 57_894, 785_352), line("Paradox", 0, 3_340, 0))).toBe(true);
  });

  it("recognises a collapse caught a few days late", () => {
    expect(isRefounding(line("X", 57_894, 785_352), line("X", 800, 3_500))).toBe(true);
  });

  it("leaves ordinary moves and idle companies alone", () => {
    expect(isRefounding(line("X", 57_894, 785_352), line("X", 57_700, 790_000))).toBe(false);
    expect(isRefounding(line("X", 0, 3_340), line("X", 0, 3_340))).toBe(false);
  });
});

describe("proposeIdentities", () => {
  it("matches by name, proposes renames, refoundings and closures", () => {
    const rows = [
      line("Kessler Industries™", 194_050, 2_010_000, 5),
      line("Paradox", 0, 3_340, 0),
      line("Bar Industries", 12_010, 401_000, 3),
      line("Metropolis", 0, 3_340, 0),
    ];
    const proposals = proposeIdentities(input(rows));
    expect([...proposals.matched]).toEqual([["Paradox", "2"]]);
    expect(proposals.newcomers).toEqual(["Kessler Industries™", "Bar Industries", "Metropolis"]);
    expect(proposals.missing.map((m) => m.name)).toEqual([
      "Kessler Industries",
      "Seven",
      "Foo Corp",
    ]);
    expect(proposals.renames).toEqual([
      {
        companyId: "1",
        from: "Kessler Industries",
        to: "Kessler Industries™",
        evidence: ["name", "chiffre", "capital", "employees"],
        suggested: true,
      },
      {
        companyId: "4",
        from: "Foo Corp",
        to: "Bar Industries",
        evidence: ["chiffre", "capital", "employees"],
        suggested: true,
      },
    ]);
    expect(proposals.refoundings.map((r) => r.companyId)).toEqual(["2"]);
    expect(proposals.namesakes).toEqual([
      { name: "Metropolis", companyId: "5", closedOn: "2026-10-01" },
    ]);

    const resolved = resolveReport(rows, proposals, suggestedDecisions(proposals));
    expect(resolved.rows.map((r) => [r.name, r.companyId])).toEqual([
      ["Kessler Industries™", "1"],
      ["Paradox", null],
      ["Bar Industries", "4"],
      ["Metropolis", null],
    ]);
    expect(resolved.closures).toEqual(["3", "2"]);
  });

  it("keeps a name-only match unchecked, and declines on request", () => {
    const rows = [line("Sevenn", 90, 3_000, 0)];
    const proposals = proposeIdentities(input(rows));
    expect(proposals.renames).toEqual([
      expect.objectContaining({ companyId: "3", to: "Sevenn", suggested: false }),
    ]);
    const resolved = resolveReport(rows, proposals, suggestedDecisions(proposals));
    expect(resolved.rows[0].companyId).toBeNull();
    expect(resolved.closures).toEqual(["1", "2", "3", "4"]);
  });

  it("only attaches rows when an older day is published late", () => {
    const later: Snapshot = { ...previous, date: "2026-11-20" };
    const rows = [line("Paradox", 0, 3_340, 0), line("Brand New", 10)];
    const proposals = proposeIdentities(input(rows, { snapshots: [previous, later] }));
    expect(proposals.latest).toBe(false);
    expect(proposals.refoundings).toEqual([]);
    expect(proposals.renames).toEqual([]);
    expect(resolveReport(rows, proposals, suggestedDecisions(proposals)).closures).toEqual([]);
  });

  it("undoes the replaced report before resolving", () => {
    // The report of the 13th closed Seven and created « Newco »; it is being replaced.
    const replaced: Snapshot = {
      date: "2026-11-13",
      source: "paste",
      rows: [{ companyId: "6", rank: 1, chiffre: 10, capital: 3_340, employees: 0 }],
    };
    const proposals = proposeIdentities({
      ...input([line("Seven", 4_710, 50_000, 1), line("Newco", 10)]),
      companies: [
        ...companies.map((c) => (c.id === "3" ? { ...c, closedOn: "2026-11-13" } : c)),
        company("6", "Newco"),
      ],
      snapshots: [previous, replaced],
    });
    expect([...proposals.matched]).toEqual([["Seven", "3"]]);
    expect(proposals.newcomers).toEqual(["Newco"]);
  });
});
