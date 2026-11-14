import type { ReportRow, RowFigures } from "./types.ts";

/** A line compared across two reports; `key` is the corporation, whatever its name that day. */
export interface DiffRow extends RowFigures {
  key: string;
  name: string;
}

export interface Outlier {
  name: string;
  field: "chiffre" | "capital";
  before: number;
  after: number;
  ratio: number;
  /** Why it looks wrong, in the operator's words. */
  reason: string;
}

export interface DiffContext {
  /** Days between the previous report and this one. */
  gap: number;
  /** Estimated days of activity of a corporation (by key) on the new report's date, when known. */
  ageOn: (key: string) => number | null;
}

export interface ReportDiff {
  outliers: Outlier[];
  /** Companies whose printed rank disagrees with the order of their chiffre. */
  rankMismatches: string[];
}

/**
 * Compares a report about to be published with the previous one, so the operator can catch a
 * typo or a bad paste before it reaches the public cote. Who is who (renames, refoundings) is
 * settled beforehand by `proposeIdentities`.
 */
export function diffReport(
  previous: readonly DiffRow[],
  next: readonly DiffRow[],
  context?: DiffContext,
): ReportDiff {
  const before = new Map(previous.map((r) => [r.key, r]));

  const outliers: Outlier[] = [];
  for (const row of next) {
    const old = before.get(row.key);
    if (!old) continue;
    if (old.chiffre > 0 && row.chiffre > 0) {
      const ratio = row.chiffre / old.chiffre - 1;
      const flag = (reason: string) =>
        outliers.push({
          name: row.name,
          field: "chiffre",
          before: old.chiffre,
          after: row.chiffre,
          ratio,
          reason,
        });
      const age = context?.ageOn(row.key) ?? null;
      const gap = context?.gap ?? 0;
      if (age !== null && gap > 0 && age - gap > 0) {
        // The published average implies the period's revenue; it can be neither negative nor absurd.
        const realDaily = (row.chiffre * age - old.chiffre * (age - gap)) / gap;
        const noise = age / gap;
        if (realDaily < -2 * noise) flag("impliquerait une recette négative : coquille probable");
        else if (realDaily > 50 * old.chiffre + noise)
          flag("impliquerait plus de 50 fois la recette moyenne par jour");
      } else if (old.chiffre >= 1_000 && Math.abs(ratio) > 0.25) {
        flag("variation inhabituelle");
      }
    }
    if (old.capital && row.capital !== null && old.capital >= 10_000) {
      const ratio = row.capital / old.capital - 1;
      if (Math.abs(ratio) > 0.6)
        outliers.push({
          name: row.name,
          field: "capital",
          before: old.capital,
          after: row.capital,
          ratio,
          reason: "capital très différent du relevé précédent",
        });
    }
  }

  const rankMismatches: string[] = [];
  const byRank = next.filter((r) => r.rank !== null).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  for (let i = 1; i < byRank.length; i++) {
    if (byRank[i].chiffre > byRank[i - 1].chiffre) rankMismatches.push(byRank[i].name);
  }

  return { outliers, rankMismatches };
}

/** Ranks rows by chiffre when the source printed none (manual form). */
export function assignRanks<T extends ReportRow>(rows: readonly T[]): T[] {
  return [...rows]
    .sort((a, b) => b.chiffre - a.chiffre || a.name.localeCompare(b.name, "fr"))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
