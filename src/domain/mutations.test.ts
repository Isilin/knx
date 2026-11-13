import { describe, expect, it } from "vite-plus/test";
import { applyOp, normalizeDataset } from "./mutations.ts";
import type { CompanyMeta, Dataset } from "./types.ts";

const meta = (id: string, name: string, extra: Partial<CompanyMeta> = {}): CompanyMeta => ({
  id,
  name,
  formerNames: [],
  consortiumId: null,
  sector: null,
  creationOverride: null,
  closedOn: null,
  logoUrl: null,
  ...extra,
});

const figures = { rank: null, chiffre: 100, capital: 5_000, employees: 1 };

const base: Dataset = {
  generatedAt: "2026-11-13T00:00:00Z",
  companies: [meta("1", "Alpha"), meta("2", "Beta"), meta("3", "Gamma")],
  consortiums: [{ id: "k1", name: "Maison", color: "cyan" }],
  events: [],
  snapshots: [
    {
      date: "2026-11-12",
      source: "paste",
      rows: [
        { companyId: "1", ...figures },
        { companyId: "2", ...figures },
        { companyId: "3", ...figures },
      ],
    },
  ],
};

const publish = (dataset: Dataset, replace = false) =>
  applyOp(dataset, {
    type: "publish",
    newIds: ["n1"],
    request: {
      date: "2026-11-13",
      source: "paste",
      replace,
      closures: ["3"],
      rows: [
        { companyId: "1", name: "Alpha", ...figures },
        { companyId: "2", name: "Beta Prime", ...figures },
        { companyId: null, name: "Gamma", ...figures },
      ],
    },
  });

describe("publish", () => {
  const after = publish(base);

  it("closes, renames and creates as decided", () => {
    expect(after.companies.find((c) => c.id === "3")?.closedOn).toBe("2026-11-13");
    expect(after.companies.find((c) => c.id === "2")).toMatchObject({
      name: "Beta Prime",
      formerNames: ["Beta"],
    });
    expect(after.companies.find((c) => c.id === "n1")).toMatchObject({
      name: "Gamma",
      closedOn: null,
    });
    expect(after.events).toEqual([
      expect.objectContaining({
        companyId: "2",
        kind: "renamed",
        details: { from: "Beta", to: "Beta Prime" },
        origin: "auto",
      }),
    ]);
    expect(after.snapshots.at(-1)?.rows.map((r) => r.companyId)).toEqual(["1", "2", "n1"]);
  });

  it("refuses a second report for the same day, and replaces on request", () => {
    expect(() => publish(after)).toThrow("un relevé existe déjà");
    const replaced = publish(after, true);
    expect(replaced.snapshots).toHaveLength(2);
    expect(replaced.companies.filter((c) => c.name === "Gamma")).toHaveLength(2);
  });

  it("refuses two open corporations with the same name", () => {
    expect(() =>
      applyOp(base, {
        type: "publish",
        newIds: ["n1"],
        request: {
          date: "2026-11-13",
          source: "paste",
          replace: false,
          closures: [],
          rows: [{ companyId: null, name: "Alpha", ...figures }],
        },
      }),
    ).toThrow("porte déjà le nom");
  });
});

describe("profile edits", () => {
  it("updates a corporation and detaches it when its consortium goes", () => {
    const edited = applyOp(base, {
      type: "updateCompany",
      id: "1",
      patch: { consortiumId: "k1", sector: "banque" },
    });
    expect(edited.companies[0]).toMatchObject({ consortiumId: "k1", sector: "banque" });
    const removed = applyOp(edited, { type: "deleteConsortium", id: "k1" });
    expect(removed.companies[0].consortiumId).toBeNull();
  });

  it("refuses duplicate consortium names", () => {
    expect(() =>
      applyOp(base, {
        type: "saveConsortium",
        consortium: { id: "k2", name: " Maison ", color: "bleu" },
      }),
    ).toThrow("s'appelle déjà");
  });
});

describe("normalizeDataset", () => {
  it("rejects data from the first schema", () => {
    expect(() =>
      normalizeDataset({
        companies: [{ name: "Alpha" }],
        snapshots: [{ date: "2026-11-12", rows: [{ name: "Alpha", chiffre: 1 }] }],
      }),
    ).toThrow("migration");
  });
});
