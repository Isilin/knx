import { describe, expect, it } from "vite-plus/test";
import { applyOp, normalizeDataset, planWage, type WageFigureDraft } from "./mutations.ts";
import { testDataset } from "./testing.ts";
import { formatInteger } from "./numbers.ts";
import type { Dataset } from "./types.ts";
import { checkParams, cleanParams, DEFAULT_VALUATION } from "./valuation.ts";
import {
  describeWage,
  paidStaff,
  proposeWagesLevel,
  sortFigures,
  wageOn,
  wagesBetween,
  type WageFigure,
} from "./wages.ts";

const figure = (date: string, wage: number, id = date): WageFigure => ({
  id,
  companyId: "1",
  date,
  wage,
  source: "audited",
  note: null,
});

describe("paidStaff", () => {
  it("leaves the DG out of the headcount", () => {
    expect(paidStaff(4)).toBe(3);
    expect(paidStaff(1)).toBe(0);
    expect(paidStaff(0)).toBe(0);
    expect(paidStaff(null)).toBeNull();
  });
});

describe("wageOn", () => {
  const params = DEFAULT_VALUATION;
  const figures = sortFigures([figure("2026-11-10", 9_000), figure("2026-10-01", 3_000)]);

  it("takes the latest figure on or before the date", () => {
    expect(wageOn(figures, "banque", params, "2026-10-15").wage).toBe(3_000);
    expect(wageOn(figures, "banque", params, "2026-11-10").wage).toBe(9_000);
    expect(wageOn(figures, "banque", params, "2026-12-01").origin).toEqual({
      kind: "figure",
      date: "2026-11-10",
      source: "audited",
    });
  });

  it("lets the first figure cover the days before it", () => {
    expect(wageOn(figures, "banque", params, "2026-09-01").wage).toBe(3_000);
  });

  it("falls back on the reference of the sector, then of the market", () => {
    expect(wageOn([], "atelier-personnalisation", params, "2026-11-01")).toEqual({
      wage: 8_900,
      origin: { kind: "sector", sector: "atelier-personnalisation" },
    });
    expect(wageOn([], null, params, "2026-11-01")).toEqual({
      wage: 5_400,
      origin: { kind: "default" },
    });
  });

  it("says where the wage comes from", () => {
    expect(describeWage(wageOn([], "banque", params, "2026-11-01"))).toBe(
      `${formatInteger(4_400)} ¢ par salarié payé et par jour (barème Banque, DG non payé)`,
    );
  });
});

describe("proposeWagesLevel", () => {
  const rules = { livingWage: 2_000, coherentWageShare: 0.8 };
  // A bank's reference: 4 400 ¢, so coherent from 3 520 ¢.
  const level = (wage: number, payroll: number, revenue: number | null) =>
    proposeWagesLevel(wage, 4_400, payroll, revenue, rules);

  it("reads a wage under the living wage as insufficient", () => {
    expect(level(1_999, 0, 100_000)).toBe("insufficient");
    expect(level(2_000, 0, 100_000)).toBe("decent");
  });

  it("reads a wage near the sector's reference as coherent, if the revenue pays it", () => {
    expect(level(3_519, 3_519, 100_000)).toBe("decent");
    expect(level(3_520, 3_520, 100_000)).toBe("coherent");
    expect(level(9_000, 27_000, 20_000)).toBe("decent");
    // Unknown revenue proves nothing.
    expect(level(9_000, 27_000, null)).toBe("decent");
  });
});

describe("wagesBetween", () => {
  it("pays the mean paid headcount of both reports every night", () => {
    // 2 then 4 paid employees (3 and 5 with the DG), over 3 nights.
    expect(wagesBetween(3, 5, 3, 1_000)).toBe(9_000);
  });

  it("cannot say without both headcounts", () => {
    expect(wagesBetween(null, 5, 3, 1_000)).toBeNull();
    expect(wagesBetween(3, null, 3, 1_000)).toBeNull();
  });
});

