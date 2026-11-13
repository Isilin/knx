import { fromDayNumber, toDayNumber } from "./dates.ts";
import type { IsoDate } from "./types.ts";

/** Dreadcast opened in 2007: no corporation can be older. */
export const GAME_OPENING: IsoDate = "2007-01-01";

export interface ChiffrePoint {
  date: IsoDate;
  chiffre: number;
}

export type AgeMethod = "manual" | "bounds" | "first-seen";

export interface CreationEstimate {
  /** Estimated creation date (day 1 of activity). */
  creation: IsoDate;
  method: AgeMethod;
  /** How many report pairs constrain the estimate within a week of it. */
  support: number;
  /** Days between the tightest constraint and the next distinct one; large = fragile estimate. */
  margin: number | null;
  /** Latest date the company can have been created, given the history (its first non-zero report). */
  latestPossible: IsoDate;
}

/**
 * Estimates when a corporation was created from its published `Chiffre` history.
 *
 * `Chiffre` is the lifetime average: cumulative revenue ÷ days of activity. Revenue is never
 * negative, so between two reports i < j with c_i > c_j the company's age at j obeys
 *   n_j ≤ c_i · (t_j − t_i) / (c_i − c_j)
 * (equality when nothing was earned in between). Each falling pair therefore caps the age; the
 * tightest cap, widened by one credit of rounding on each side, is the estimate: the oldest
 * creation date compatible with non-negative revenue everywhere. The historical sheet took the
 * median of these caps, which overstates ages.
 *
 * A report at 0 after activity means the company was reset; only the last life is used.
 */
export function estimateCreation(
  points: readonly ChiffrePoint[],
  manual?: IsoDate | null,
): CreationEstimate | null {
  const life = lastLife(points);
  if (life.length === 0) return null;
  // A published average needs at least one day of activity: day zero precedes the first report.
  const firstDay = toDayNumber(life[0].date) - 1;
  const latestPossible = fromDayNumber(firstDay);

  if (manual) {
    return { creation: manual, method: "manual", support: 0, margin: null, latestPossible };
  }

  const opening = toDayNumber(GAME_OPENING);
  const lowerBounds: number[] = [];
  for (let j = 1; j < life.length; j++) {
    const tj = toDayNumber(life[j].date);
    const cj = life[j].chiffre;
    // Each later report is checked against every earlier one; falling pairs constrain.
    for (let i = j - 1; i >= 0; i--) {
      const ci = life[i].chiffre;
      const drop = ci - cj - 1; // conservative: one credit of rounding on each value
      if (drop <= 0) continue;
      const gap = tj - toDayNumber(life[i].date);
      const maxAge = ((ci + 1) * gap) / drop;
      const bound = Math.ceil(tj - maxAge);
      if (bound >= opening && bound <= firstDay) lowerBounds.push(bound);
    }
  }

  if (lowerBounds.length === 0) {
    return {
      creation: latestPossible,
      method: "first-seen",
      support: 0,
      margin: null,
      latestPossible,
    };
  }

  lowerBounds.sort((a, b) => b - a);
  const best = lowerBounds[0];
  const support = lowerBounds.filter((b) => best - b <= 7).length;
  const next = lowerBounds.find((b) => b < best);
  return {
    creation: fromDayNumber(best),
    method: "bounds",
    support,
    margin: next === undefined ? null : best - next,
    latestPossible,
  };
}

/** Points after the last reset (a zero following activity), starting at the first non-zero value. */
export function lastLife(points: readonly ChiffrePoint[]): ChiffrePoint[] {
  let start = -1;
  let active = false;
  for (let k = 0; k < points.length; k++) {
    const value = points[k].chiffre;
    if (value > 0 && !active) {
      start = k;
      active = true;
    } else if (value === 0 && active) {
      active = false;
    }
  }
  if (start < 0 || !active) return [];
  return points.slice(start);
}

/** Days of activity on `date` (the divisor of `Chiffre`), with `creation` as day zero. */
export function activityDays(creation: IsoDate, date: IsoDate): number {
  return toDayNumber(date) - toDayNumber(creation);
}
