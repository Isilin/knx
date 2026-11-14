import { describe, expect, it } from "vite-plus/test";
import { INGEST_LIMITS, validateIngest } from "./ingest.ts";

const TODAY = "2026-11-13";

const errorsOf = (body: unknown) => {
  const result = validateIngest(body, TODAY);
  return result.ok ? [] : result.errors;
};

describe("validateIngest", () => {
  it("normalises numbers sent as the game prints them", () => {
    const result = validateIngest(
      {
        date: TODAY,
        rows: [
          {
            name: " Armacham Technology ",
            rank: 1,
            chiffre: "677.085",
            capital: "27.120.847",
            employees: 4,
          },
          { name: "Seven", rank: "2", chiffre: 4_700, capital: "", employees: null },
        ],
        extra: "ignored",
      },
      TODAY,
    );
    expect(result).toEqual({
      ok: true,
      payload: {
        date: TODAY,
        rows: [
          {
            name: "Armacham Technology",
            rank: 1,
            chiffre: 677_085,
            capital: 27_120_847,
            employees: 4,
          },
          { name: "Seven", rank: 2, chiffre: 4_700, capital: null, employees: null },
        ],
      },
    });
  });

  it("ranks rows by chiffre when no rank is given", () => {
    const result = validateIngest(
      {
        date: TODAY,
        rows: [
          { name: "Small", chiffre: 10 },
          { name: "Big", chiffre: 900 },
        ],
      },
      TODAY,
    );
    expect(result.ok && result.payload.rows.map((r) => `${r.rank}:${r.name}`)).toEqual([
      "1:Big",
      "2:Small",
    ]);
  });

  it("refuses a body that is not an object", () => {
    expect(errorsOf(null)).toEqual(["Le corps doit être un objet JSON { date, rows }."]);
    expect(errorsOf([{ name: "A", chiffre: 1 }])).toHaveLength(1);
    expect(errorsOf("texte")).toHaveLength(1);
  });

  it("checks the date format and window", () => {
    const rows = [{ name: "A", chiffre: 1 }];
    expect(errorsOf({ date: "13/11/2026", rows })[0]).toMatch(/AAAA-MM-JJ/);
    expect(errorsOf({ rows })[0]).toMatch(/AAAA-MM-JJ/);
    expect(errorsOf({ date: "2026-11-06", rows })).toEqual([]);
    expect(errorsOf({ date: "2026-11-05", rows })[0]).toMatch(/trop ancienne/);
    expect(errorsOf({ date: "2026-11-14", rows })).toEqual([]);
    expect(errorsOf({ date: "2026-11-15", rows })[0]).toMatch(/futur/);
  });

  it("refuses missing, empty or oversized row lists", () => {
    expect(errorsOf({ date: TODAY })).toEqual(["rows attendu : une liste de corporations."]);
    expect(errorsOf({ date: TODAY, rows: [] })[0]).toMatch(/vide/);
    const many = Array.from({ length: INGEST_LIMITS.maxRows + 1 }, (_, i) => ({
      name: `C${i}`,
      chiffre: i,
    }));
    expect(errorsOf({ date: TODAY, rows: many })).toEqual([
      "201 corporations : 200 au plus par relevé.",
    ]);
  });

  it("explains each bad row in the operator's words", () => {
    const errors = errorsOf({
      date: TODAY,
      rows: [
        "Armacham",
        { chiffre: 1 },
        { name: "x".repeat(101), chiffre: 1 },
        { name: "Dup", chiffre: 1 },
        { name: "Dup", chiffre: 2 },
        { name: "NoChiffre" },
        { name: "Neg", chiffre: -1 },
        { name: "Dec", chiffre: 1.5 },
        { name: "Rank0", chiffre: 1, rank: 0 },
        { name: "Cap", chiffre: 1, capital: "beaucoup" },
        { name: "Staff", chiffre: 1, employees: -3 },
        { name: "Bool", chiffre: true },
      ],
    });
    expect(errors).toEqual([
      "Ligne 1 : objet { name, chiffre, … } attendu.",
      "Ligne 2 : nom manquant.",
      "Ligne 3 : nom de plus de 100 caractères.",
      "Ligne 5 : « Dup » apparaît deux fois.",
      "Ligne 6 : chiffre manquant pour « NoChiffre ».",
      "Ligne 7 : chiffre illisible pour « Neg ».",
      "Ligne 8 : chiffre illisible pour « Dec ».",
      "Ligne 9 : rang illisible pour « Rank0 ».",
      "Ligne 10 : capital illisible pour « Cap ».",
      "Ligne 11 : effectif illisible pour « Staff ».",
      "Ligne 12 : chiffre illisible pour « Bool ».",
    ]);
  });

  it("accepts a negative capital, as the schema does", () => {
    expect(errorsOf({ date: TODAY, rows: [{ name: "A", chiffre: 0, capital: "-5" }] })).toEqual([]);
  });

  it("wants every rank or none", () => {
    expect(
      errorsOf({
        date: TODAY,
        rows: [
          { name: "A", rank: 1, chiffre: 2 },
          { name: "B", chiffre: 1 },
        ],
      }),
    ).toEqual(["rangs incomplets : donnez le rang de toutes les corporations, ou d'aucune."]);
  });

  it("caps the error list", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ name: `C${i}`, chiffre: -1 }));
    const errors = errorsOf({ date: TODAY, rows });
    expect(errors).toHaveLength(INGEST_LIMITS.maxErrors + 1);
    expect(errors.at(-1)).toBe("… et 10 autres erreurs.");
  });
});
