/**
 * Reads one export of the historical Google Sheet (`.xlsx`, values only): the current workbook or
 * one of its past versions.
 */
import ExcelJS from "exceljs";
import { parseAmount } from "../src/domain/numbers.ts";
import type { SheetData } from "./sheet-merge.ts";

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

function findSheet(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet | null {
  const normalized = name.normalize("NFC");
  return workbook.worksheets.find((ws) => ws.name.normalize("NFC") === normalized) ?? null;
}

function requireSheet(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const sheet = findSheet(workbook, name);
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
  sheet: ExcelJS.Worksheet | null,
  firstColumn: number,
): Map<string, Map<string, number>> {
  const byDate = new Map<string, Map<string, number>>();
  if (!sheet) return byDate;
  const columns = companyColumns(sheet, firstColumn);
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

/**
 * Reads a workbook export. Older versions may lack the capital, staff or age sheets: they read as
 * empty. The daily revenue sheet is required.
 */
export async function readWorkbook(path: string): Promise<SheetData> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);

  const chiffre = readMetric(requireSheet(workbook, SHEETS.chiffre), 3);
  const capital = readMetric(findSheet(workbook, SHEETS.capital), 3);
  const employees = readMetric(findSheet(workbook, SHEETS.employees), 3);

  // Hand-typed creation dates in the « Âge » sheet (row 2 holds a date instead of a formula).
  const overrides = new Map<string, string>();
  const ageSheet = findSheet(workbook, SHEETS.age);
  if (ageSheet)
    for (const [name, c] of companyColumns(ageSheet, 2)) {
      const cell = ageSheet.getRow(2).getCell(c).value;
      const iso = isFormula(cell) ? null : toIso(cell);
      if (iso) overrides.set(name, iso);
    }

  const columns = [...companyColumns(requireSheet(workbook, SHEETS.chiffre), 3).keys()];
  return { columns, chiffre, capital, employees, overrides };
}
