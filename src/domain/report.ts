import { parseAmount } from "./numbers.ts";
import type { ReportRow } from "./types.ts";

export interface ReportLineError {
  line: number;
  text: string;
  reason: string;
}

export interface ParsedReport {
  rows: ReportRow[];
  errors: ReportLineError[];
}

const HEADER = /^(corporations|class\.?\s)/i;
const AMOUNT = String.raw`(\d{1,3}(?:[.\s  ]\d{3})+|\d+)`;
/** Fallback for reports copied without tabs: rank, name, chiffre, capital, staff. */
const SPACED = new RegExp(String.raw`^(\d+)\s+(.+?)\s+${AMOUNT}\s+${AMOUNT}\s+(\d+)$`);

/**
 * Parses the « Corporations » report copied from the game.
 *
 * Expected columns: `Class.`, `Nom`, `Chiffre`, `Capital`, `Employés`, separated by tabs.
 * The game pads cells with a trailing space and uses CRLF; both are tolerated, as are
 * reports pasted with spaces instead of tabs. Names are kept exactly, only trimmed.
 */
export function parseReport(text: string): ParsedReport {
  const rows: ReportRow[] = [];
  const errors: ReportLineError[] = [];
  const seen = new Set<string>();

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    const trimmed = raw.trim();
    if (trimmed === "" || HEADER.test(trimmed)) return;

    const row = raw.includes("\t") ? parseTabbed(raw) : parseSpaced(trimmed);
    if (typeof row === "string") {
      errors.push({ line, text: trimmed, reason: row });
      return;
    }
    if (seen.has(row.name)) {
      errors.push({ line, text: trimmed, reason: `« ${row.name} » apparaît deux fois.` });
      return;
    }
    seen.add(row.name);
    rows.push(row);
  });

  return { rows, errors };
}

function parseTabbed(raw: string): ReportRow | string {
  const cells = raw.split("\t").map((cell) => cell.trim());
  while (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
  if (cells.length !== 5) return `5 colonnes attendues, ${cells.length} trouvées.`;
  return toRow(cells[0], cells[1], cells[2], cells[3], cells[4]);
}

function parseSpaced(trimmed: string): ReportRow | string {
  const match = SPACED.exec(trimmed);
  if (!match) return "Ligne illisible : rang, nom, chiffre, capital et employés attendus.";
  return toRow(match[1], match[2], match[3], match[4], match[5]);
}

function toRow(
  rankText: string,
  name: string,
  chiffreText: string,
  capitalText: string,
  employeesText: string,
): ReportRow | string {
  const rank = parseAmount(rankText);
  const chiffre = parseAmount(chiffreText);
  const capital = parseAmount(capitalText);
  const employees = parseAmount(employeesText);
  if (rank === null || rank < 1) return `Rang illisible : « ${rankText} ».`;
  if (name === "") return "Nom manquant.";
  if (chiffre === null || chiffre < 0) return `Chiffre illisible : « ${chiffreText} ».`;
  if (capital === null) return `Capital illisible : « ${capitalText} ».`;
  if (employees === null || employees < 0) return `Employés illisibles : « ${employeesText} ».`;
  return { name, rank, chiffre, capital, employees };
}
