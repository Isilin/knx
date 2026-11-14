import type { CreationEstimate } from "./age.ts";
import { daysBetween } from "./dates.ts";
import { diffReport, type ReportDiff } from "./diff.ts";
import type { IsoDate, Snapshot, SnapshotRow } from "./types.ts";

/** What the operator sees before publishing a report, whatever its source. */
export interface ReportReview {
  /** Latest published report before `date`; null for the very first one. */
  previous: Snapshot | null;
  diff: ReportDiff | null;
  /** Mean relative change of chiffre against `previous`, over companies present in both. */
  averageChange: number;
}

/** Latest report strictly before `date`. */
export function previousSnapshot(snapshots: readonly Snapshot[], date: IsoDate): Snapshot | null {
  let best: Snapshot | null = null;
  for (const s of snapshots) if (s.date < date && (!best || s.date > best.date)) best = s;
  return best;
}

export function averageChange(
  previous: readonly SnapshotRow[],
  next: readonly SnapshotRow[],
): number {
  const before = new Map(previous.map((r) => [r.name, r.chiffre]));
  const ratios = next.flatMap((r) => {
    const old = before.get(r.name);
    return old && old > 0 && r.chiffre > 0 ? [r.chiffre / old - 1] : [];
  });
  return ratios.length === 0 ? 0 : ratios.reduce((a, b) => a + b, 0) / ratios.length;
}

/**
 * Compares `rows`, about to be published for `date`, with the previous published report.
 * `creationOf` gives a company's estimated creation date, so the check can tell a real move from a
 * typo; return null when the estimate is unknown or unreliable.
 */
export function reviewReport(
  snapshots: readonly Snapshot[],
  creationOf: (name: string) => IsoDate | null,
  date: IsoDate,
  rows: readonly SnapshotRow[],
): ReportReview {
  const previous = previousSnapshot(snapshots, date);
  if (!previous || rows.length === 0) return { previous, diff: null, averageChange: 0 };
  const diff = diffReport(previous.rows, rows, {
    gap: daysBetween(previous.date, date),
    ageOn: (name) => {
      const creation = creationOf(name);
      return creation ? daysBetween(creation, date) : null;
    },
  });
  return { previous, diff, averageChange: averageChange(previous.rows, rows) };
}

/**
 * Creation dates usable by the outlier check: an estimate seeded only by the first report
 * (`first-seen`) says nothing about the real age, so it is left out.
 */
export function creationLookup(
  companies: readonly { name: string; creation: CreationEstimate | null }[],
): (name: string) => IsoDate | null {
  const creations = new Map(
    companies.map((c) => [
      c.name,
      c.creation && c.creation.method !== "first-seen" ? c.creation.creation : null,
    ]),
  );
  return (name) => creations.get(name) ?? null;
}
