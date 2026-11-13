/**
 * Imports the historical Google Sheet export into KNX's dataset format.
 *
 *   node scripts/import-sheet.ts "data/source/Données entreprises.xlsx" \
 *     --report "data/source/releves/2026-11-13.txt=2026-11-13"
 *
 * Writes `public/data/history.json` (local data source) and `supabase/seed.sql`.
 * Reads values only (formula results); the sheet's formulas are re-implemented in `src/domain`.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import ExcelJS from "exceljs";
import { isIsoDate } from "../src/domain/dates.ts";
import { parseAmount } from "../src/domain/numbers.ts";
import { parseReport } from "../src/domain/report.ts";
import type { CompanyMeta, Dataset, Snapshot, SnapshotRow } from "../src/domain/types.ts";
import { toSeedSql } from "./seed-sql.ts";

const SHEETS = {
  chiffre: "Chiffre quotidien",
  capital: "Capital",
  employees: "Nb Employés",
  age: "Âge",
} as const;

type Cell = ExcelJS.CellValue;

function resultOf(value: Cell): Cell {
  if (value && typeof value === "object" && !(value instanceof Date)) {
    if ("result" in value) return (value.result ?? null) as Cell;
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
    if ("error" in value) return null;
  }
  return value;
}

function isFormula(value: Cell): boolean {
  return Boolean(
    value && typeof value === "object" && ("formula" in value || "sharedFormula" in value),
  );
}

function toIso(value: Cell): string | null {
  const v = resultOf(value);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return null;
}

function toNumber(value: Cell): number | null {
  const v = resultOf(value);
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : null;
  if (typeof v === "string") return parseAmount(v);
  return null;
}

function findSheet(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const normalized = name.normalize("NFC");
  const sheet = workbook.worksheets.find((ws) => ws.name.normalize("NFC") === normalized);
  if (!sheet) throw new Error(`Onglet introuvable : ${name}`);
  return sheet;
}

/** Maps company name → column index from a sheet's header row, skipping total columns. */
function companyColumns(sheet: ExcelJS.Worksheet, firstColumn: number): Map<string, number> {
  const columns = new Map<string, number>();
  const header = sheet.getRow(1);
  for (let c = firstColumn; c <= sheet.columnCount; c++) {
    const name = resultOf(header.getCell(c).value);
    if (typeof name === "string" && name.trim() !== "") columns.set(name.trim(), c);
  }
  return columns;
}

/** Reads one metric sheet as date → company → value. */
function readMetric(
  sheet: ExcelJS.Worksheet,
  firstColumn: number,
): Map<string, Map<string, number>> {
  const columns = companyColumns(sheet, firstColumn);
  const byDate = new Map<string, Map<string, number>>();
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const date = toIso(row.getCell(1).value);
    if (!date) continue;
    const values = byDate.get(date) ?? new Map<string, number>();
    for (const [name, c] of columns) {
      const value = toNumber(row.getCell(c).value);
      if (value !== null) values.set(name, value);
    }
    byDate.set(date, values);
  }
  return byDate;
}

function parseArgs(argv: string[]): {
  workbook: string;
  reports: { path: string; date: string }[];
} {
  const reports: { path: string; date: string }[] = [];
  let workbook = "data/source/Données entreprises.xlsx";
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--report") {
      const spec = argv[++i] ?? "";
      const at = spec.lastIndexOf("=");
      const path = spec.slice(0, at);
      const date = spec.slice(at + 1);
      if (at < 1 || !isIsoDate(date))
        throw new Error(`--report attend chemin=AAAA-MM-JJ, reçu « ${spec} »`);
      reports.push({ path, date });
    } else {
      workbook = arg;
    }
  }
  return { workbook, reports };
}

