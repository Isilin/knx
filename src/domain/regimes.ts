import type { CompanyScores, CompanySeries, Market } from "./market.ts";

/**
 * Where a company stands on two estimated scores: activity (last 30 days against its lifetime
 * average) and dynamics (last 30 days against the 90 before).
 */
export type Regime = "essor" | "essoufflement" | "reprise" | "declin";

export const REGIMES: readonly { id: Regime; label: string; help: string }[] = [
  {
    id: "essor",
    label: "En essor",
    help: "Au-dessus de leur moyenne historique, et en accélération.",
  },
  {
    id: "essoufflement",
    label: "En essoufflement",
    help: "Encore au-dessus de leur moyenne, mais en ralentissement.",
  },
  {
    id: "reprise",
    label: "En reprise",
    help: "Sous leur moyenne historique, mais en accélération.",
  },
  {
    id: "declin",
    label: "En déclin",
    help: "Sous leur moyenne historique, et en ralentissement.",
  },
];

export function regimeOf(scores: CompanyScores): Regime | null {
  const { activity, dynamics } = scores;
  if (activity === null || dynamics === null) return null;
  if (activity >= 0) return dynamics >= 0 ? "essor" : "essoufflement";
  return dynamics >= 0 ? "reprise" : "declin";
}

export interface RegimeGroup {
  id: Regime;
  label: string;
  help: string;
  /** Heaviest first. */
  companies: CompanySeries[];
}

/** Listed companies sorted into regimes, plus those the scores cannot place yet. */
export function groupByRegime(market: Market): {
  groups: RegimeGroup[];
  unplaced: CompanySeries[];
} {
  const listed = market.companies.filter((c) => c.status === "active");
  const byWeight = [...listed].sort((a, b) => (b.scores.weight ?? 0) - (a.scores.weight ?? 0));
  const groups = REGIMES.map((r) => ({
    ...r,
    companies: byWeight.filter((c) => regimeOf(c.scores) === r.id),
  }));
  return { groups, unplaced: byWeight.filter((c) => regimeOf(c.scores) === null) };
}

export type MapTile =
  | { kind: "company"; company: CompanySeries; weight: number }
  | { kind: "others"; companies: CompanySeries[]; weight: number };

/**
 * Tiles of the market map: one per company that earned something over the last 30 days, sized by
 * its share of the market's revenue. Companies under `minWeight` fold into a single « others »
 * tile, too small to read on their own.
 */
export function marketMap(
  market: Market,
  minWeight = 0.005,
): { tiles: MapTile[]; silent: CompanySeries[] } {
  const active = market.companies.filter((c) => c.status === "active");
  const earning = active
    .filter((c) => (c.scores.weight ?? 0) > 0)
    .sort((a, b) => (b.scores.weight ?? 0) - (a.scores.weight ?? 0));
  const tiles: MapTile[] = [];
  const tail: CompanySeries[] = [];
  for (const company of earning) {
    const weight = company.scores.weight ?? 0;
    if (weight >= minWeight) tiles.push({ kind: "company", company, weight });
    else tail.push(company);
  }
  if (tail.length > 0) {
    const weight = tail.reduce((sum, c) => sum + (c.scores.weight ?? 0), 0);
    tiles.push({ kind: "others", companies: tail, weight });
  }
  return { tiles, silent: active.filter((c) => !((c.scores.weight ?? 0) > 0)) };
}

export interface Rect<T> {
  x: number;
  y: number;
  w: number;
  h: number;
  item: T;
}

/**
 * Squarified treemap (Bruls, Huizing, van Wijk): lays the values out in rows along the shorter
 * side, adding an item to a row only while it makes the row's worst aspect ratio better. Areas are
 * proportional to the values; items keep the order given (pass them heaviest first).
 */
export function squarify<T>(
  items: readonly T[],
  value: (item: T) => number,
  width: number,
  height: number,
): Rect<T>[] {
  const total = items.reduce((sum, item) => sum + Math.max(0, value(item)), 0);
  if (total <= 0 || width <= 0 || height <= 0) return [];
  const scale = (width * height) / total;
  const queue = items
    .map((item) => ({ item, area: Math.max(0, value(item)) * scale }))
    .filter((entry) => entry.area > 0);

  const worst = (row: { area: number }[], side: number) => {
    const sum = row.reduce((s, r) => s + r.area, 0);
    const max = Math.max(...row.map((r) => r.area));
    const min = Math.min(...row.map((r) => r.area));
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
  };

  const out: Rect<T>[] = [];
  let x = 0;
  let y = 0;
  let w = width;
  let h = height;
  let start = 0;
  while (start < queue.length) {
    const side = Math.min(w, h);
    let end = start + 1;
    while (
      end < queue.length &&
      worst(queue.slice(start, end + 1), side) <= worst(queue.slice(start, end), side)
    ) {
      end++;
    }
    const row = queue.slice(start, end);
    const rowArea = row.reduce((s, r) => s + r.area, 0);
    if (w >= h) {
      // A column along the left edge.
      const colWidth = rowArea / h;
      let cy = y;
      for (const r of row) {
        const rh = r.area / colWidth;
        out.push({ x, y: cy, w: colWidth, h: rh, item: r.item });
        cy += rh;
      }
      x += colWidth;
      w -= colWidth;
    } else {
      // A row along the top edge.
      const rowHeight = rowArea / w;
      let cx = x;
      for (const r of row) {
        const rw = r.area / rowHeight;
        out.push({ x: cx, y, w: rw, h: rowHeight, item: r.item });
        cx += rw;
      }
      y += rowHeight;
      h -= rowHeight;
    }
    start = end;
  }
  return out;
}
