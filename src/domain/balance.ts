import { daysBetween } from "./dates.ts";
import type { IsoDate } from "./types.ts";

/**
 * What a corporation owns besides its till, as the operator records it: its premises in three
 * layers, the way they resell (the plot alone, the building with its plot, the fitted shop), and
 * its stock. The game prints none of it: a figure is declared by the direction, or audited by
 * the Agence (in roleplay, for an introduction for instance). Figures belong to one life.
 */

export type AssetSource = "declared" | "audited";
export const BALANCE_ITEMS = ["land", "building", "fittings", "stock"] as const;
export type BalanceItem = (typeof BALANCE_ITEMS)[number];

export interface BalanceSheet {
  id: string;
  /** The life the figures belong to. */
  companyId: string;
  date: IsoDate;
  /** Price of the plot (set by its location). Null: not given in this sheet. */
  land: number | null;
  /** Price of the building (its size, the agency's margin). */
  building: number | null;
  /** Decoration (design and laying), security, furniture. */
  fittings: number | null;
  /** Stock at purchase cost. */
  stock: number | null;
  source: AssetSource;
  note: string | null;
}

export const BALANCE_ITEM_INFO: Record<BalanceItem, { label: string; help: string }> = {
  land: {
    label: "Terrain",
    help: "Prix du terrain acheté à l'agence immobilière, selon l'emplacement. Il se revend seul.",
  },
  building: {
    label: "Bâtiment",
    help: "Construction par l'agence : taille en cases et marge de service. Il se revend avec son terrain.",
  },
  fittings: {
    label: "Aménagement",
    help: "Décoration (design et pose), sécurités, ameublement. Ils ne se revendent qu'avec la boutique installée.",
  },
  stock: {
    label: "Stock",
    help: "Marchandise au prix d'achat : la marge n'est pas encore gagnée. Connu de la seule direction.",
  },
};

export const SOURCE_INFO: Record<AssetSource, { label: string }> = {
  declared: { label: "déclaré par la direction" },
  audited: { label: "audité par l'Agence" },
};

export function isAssetSource(value: unknown): value is AssetSource {
  return value === "declared" || value === "audited";
}

/** The latest known figure of an item. */
export interface KnownFigure {
  amount: number;
  date: IsoDate;
  source: AssetSource;
}

/**
 * The latest figure of each item on or before `date`: a sheet that gives only the stock leaves
 * the premises as last known.
 */
export function figuresOn(
  sheets: readonly BalanceSheet[],
  date: IsoDate,
): Record<BalanceItem, KnownFigure | null> {
  const known: Record<BalanceItem, KnownFigure | null> = {
    land: null,
    building: null,
    fittings: null,
    stock: null,
  };
  for (const sheet of [...sheets].sort((a, b) => a.date.localeCompare(b.date))) {
    if (sheet.date > date) break;
    for (const item of BALANCE_ITEMS) {
      const amount = sheet[item];
      if (amount !== null) known[item] = { amount, date: sheet.date, source: sheet.source };
    }
  }
  return known;
}

/** Days since a figure was given. */
export function figureAge(figure: KnownFigure, date: IsoDate): number {
  return daysBetween(figure.date, date);
}