describe("reference wages in the settings", () => {
  it("completes settings published before the wages with the defaults", () => {
    const params = cleanParams({ revenueDays: 45, sectorWages: { banque: "6000" } });
    expect(params.revenueDays).toBe(45);
    expect(params.sectorWages.banque).toBe(6_000);
    expect(params.sectorWages.technopole).toBe(DEFAULT_VALUATION.sectorWages.technopole);
    expect(params.defaultWage).toBe(DEFAULT_VALUATION.defaultWage);
  });

  it("checks every reference wage", () => {
    expect(() => checkParams(DEFAULT_VALUATION)).not.toThrow();
    const bad = (sectorWages: Partial<typeof DEFAULT_VALUATION.sectorWages>) => ({
      ...DEFAULT_VALUATION,
      sectorWages: { ...DEFAULT_VALUATION.sectorWages, ...sectorWages },
    });
    expect(() => checkParams(bad({ banque: -1 }))).toThrow(/Banque/);
    expect(() => checkParams(bad({ banque: 4_400.5 }))).toThrow(/entier/);
    expect(() => checkParams({ ...DEFAULT_VALUATION, defaultWage: 200_000 })).toThrow(
      /tous secteurs/,
    );
    expect(() => checkParams({ ...DEFAULT_VALUATION, livingWage: -1 })).toThrow(/Minimum vital/);
    expect(() => checkParams({ ...DEFAULT_VALUATION, coherentWageShare: 3 })).toThrow(/cohérents/);
    expect(cleanParams({}).livingWage).toBe(2_000);
    expect(cleanParams({}).coherentWageShare).toBe(0.8);
  });
});

describe("wage figures", () => {
  const dataset: Dataset = testDataset({
    generatedAt: "2026-11-13T00:00:00Z",
    companies: [
      { id: "1", name: "Alpha" },
      { id: "2", name: "Beta", closedOn: "2026-11-12" },
    ],
    consortiums: [],
    events: [],
    marketEvents: [],
    snapshots: [
      {
        date: "2026-11-05",
        source: "paste",
        rows: [
          { companyId: "1", rank: 1, chiffre: 100, capital: 5_000, employees: 3 },
          { companyId: "2", rank: 2, chiffre: 100, capital: 5_000, employees: 3 },
        ],
      },
    ],
  });
  const draft: WageFigureDraft = {
    id: null,
    companyId: "1",
    date: "2026-11-10",
    wage: 6_000,
    source: "audited",
    note: "  relevé par commandes de deck ",
  };

  it("checks a figure against the life, in the operator's words", () => {
    expect(planWage(dataset, draft).note).toBe("relevé par commandes de deck");
    expect(() => planWage(dataset, { ...draft, date: "2026-11-01" })).toThrow(/premier relevé/);
    expect(() => planWage(dataset, { ...draft, companyId: "2", date: "2026-11-12" })).toThrow(
      /fermée/,
    );
    expect(() => planWage(dataset, { ...draft, wage: -1 })).toThrow(/crédits entiers/);
    expect(() => planWage(dataset, { ...draft, wage: 12.5 })).toThrow(/crédits entiers/);
    expect(() => planWage(dataset, { ...draft, source: "rumour" as WageFigure["source"] })).toThrow(
      /source/,
    );
  });

  it("records and withdraws a figure", () => {
    const saved = applyOp(dataset, {
      type: "saveWage",
      figure: { ...draft, id: "w1" },
    });
    expect(saved.wageFigures).toEqual([
      { ...draft, id: "w1", note: "relevé par commandes de deck" },
    ]);
    const edited = applyOp(saved, {
      type: "saveWage",
      figure: { ...draft, id: "w1", wage: 7_000 },
    });
    expect(edited.wageFigures?.map((f) => f.wage)).toEqual([7_000]);
    expect(applyOp(edited, { type: "deleteWage", id: "w1" }).wageFigures).toEqual([]);
  });

  it("reads stored figures, dropping an unknown source", () => {
    const { wageFigures } = normalizeDataset({
      companies: [{ id: "1", name: "Alpha" }],
      snapshots: [],
      wageFigures: [
        { id: 7, companyId: 1, date: "2026-11-10", wage: "6000", source: "declared", note: null },
        { id: 8, companyId: 1, date: "2026-11-11", wage: 1, source: "rumour", note: null },
      ],
    });
    expect(wageFigures).toEqual([
      { id: "7", companyId: "1", date: "2026-11-10", wage: 6_000, source: "declared", note: null },
    ]);
  });
});