async function main(): Promise<void> {
  const { workbook: workbookPath, reports } = parseArgs(process.argv.slice(2));
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(resolve(workbookPath));

  const chiffreSheet = findSheet(workbook, SHEETS.chiffre);
  const chiffre = readMetric(chiffreSheet, 3);
  const capital = readMetric(findSheet(workbook, SHEETS.capital), 3);
  const employees = readMetric(findSheet(workbook, SHEETS.employees), 3);
  const companyNames = [...companyColumns(chiffreSheet, 3).keys()];

  // Hand-typed creation dates in the « Âge » sheet (row 2 holds a date instead of a formula).
  const ageSheet = findSheet(workbook, SHEETS.age);
  const overrides = new Map<string, string>();
  for (const [name, c] of companyColumns(ageSheet, 2)) {
    const cell = ageSheet.getRow(2).getCell(c).value;
    const iso = isFormula(cell) ? null : toIso(cell);
    if (iso) overrides.set(name, iso);
  }

  // The sheet writes 0 both for a company listed at 0 and for one that does not exist yet
  // (Metropolis before its creation). A row counts as present when the company published a
  // figure, when its capital or staff were recorded that day, when it never published anything
  // but 0 (Advenio: listed at 0 throughout), or when the zero comes after its first positive
  // figure or its hand-typed creation date. Only leading zeros of a company that appears later
  // are left out.
  const firstPositive = new Map<string, string>();
  const dates = [...chiffre.keys()].sort();
  for (const date of dates) {
    for (const [name, value] of chiffre.get(date) ?? []) {
      if (value > 0 && !firstPositive.has(name)) firstPositive.set(name, date);
    }
  }
  const isPresent = (name: string, date: string, value: number): boolean => {
    if (value > 0) return true;
    if (capital.get(date)?.has(name) || employees.get(date)?.has(name)) return true;
    const since = firstPositive.get(name);
    if (since === undefined) return true;
    const created = overrides.get(name);
    return date >= since || (created !== undefined && date >= created);
  };

  const snapshots: Snapshot[] = dates.map((date) => {
    const rows: SnapshotRow[] = [];
    for (const [name, value] of chiffre.get(date) ?? []) {
      if (!isPresent(name, date, value)) continue;
      rows.push({
        name,
        rank: null,
        chiffre: value,
        capital: capital.get(date)?.get(name) ?? null,
        employees: employees.get(date)?.get(name) ?? null,
      });
    }
    return { date, source: "sheet", rows };
  });

  for (const report of reports) {
    const text = await readFile(resolve(report.path), "utf8");
    const parsed = parseReport(text);
    if (parsed.errors.length > 0) {
      for (const error of parsed.errors) console.error(`  ligne ${error.line} : ${error.reason}`);
      throw new Error(`Rapport ${report.path} illisible`);
    }
    const existing = snapshots.findIndex((s) => s.date === report.date);
    const snapshot: Snapshot = { date: report.date, source: "paste", rows: parsed.rows };
    if (existing >= 0) snapshots[existing] = snapshot;
    else snapshots.push(snapshot);
    for (const row of parsed.rows)
      if (!companyNames.includes(row.name)) companyNames.push(row.name);
  }
  snapshots.sort((a, b) => a.date.localeCompare(b.date));

  const companies: CompanyMeta[] = companyNames.map((name) => ({
    name,
    creationOverride: overrides.get(name) ?? null,
  }));

  const dataset: Dataset = { generatedAt: new Date().toISOString(), companies, snapshots };

  const jsonPath = resolve("public/data/history.json");
  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, JSON.stringify(dataset));

  const sqlPath = resolve("supabase/seed.sql");
  await mkdir(dirname(sqlPath), { recursive: true });
  await writeFile(sqlPath, toSeedSql(dataset));

  const rows = snapshots.reduce((sum, s) => sum + s.rows.length, 0);
  console.log(
    `${companies.length} entreprises, ${snapshots.length} relevés (${snapshots[0]?.date} → ${snapshots.at(-1)?.date}), ${rows} lignes, ${overrides.size} dates de création saisies.`,
  );
}

await main();
