import { describe, expect, it } from "vite-plus/test";
import { applyOp, normalizeDataset, planOperation } from "./mutations.ts";
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

  it("proposes a round share count near the target price", () => {
    expect(proposeShares(2_812_000, 1000)).toBe(2500);
    expect(proposeShares(9_400_000, 1000)).toBe(10_000);
    expect(proposeShares(500, 1000)).toBe(1);
    expect(proposeShares(0, 1000)).toBe(1);
  });
});
