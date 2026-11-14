/**
 * Recovers the columns removed from the historical sheet. When a corporation was destroyed, its
 * column was deleted: its reports only survive in the sheet's version history. Comparing each
 * version with the next one finds the columns that went (or were deleted and re-created under
 * the same name, empty), and their last state holds the whole history of that corporation.
 */
import type { IsoDate, ReportRow } from "../src/domain/types.ts";

/** One export of the sheet, values only. Metrics read as date → company name → value. */
export interface SheetData {
  /** Company columns of the daily revenue sheet, in order. */
  columns: string[];
  chiffre: Map<IsoDate, Map<string, number>>;
  capital: Map<IsoDate, Map<string, number>>;
  employees: Map<IsoDate, Map<string, number>>;
  /** Hand-typed creation dates, by company name. */
  overrides: Map<string, IsoDate>;
}

/** A past version of the sheet; `stamp` sorts in time (`2025-03-04T10-30`). */
export interface SheetVersion {
  stamp: string;
  data: SheetData;
}

export interface TrackCell {
  chiffre: number;
  capital: number | null;
  employees: number | null;
}

/** One column of the sheet, as one corporation's reports. */
export interface Track {
  name: string;
  /** `current`, or the stamp of the last version that held the column. */
  source: string;
  /** Read from a past version: the column is gone from the current sheet. */
  archived: boolean;
  /** Reports of the corporation, by date. */
  cells: Map<IsoDate, TrackCell>;
  /** Hand-typed creation date of this column. */
  creation: IsoDate | null;
  /** Archived: stamp of the first version without the column, or with it emptied. */
  removedIn?: string;
  /** Archived: the column was deleted, or deleted and re-created empty under the same name. */
  reason?: "removed" | "replaced";
}

const CURRENT = "current";

/**
 * The reports of one column. The sheet writes 0 both for a company listed at 0 and for one that
 * does not exist yet (Metropolis before its creation). A cell counts when the company published a
 * figure, when its capital or staff were recorded that day, when it never published anything but
 * 0 (Advenio: listed at 0 throughout), or when the zero comes after its first positive figure or
 * its hand-typed creation date: only leading zeros are left out. A removed column also loses its
 * trailing zeros: it was deleted because the corporation was gone.
 */
export function columnTrack(data: SheetData, name: string, source: string = CURRENT): Track {
  const archived = source !== CURRENT;
  const raw: (TrackCell & { date: IsoDate })[] = [];
  for (const date of [...data.chiffre.keys()].sort()) {
    const chiffre = data.chiffre.get(date)?.get(name);
    if (chiffre === undefined) continue;
    raw.push({
      date,
      chiffre,
      capital: data.capital.get(date)?.get(name) ?? null,
      employees: data.employees.get(date)?.get(name) ?? null,
    });
  }
  const recorded = (c: TrackCell) => c.capital !== null || c.employees !== null;
  const firstPositive = raw.find((c) => c.chiffre > 0)?.date;
  const creation = data.overrides.get(name) ?? null;
  let present = raw.filter(
    (c) =>
      c.chiffre > 0 ||
      recorded(c) ||
      firstPositive === undefined ||
      c.date >= firstPositive ||
      (creation !== null && c.date >= creation),
  );
  if (archived) {
    let end = present.length;
    while (end > 0 && present[end - 1].chiffre === 0 && !recorded(present[end - 1])) end--;
    // A column of zeros only is kept as it is, like Advenio.
    if (end > 0) present = present.slice(0, end);
  }
  return {
    name,
    source,
    archived,
    cells: new Map(present.map(({ date, ...cell }) => [date, cell])),
    creation,
  };
}

/**
 * The next version deleted a column and re-created it under the same name: most of the figures
 * the column held are gone or different. Dates the next version lacks altogether say nothing.
 * One or two changed figures are a correction (a report typed in the wrong row, fixed later),
 * not a new column.
 */
function replaced(before: SheetData, after: SheetData, name: string): boolean {
  let held = 0;
  let lost = 0;
  for (const [date, values] of before.chiffre) {
    const value = values.get(name);
    if (value === undefined || value <= 0 || !after.chiffre.has(date)) continue;
    held++;
    if (after.chiffre.get(date)?.get(name) !== value) lost++;
  }
  return lost >= 3 && lost * 2 > held;
}

/** Columns removed between consecutive versions, ending with the current sheet. */
export function removedColumns(versions: readonly SheetVersion[], current: SheetData): Track[] {
  const chain = [...versions].sort((a, b) => a.stamp.localeCompare(b.stamp));
  chain.push({ stamp: CURRENT, data: current });
  const removed: Track[] = [];
  for (let i = 0; i + 1 < chain.length; i++) {
    const before = chain[i];
    const after = chain[i + 1];
    const kept = new Set(after.data.columns);
    for (const name of before.data.columns) {
      const reason = !kept.has(name)
        ? "removed"
        : replaced(before.data, after.data, name)
          ? "replaced"
          : null;
      if (reason === null) continue;
      removed.push({
        ...columnTrack(before.data, name, before.stamp),
        removedIn: after.stamp,
        reason,
      });
    }
  }
  return removed;
}

