import { describe, expect, it } from "vite-plus/test";
import { applyOp, normalizeDataset, planBalance, planOperation } from "./mutations.ts";
import { datasetByName } from "./testing.ts";
import { DEFAULT_VALUATION } from "./valuation.ts";
import {
  checkOperations,
  listingSteps,
  proposeShares,
  stepOn,
  type SecurityOperation,
} from "./securities.ts";

let seq = 0;
const op = (
  o: Partial<SecurityOperation> & Pick<SecurityOperation, "kind" | "date">,
): SecurityOperation => ({
  id: String(++seq),
  companyId: "c",
  shares: null,
  ratio: null,
  note: null,
  ...o,
});

describe("operations on securities", () => {
  it("replays an introduction, a division and a consolidation", () => {
    const steps = checkOperations([
      op({ kind: "introduction", date: "2026-10-01", shares: 1000 }),
      op({ kind: "split", date: "2026-10-10", ratio: 5 }),
      op({ kind: "reverse_split", date: "2026-10-20", ratio: 10 }),
    ]);
    expect(steps.map((s) => s.shares)).toEqual([1000, 5000, 500]);
    expect(stepOn(steps, "2026-10-15")?.shares).toBe(5000);
    expect(stepOn(steps, "2026-09-30")).toBeNull();
  });

  it("orders by date whatever the recording order", () => {
    const steps = checkOperations([
      op({ kind: "split", date: "2026-10-10", ratio: 2 }),
      op({ kind: "introduction", date: "2026-10-01", shares: 100 }),
    ]);
    expect(steps.at(-1)?.shares).toBe(200);
  });

  it("refuses what cannot apply, in the operator's words", () => {
    const intro = op({ kind: "introduction", date: "2026-10-01", shares: 1000 });
    expect(() => checkOperations([op({ kind: "split", date: "2026-10-01", ratio: 2 })])).toThrow(
      /n'est pas cotée/,
    );
    expect(() =>
      checkOperations([intro, op({ kind: "introduction", date: "2026-10-02", shares: 5 })]),
    ).toThrow(/déjà cotée/);
    expect(() =>
      checkOperations([intro, op({ kind: "reverse_split", date: "2026-10-02", ratio: 3 })]),
    ).toThrow(/ne se regroupent pas/);
    expect(() => checkOperations([intro, op({ kind: "resumption", date: "2026-10-02" })])).toThrow(
      /pas suspendue/,
    );
    expect(() =>
      checkOperations([op({ kind: "introduction", date: "2026-10-01", shares: 0 })]),
    ).toThrow(/au moins 1/);
  });

  it("suspends, resumes, exits and lets a corporation come back", () => {
    const steps = checkOperations([
      op({ kind: "introduction", date: "2026-10-01", shares: 1000 }),
      op({ kind: "suspension", date: "2026-10-05" }),
      op({ kind: "resumption", date: "2026-10-08" }),
      op({ kind: "withdrawal", date: "2026-10-12" }),
      op({ kind: "introduction", date: "2026-11-01", shares: 40 }),
    ]);
    expect(steps.map((s) => s.state)).toEqual([
      "listed",
      "suspended",
      "listed",
      "withdrawn",
      "listed",
    ]);
    expect(steps.at(-1)?.introducedOn).toBe("2026-11-01");
  });

  it("skips a bad line when reading, without breaking the rest", () => {
    const steps = listingSteps([
      op({ kind: "resumption", date: "2026-09-01" }),
      op({ kind: "introduction", date: "2026-10-01", shares: 10 }),
    ]);
    expect(steps).toHaveLength(1);
    expect(steps[0].state).toBe("listed");
  });

  it("checks an operation against the life before recording it", () => {
    const dataset = datasetByName({
      generatedAt: "2026-11-13T00:00:00Z",
      companies: [{ name: "Closed", closedOn: "2026-11-12" }],
      snapshots: ["2026-11-10", "2026-11-11"].map((date) => ({
        date,
        source: "paste" as const,
        rows: [{ name: "Closed", rank: 1, chiffre: 100, capital: 1000, employees: 1 }],
      })),
    });
    const draft = {
      id: null,
      companyId: "Closed",
      kind: "introduction" as const,
      shares: 100,
      ratio: 7,
      note: "  ",
    };
    expect(() => planOperation(dataset, { ...draft, date: "2026-11-01" })).toThrow(
      /premier relevé/,
    );
    expect(() => planOperation(dataset, { ...draft, date: "2026-11-12" })).toThrow(/fermée/);
    const clean = planOperation(dataset, { ...draft, date: "2026-11-11" });
    expect(clean.ratio).toBeNull();
    expect(clean.note).toBeNull();
    const next = applyOp(dataset, {
      type: "saveOperation",
      operation: { ...clean, id: "op1" },
    });
    expect(next.securityOperations).toHaveLength(1);
    expect(() =>
      applyOp(next, {
        type: "saveOperation",
        operation: {
          ...clean,
          id: "op2",
          kind: "split",
          shares: null,
          ratio: 2,
          date: "2026-11-10",
        },
      }),
    ).toThrow(/n'est pas cotée/);
  });

  it("publishes settings only within bounds, and reads stored ones safely", () => {
    const dataset = normalizeDataset({ companies: [], snapshots: [] });
    expect(() =>
      applyOp(dataset, {
        type: "publishValuation",
        settings: {
          id: "s1",
          date: "2026-11-13",
          method: "v1",
          params: { ...DEFAULT_VALUATION, capitalWeight: 3 },
          note: null,
        },
      }),
    ).toThrow(/Poids du capital/);
    const read = normalizeDataset({
      companies: [],
      snapshots: [],
      valuationSettings: [{ id: 4, date: "2026-11-13", params: { revenueDays: "45" } }],
    });
    expect(read.valuationSettings?.[0].params.revenueDays).toBe(45);
    expect(read.valuationSettings?.[0].params.spikeCap).toBe(DEFAULT_VALUATION.spikeCap);
    expect(read.valuationSettings?.[0].id).toBe("4");
  });

  it("adds the shares of a capital increase, which only a session records", () => {
    const steps = checkOperations([
      op({ kind: "introduction", date: "2026-10-01", shares: 1000 }),
      op({ kind: "capital_increase", date: "2026-10-08", shares: 250 }),
      op({ kind: "split", date: "2026-10-15", ratio: 2 }),
    ]);
    expect(steps.map((s) => s.shares)).toEqual([1000, 1250, 2500]);
    expect(steps[1].state).toBe("listed");
    expect(() =>
      checkOperations([op({ kind: "capital_increase", date: "2026-10-01", shares: 10 })]),
    ).toThrow(/n'est pas cotée/);

    const dataset = datasetByName({
      generatedAt: "2026-11-13T00:00:00Z",
      companies: [{ name: "Listed" }],
      snapshots: ["2026-11-10", "2026-11-11"].map((date) => ({
        date,
        source: "paste" as const,
        rows: [{ name: "Listed", rank: 1, chiffre: 100, capital: 1000, employees: 1 }],
      })),
    });
    const introduced = applyOp(dataset, {
      type: "saveOperation",
      operation: {
        id: "i",
        companyId: "Listed",
        date: "2026-11-10",
        kind: "introduction",
        shares: 100,
        ratio: null,
        note: null,
      },
    });
    const increase = {
      id: null,
      companyId: "Listed",
      date: "2026-11-11",
      kind: "capital_increase" as const,
      shares: 20,
      ratio: null,
      note: null,
    };
    expect(() => planOperation(introduced, increase)).toThrow(/clôture d'une offre d'émission/);
    // One recorded by a session keeps its figures; only its note changes.
    const recorded = {
      ...introduced,
      securityOperations: [...(introduced.securityOperations ?? []), { ...increase, id: "ci" }],
    };
    expect(planOperation(recorded, { ...increase, id: "ci", note: " Levée " }).note).toBe("Levée");
    expect(() => planOperation(recorded, { ...increase, id: "ci", shares: 30 })).toThrow(
      /seule sa note/,
    );
  });

  it("proposes a round share count near the target price", () => {
    expect(proposeShares(2_812_000, 1000)).toBe(2500);
    expect(proposeShares(9_400_000, 1000)).toBe(10_000);
    expect(proposeShares(500, 1000)).toBe(1);
    expect(proposeShares(0, 1000)).toBe(1);
  });
});

describe("balance sheet checks", () => {
  const dataset = datasetByName({
    generatedAt: "2026-11-13T00:00:00Z",
    companies: [{ name: "Shop" }],
    snapshots: ["2026-11-10", "2026-11-11"].map((date) => ({
      date,
      source: "paste" as const,
      rows: [{ name: "Shop", rank: 1, chiffre: 100, capital: 1000, employees: 1 }],
    })),
  });
  const draft = {
    id: null,
    companyId: "Shop",
    date: "2026-11-11",
    land: null,
    building: null,
    fittings: null,
    stock: null,
    source: "declared" as const,
    note: null,
  };

  it("refuses an empty sheet, a negative amount or a date outside the life", () => {
    expect(() => planBalance(dataset, draft)).toThrow(/au moins un poste/);
    expect(() => planBalance(dataset, { ...draft, land: -5 })).toThrow(/entiers, positifs/);
    expect(() => planBalance(dataset, { ...draft, land: 10, date: "2026-11-01" })).toThrow(
      /premier relevé/,
    );
  });

  it("records a sheet and reads stored ones safely", () => {
    const next = applyOp(dataset, {
      type: "saveBalance",
      sheet: { ...draft, id: "b1", stock: 5000, note: "  dossier  " },
    });
    expect(next.balanceSheets?.[0].note).toBe("dossier");
    const read = normalizeDataset({
      companies: [],
      snapshots: [],
      balanceSheets: [
        { id: 3, companyId: 7, date: "2026-11-11", land: "1200", source: "audited" },
        { id: 4, companyId: 7, date: "2026-11-11", land: 1, source: "rumeur" },
      ],
    });
    expect(read.balanceSheets).toHaveLength(1);
    expect(read.balanceSheets?.[0]).toMatchObject({
      id: "3",
      companyId: "7",
      land: 1200,
      stock: null,
    });
  });
});
