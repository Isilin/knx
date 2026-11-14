import { toDayNumber } from "./dates.ts";
import type { CompanyPoint } from "./market.ts";

/** Cumulative revenue at or before `day`, with the matching report day. */
function cumulativeAt(
  points: readonly CompanyPoint[],
  day: number,
): { value: number; day: number } | null {
  for (let k = points.length - 1; k >= 0; k--) {
    const p = points[k];
    if (toDayNumber(p.date) <= day && p.cumulative !== null)
      return { value: p.cumulative, day: toDayNumber(p.date) };
  }
  return null;
}

/**
 * Real revenue per day between `fromDay` and `toDay` (both snapped to available reports), or
 * null when the reports found span less than a week. Estimated.
 */
export function rateBetween(
  points: readonly CompanyPoint[],
  fromDay: number,
  toDay: number,
): number | null {
  const end = cumulativeAt(points, toDay);
  // When the window opens before the history, start at the first report inside it.
  let start = cumulativeAt(points, fromDay);
  if (!start) {
    const first = points.find((p) => p.cumulative !== null && toDayNumber(p.date) > fromDay);
    if (first?.cumulative != null)
      start = { value: first.cumulative, day: toDayNumber(first.date) };
  }
  if (!end || !start || end.day - start.day < 7) return null;
  return (end.value - start.value) / (end.day - start.day);
}