/** A removed column whose figures live on under another name: the column was renamed. */
export interface RenamedColumn {
  from: string;
  to: string;
  removedIn: string;
  /** Last report of the column under its former name. */
  lastDate: IsoDate;
}

/**
 * Drops removed columns that only changed name: at least 80 % of their published figures are
 * found, same date and same value, in a column of another name that outlived them (a current
 * column, or one removed later). A corporation renamed then destroyed keeps its history under
 * its last name.
 */
export function withoutRenamedColumns(
  removed: readonly Track[],
  others: readonly Track[],
): { tracks: Track[]; renamed: RenamedColumn[] } {
  const tracks: Track[] = [];
  const renamed: RenamedColumn[] = [];
  for (const track of removed) {
    const positive = [...track.cells].filter(([, c]) => c.chiffre > 0);
    const outlives = (other: Track) => !other.archived || other.source > track.source;
    const match =
      positive.length === 0
        ? undefined
        : [...others, ...removed].find((other) => {
            if (other === track || other.name === track.name || !outlives(other)) return false;
            const same = positive.filter(
              ([date, c]) => other.cells.get(date)?.chiffre === c.chiffre,
            ).length;
            return same >= positive.length * 0.8;
          });
    if (match)
      renamed.push({
        from: track.name,
        to: match.name,
        removedIn: track.removedIn ?? "",
        lastDate: positive[positive.length - 1][0],
      });
    else tracks.push(track);
  }
  return { tracks, renamed };
}

/**
 * Former names, oldest first, by the name the corporation carries in the end: renames chain
 * (Hypercore → Kessler Distribution™ → NeuroCore Systems). `lastDate` is the last report under
 * the oldest name, to find the life the names belong to.
 */
export function formerNamesOf(
  renamed: readonly RenamedColumn[],
): Map<string, { names: string[]; lastDate: IsoDate }> {
  const next = new Map<string, RenamedColumn>();
  for (const r of [...renamed].sort((a, b) => a.removedIn.localeCompare(b.removedIn)))
    if (!next.has(r.from)) next.set(r.from, r);
  const out = new Map<string, { names: string[]; lastDate: IsoDate }>();
  for (const start of next.values()) {
    if ([...next.values()].some((r) => r.to === start.from)) continue; // not the oldest name
    const names = [start.from];
    let hop = start;
    while (next.has(hop.to) && !names.includes(hop.to)) {
      names.push(hop.to);
      hop = next.get(hop.to)!;
    }
    const final = out.get(hop.to) ?? { names: [], lastDate: start.lastDate };
    for (const name of names)
      if (name !== hop.to && !final.names.includes(name)) final.names.push(name);
    out.set(hop.to, final);
  }
  return out;
}

/** Two columns of the same name both report a date with different figures. */
export interface Collision {
  name: string;
  date: IsoDate;
  /** Source of the figures kept, and of those dropped. */
  kept: string;
  dropped: string;
}

export type MergedRow = ReportRow & {
  /** Read from a removed column only. */
  archived: boolean;
};

/**
 * Lays the columns out as reports, date by date. When two columns of the same name report the
 * same date, the current sheet wins, then the most recent version; differing figures are
 * reported.
 */
export function mergeTracks(tracks: readonly Track[]): {
  rows: Map<IsoDate, MergedRow[]>;
  collisions: Collision[];
  /** Reports each column brought in. */
  used: Map<Track, number>;
} {
  // Stable: the current columns keep the sheet's order, which numbers the corporations.
  const priority = [...tracks].sort(
    (a, b) => Number(a.archived) - Number(b.archived) || b.source.localeCompare(a.source),
  );
  const taken = new Map<string, { source: string; cell: TrackCell }>();
  const collisions: Collision[] = [];
  const rows = new Map<IsoDate, MergedRow[]>();
  const used = new Map<Track, number>();
  for (const track of priority) {
    used.set(track, 0);
    for (const [date, cell] of track.cells) {
      const key = `${date}\u0000${track.name}`;
      const first = taken.get(key);
      if (first) {
        if (first.cell.chiffre !== cell.chiffre)
          collisions.push({ name: track.name, date, kept: first.source, dropped: track.source });
        continue;
      }
      taken.set(key, { source: track.source, cell });
      used.set(track, (used.get(track) ?? 0) + 1);
      const list = rows.get(date) ?? [];
      list.push({ name: track.name, rank: null, ...cell, archived: track.archived });
      rows.set(date, list);
    }
  }
  return { rows, collisions, used };
}

/** Hand-typed creation dates of every column, deduplicated by name and date. */
export function typedCreations(tracks: readonly Track[]): { name: string; date: IsoDate }[] {
  const seen = new Set<string>();
  const out: { name: string; date: IsoDate }[] = [];
  for (const track of tracks) {
    if (track.creation === null) continue;
    const key = `${track.name}\u0000${track.creation}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: track.name, date: track.creation });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}
