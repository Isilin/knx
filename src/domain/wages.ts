import { SOURCE_INFO, type AssetSource } from "./balance.ts";
import { formatImperialDate } from "./imperial.ts";
import { formatInteger } from "./numbers.ts";
import { sectorShort, type SectorId } from "./sectors.ts";
import type { IsoDate } from "./types.ts";
import type { ValuationParams } from "./valuation.ts";

/**
 * Wages of a corporation, as KNX estimates them. The game takes them from the till every day at
 * midnight; the DG sets each one and is not paid (he takes or puts money as he likes). Reading a
 * wage takes one deck command per employee, so KNX assumes the reference wage of the sector,
 * unless the Agence audited the corporation's own (or its direction declared it).
 */

/** The mean daily wage of a life's paid employees, as audited or declared on a date. */
export interface WageFigure {
  id: string;
  /** The life the figure belongs to. */
  companyId: string;
  date: IsoDate;
  /** Credits a day, per paid employee. */
  wage: number;
  source: AssetSource;
  note: string | null;
}

/** Where the wage KNX uses comes from. */
export type WageOrigin =
  | { kind: "figure"; date: IsoDate; source: AssetSource }
  | { kind: "sector"; sector: SectorId }
  | { kind: "default" };

export interface WageRate {
  /** Credits a day, per paid employee. */
  wage: number;
  origin: WageOrigin;
}

/** Largest daily wage a figure takes. */
export const MAX_WAGE = 1_000_000;

/** Paid employees in a headcount: the DG, counted in `Employés`, is not paid. */
export function paidStaff(employees: number | null): number | null {
  return employees === null ? null : Math.max(0, employees - 1);
}

/**
 * The wage in force on `date`. A figure holds from its date until the next one, and the first
 * figure also covers the days before it (wages hardly move); without a figure, the reference
 * of the sector, or of the whole market for a corporation filed under none.
 */
export function wageOn(
  figures: readonly WageFigure[],
  sector: SectorId | null,
  params: Pick<ValuationParams, "sectorWages" | "defaultWage">,
  date: IsoDate,
): WageRate {
  let figure: WageFigure | null = null;
  for (const f of figures) {
    if (figure === null || f.date <= date) figure = f;
    if (f.date > date) break;
  }
  if (figure) {
    return {
      wage: figure.wage,
      origin: { kind: "figure", date: figure.date, source: figure.source },
    };
  }
  if (sector) return { wage: params.sectorWages[sector], origin: { kind: "sector", sector } };
  return { wage: params.defaultWage, origin: { kind: "default" } };
}

/**
 * Wages paid between two reports `gap` days apart: the mean paid headcount of both ends, each
 * midnight, at `wage`. Null when either headcount is unknown.
 */
export function wagesBetween(
  previousEmployees: number | null,
  employees: number | null,
  gap: number,
  wage: number,
): number | null {
  const before = paidStaff(previousEmployees);
  const after = paidStaff(employees);
  if (before === null || after === null) return null;
  return ((before + after) / 2) * gap * wage;
}

/** Figures of a life, oldest first, as `wageOn` reads them. */
export function sortFigures(figures: readonly WageFigure[]): WageFigure[] {
  return [...figures].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

/** `barème Atelier`, `audité par l'Agence le 3/386.2`: where a wage comes from, in a few words. */
export function wageOriginLabel(origin: WageOrigin): string {
  switch (origin.kind) {
    case "figure":
      return `${SOURCE_INFO[origin.source].label} le ${formatImperialDate(origin.date)}`;
    case "sector":
      return `barème ${sectorShort(origin.sector)}`;
    case "default":
      return "barème tous secteurs";
  }
}

/** The wage and where it comes from, for a tooltip. */
export function describeWage(rate: WageRate): string {
  return `${formatInteger(rate.wage)} ¢ par salarié payé et par jour (${wageOriginLabel(rate.origin)}, DG non payé)`;
}
