import { describe, expect, it } from "vite-plus/test";
import { applyOp, normalizeDataset, planWithdrawal } from "./mutations.ts";
import { testDataset, type TestCompany } from "./testing.ts";
import type { Dataset } from "./types.ts";

const meta = (id: string, name: string, extra: Partial<TestCompany> = {}): TestCompany => ({
  id,
  name,
  ...extra,
});

const figures = { rank: null, chiffre: 100, capital: 5_000, employees: 1 };

const base: Dataset = testDataset({
  generatedAt: "2026-11-13T00:00:00Z",
  companies: [meta("1", "Alpha"), meta("2", "Beta"), meta("3", "Gamma")],
  consortiums: [{ id: "k1", name: "Maison", color: "cyan" }],
  events: [],
  marketEvents: [],
  ratings: [],
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
});

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
      profileId: "n1",
    });
    expect(after.profiles.map((p) => p.id)).toEqual(["1", "2", "3", "n1"]);
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

  const refound = (dataset: Dataset, closures: string[]) =>
    applyOp(dataset, {
      type: "publish",
      newIds: ["n1"],
      request: {
        date: "2026-11-13",
        source: "paste",
        replace: false,
        closures,
        rows: [{ companyId: null, profileId: "3", name: "Gamma", ...figures }],
      },
    });

  it("opens a new life on an existing page", () => {
    const after = refound(base, ["3"]);
    expect(after.companies.find((c) => c.id === "n1")).toMatchObject({
      name: "Gamma",
      profileId: "3",
    });
    expect(after.companies.find((c) => c.id === "3")?.closedOn).toBe("2026-11-13");
    expect(after.profiles).toHaveLength(3);
  });

  it("refuses a second open life on a page", () => {
    expect(() =>
      applyOp(base, {
        type: "publish",
        newIds: ["n1"],
        request: {
          date: "2026-11-13",
          source: "paste",
          replace: false,
          closures: [],
          rows: [{ companyId: null, profileId: "1", name: "Alpha Bis", ...figures }],
        },
      }),
    ).toThrow("deux vies ouvertes");
  });

  it("withdraws a refounding: the new life goes, the page and its old life stay", () => {
    const withdrawn = applyOp(refound(base, ["3"]), { type: "withdraw", date: "2026-11-13" });
    expect(withdrawn.companies).toEqual(base.companies);
    expect(withdrawn.profiles).toEqual(base.profiles);
  });
});

describe("withdraw", () => {
  const published = publish(base);

  it("plans what the latest report's publication did", () => {
    expect(planWithdrawal(published, "2026-11-13")).toMatchObject({
      rows: 3,
      created: ["n1"],
      renamed: [
        expect.objectContaining({ companyId: "2", details: { from: "Beta", to: "Beta Prime" } }),
      ],
      reopened: ["3"],
    });
  });

  it("undoes rows, creations, renames and closures", () => {
    const withdrawn = applyOp(published, { type: "withdraw", date: "2026-11-13" });
    expect(withdrawn.snapshots).toEqual(base.snapshots);
    expect(withdrawn.companies).toEqual(base.companies);
    expect(withdrawn.profiles).toEqual(base.profiles);
    expect(withdrawn.events).toEqual([]);
    // The module can send that day again.
    expect(publish(withdrawn).snapshots).toHaveLength(2);
  });

  const documented = (dataset: Dataset) =>
    applyOp(dataset, {
      type: "saveEvent",
      event: {
        id: "e1",
        companyId: "n1",
        date: "2026-11-13",
        kind: "other",
        details: { title: "Fondation" },
        note: null,
        origin: "manual",
      },
    });

  it("keeps a corporation the operator documented", () => {
    const delta = applyOp(base, {
      type: "publish",
      newIds: ["n1"],
      request: {
        date: "2026-11-13",
        source: "userscript",
        replace: false,
        closures: [],
        rows: [{ companyId: null, name: "Delta", ...figures }],
      },
    });
    const withdrawn = applyOp(documented(delta), { type: "withdraw", date: "2026-11-13" });
    expect(withdrawn.companies.map((c) => c.id)).toEqual(["1", "2", "3", "n1"]);
    expect(withdrawn.events.map((e) => e.id)).toEqual(["e1"]);
  });

  it("refuses to reopen a corporation beside a kept namesake", () => {
    // Gamma was refounded that day and the new one documented: the old one cannot reopen.
    expect(() => applyOp(documented(published), { type: "withdraw", date: "2026-11-13" })).toThrow(
      "porteraient le nom « Gamma »",
    );
  });

  it("only withdraws the latest published report", () => {
    expect(() => applyOp(published, { type: "withdraw", date: "2026-11-12" })).toThrow(
      "seul le dernier relevé",
    );
    expect(() => applyOp(published, { type: "withdraw", date: "2026-11-01" })).toThrow(
      "aucun relevé publié",
    );
  });
});

describe("profile edits", () => {
  it("updates a page and detaches it when its consortium goes", () => {
    const edited = applyOp(base, {
      type: "updateProfile",
      id: "1",
      patch: { consortiumId: "k1", sector: "banque" },
    });
    expect(edited.profiles[0]).toMatchObject({ consortiumId: "k1", sector: "banque" });
    const removed = applyOp(edited, { type: "deleteConsortium", id: "k1" });
    expect(removed.profiles[0].consortiumId).toBeNull();
  });

  it("sends page fields of an older life edit to its page", () => {
    const edited = applyOp(base, {
      type: "updateCompany",
      id: "2",
      patch: { consortiumId: "k1", creationOverride: "2026-01-01" },
    });
    expect(edited.profiles[1].consortiumId).toBe("k1");
    expect(edited.companies[1].creationOverride).toBe("2026-01-01");
    const logo = applyOp(edited, { type: "setLogo", id: "2", url: "data:logo" });
    expect(logo.profiles[1].logoUrl).toBe("data:logo");
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

  it("gives a page to each life served without one, with its page fields", () => {
    const { profiles, companies } = normalizeDataset({
      companies: [
        { id: "1", name: "Alpha" },
        { id: "2", name: "MJ Immo", hidden: true },
      ],
      snapshots: [],
    });
    expect(companies.map((c) => c.profileId)).toEqual(["1", "2"]);
    expect(profiles.map((p) => p.hidden)).toEqual([false, true]);
  });

  it("keeps the pages it is given", () => {
    const { profiles, companies } = normalizeDataset({
      profiles: [{ id: "p", consortiumId: null, sector: "banque", logoUrl: null, hidden: false }],
      companies: [
        { id: "1", profileId: "p", name: "Paradox", closedOn: "2026-11-11" },
        { id: "2", profileId: "p", name: "Paradox" },
      ],
      snapshots: [],
    });
    expect(profiles).toEqual([
      {
        id: "p",
        consortiumId: null,
        sector: "banque",
        district: null,
        logoUrl: null,
        hidden: false,
      },
    ]);
    expect(companies.map((c) => c.profileId)).toEqual(["p", "p"]);
  });
});
