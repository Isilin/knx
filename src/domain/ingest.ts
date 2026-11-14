import { addDays, isIsoDate } from "./dates.ts";
import { assignRanks } from "./diff.ts";
import { parseAmount } from "./numbers.ts";
import type { IsoDate, ReportRow } from "./types.ts";

/**
 * Limits of a report sent by the in-game module. The database enforces the same ones
 * (`snapshot_rows_valid` and `ingest_snapshot`); these give the module readable reasons.
 */
export const INGEST_LIMITS = {
  maxRows: 200,
  maxNameLength: 100,
  maxBodyBytes: 65_536,
  /** Oldest accepted date, in days before today (Paris). */
  daysBack: 7,
  /** Latest accepted date, in days after today (Paris). */
  daysAhead: 1,
  maxErrors: 20,
} as const;

const MAX_INT32 = 2_147_483_647;

export interface IngestPayload {
  date: IsoDate;
  rows: ReportRow[];
}

export type IngestValidation =
  | { ok: true; payload: IngestPayload }
  | { ok: false; errors: string[] };

/**
 * Reads a whole number sent either as a JSON number or as the game prints it (`"27.120.847"`).
 * `absent` for a missing or empty value, `invalid` when it is not a whole amount.
 */
function readInteger(value: unknown): number | "absent" | "invalid" {
  if (value === undefined || value === null || value === "") return "absent";
  if (typeof value === "number") return Number.isSafeInteger(value) ? value : "invalid";
  if (typeof value === "string") return parseAmount(value) ?? "invalid";
  return "invalid";
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Checks and normalises a report sent by the in-game module: `{ date, rows }`.
 *
 * Names are kept exactly, only trimmed. Ranks are all given or all absent; when absent, KNX ranks
 * the rows by chiffre as it does for the manual form. Every row comes out with all five fields,
 * so the same report always normalises to the same JSON.
 */
export function validateIngest(body: unknown, today: IsoDate): IngestValidation {
  if (!isRecord(body)) {
    return { ok: false, errors: ["Le corps doit être un objet JSON { date, rows }."] };
  }

  const errors: string[] = [];
  const { date, rows } = body;

  if (typeof date !== "string" || !isIsoDate(date)) {
    errors.push("date attendue au format AAAA-MM-JJ (date grégorienne, heure de Paris).");
  } else if (date < addDays(today, -INGEST_LIMITS.daysBack)) {
    errors.push(`date trop ancienne : ${INGEST_LIMITS.daysBack} jours au plus avant aujourd'hui.`);
  } else if (date > addDays(today, INGEST_LIMITS.daysAhead)) {
    errors.push(`date dans le futur : ${date}, alors que nous sommes le ${today} à Paris.`);
  }

  if (!Array.isArray(rows)) {
    errors.push("rows attendu : une liste de corporations.");
    return { ok: false, errors };
  }
  if (rows.length === 0) errors.push("rows est vide : le relevé ne contient aucune corporation.");
  if (rows.length > INGEST_LIMITS.maxRows) {
    errors.push(`${rows.length} corporations : ${INGEST_LIMITS.maxRows} au plus par relevé.`);
    return { ok: false, errors };
  }

  const normalised: ReportRow[] = [];
  const seen = new Set<string>();
  rows.forEach((raw: unknown, index) => {
    const line = `Ligne ${index + 1}`;
    if (!isRecord(raw)) {
      errors.push(`${line} : objet { name, chiffre, … } attendu.`);
      return;
    }
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name) {
      errors.push(`${line} : nom manquant.`);
      return;
    }
    if (name.length > INGEST_LIMITS.maxNameLength) {
      errors.push(`${line} : nom de plus de ${INGEST_LIMITS.maxNameLength} caractères.`);
      return;
    }
    if (seen.has(name)) {
      errors.push(`${line} : « ${name} » apparaît deux fois.`);
      return;
    }
    seen.add(name);

    const rank = readInteger(raw.rank);
    const chiffre = readInteger(raw.chiffre);
    const capital = readInteger(raw.capital);
    const employees = readInteger(raw.employees);

    if (chiffre === "absent") errors.push(`${line} : chiffre manquant pour « ${name} ».`);
    else if (chiffre === "invalid" || chiffre < 0)
      errors.push(`${line} : chiffre illisible pour « ${name} ».`);
    else if (rank === "invalid" || (typeof rank === "number" && (rank < 1 || rank > MAX_INT32)))
      errors.push(`${line} : rang illisible pour « ${name} ».`);
    else if (capital === "invalid") errors.push(`${line} : capital illisible pour « ${name} ».`);
    else if (
      employees === "invalid" ||
      (typeof employees === "number" && (employees < 0 || employees > MAX_INT32))
    )
      errors.push(`${line} : effectif illisible pour « ${name} ».`);
    else
      normalised.push({
        name,
        rank: rank === "absent" ? null : rank,
        chiffre,
        capital: capital === "absent" ? null : capital,
        employees: employees === "absent" ? null : employees,
      });
  });

  const ranked = normalised.filter((r) => r.rank !== null).length;
  if (ranked > 0 && ranked < normalised.length) {
    errors.push("rangs incomplets : donnez le rang de toutes les corporations, ou d'aucune.");
  }

  if (errors.length > 0) {
    const shown = errors.slice(0, INGEST_LIMITS.maxErrors);
    const hidden = errors.length - shown.length;
    if (hidden > 0)
      shown.push(`… et ${hidden} autre${hidden > 1 ? "s" : ""} erreur${hidden > 1 ? "s" : ""}.`);
    return { ok: false, errors: shown };
  }

  return {
    ok: true,
    payload: {
      date: date as IsoDate,
      rows: ranked === 0 ? assignRanks(normalised) : normalised,
    },
  };
}
