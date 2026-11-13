import { describe, expect, it } from "vite-plus/test";
import { assignRanks, diffReport, type DiffRow } from "./diff.ts";

const row = (
  name: string,
  chiffre: number,
  rank: number | null = null,
  capital: number | null = 100_000,
): DiffRow => ({
  key: name,
  name,
  rank,
  chiffre,
  capital,
  employees: 1,
});

describe("diffReport", () => {
  it("flags implausible jumps and rank disorder", () => {
    const diff = diffReport(
      [row("Alpha", 100_000, 1, 1_000_000), row("Beta", 50_000, 2)],
      [row("Alpha", 10_000, 1, 5_000_000), row("Beta", 50_100, 2)],
    );
    expect(diff.outliers.map((o) => `${o.name}:${o.field}`)).toEqual([
      "Alpha:chiffre",
      "Alpha:capital",
    ]);
    expect(diff.rankMismatches).toEqual(["Beta"]);
  });

  it("compares a renamed corporation with its former line", () => {
    const diff = diffReport(
      [{ ...row("Old Name", 100_000), key: "7" }],
      [{ ...row("New Name", 10_000), key: "7" }],
    );
    expect(diff.outliers.map((o) => o.name)).toEqual(["New Name"]);
  });
});

describe("diffReport with ages", () => {
  const context = { gap: 2, ageOn: () => 3_457 };

  it("flags an average that would require negative or absurd revenue", () => {
    const diff = diffReport(
      [row("Armacham Technology", 677_361), row("Revestio", 552_400), row("Seven", 4_700)],
      [row("Armacham Technology", 702_450), row("Revestio", 552_286), row("Seven", 4_400)],
      context,
    );
    expect(diff.outliers.map((o) => [o.name, o.reason])).toEqual([
      ["Armacham Technology", "impliquerait plus de 50 fois la recette moyenne par jour"],
      ["Seven", "impliquerait une recette négative : coquille probable"],
    ]);
  });

  it("accepts normal daily moves", () => {
    const diff = diffReport([row("Revestio", 552_400)], [row("Revestio", 552_286)], context);
    expect(diff.outliers).toEqual([]);
  });
});

describe("assignRanks", () => {
  it("orders by chiffre", () => {
    expect(assignRanks([row("B", 5), row("A", 9)]).map((r) => [r.name, r.rank])).toEqual([
      ["A", 1],
      ["B", 2],
    ]);
  });
});
