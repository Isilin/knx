import type { SnapshotRow } from "./types.ts";

export interface RenameCandidate {
  from: string;
  to: string;
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
  /** Estimated days of activity on the new report's date, when known. */
  ageOn: (name: string) => number | null;
}

export interface ReportDiff {
  newcomers: string[];
  missing: string[];
  renames: RenameCandidate[];
  outliers: Outlier[];
  /** Companies whose printed rank disagrees with the order of their chiffre. */
  rankMismatches: string[];
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

function distance(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/**
 * Compares a report about to be published with the previous one, so the operator can catch a
 * typo, a rename or a bad paste before it reaches the public cote.
 */
export function diffReport(
  previous: readonly SnapshotRow[],
  next: readonly SnapshotRow[],
  context?: DiffContext,
): ReportDiff {
  const before = new Map(previous.map((r) => [r.name, r]));
  const after = new Map(next.map((r) => [r.name, r]));
  const newcomers = next.filter((r) => !before.has(r.name)).map((r) => r.name);
  const missing = previous.filter((r) => !after.has(r.name)).map((r) => r.name);

  const renames: RenameCandidate[] = [];
  for (const to of newcomers) {
    const target = fold(to);
    let best: { from: string; d: number } | null = null;
    for (const from of missing) {
      const d = distance(fold(from), target);
      if (d <= Math.max(2, Math.floor(target.length / 5)) && (!best || d < best.d))
        best = { from, d };
    }
    if (best) renames.push({ from: best.from, to });
  }

  const outliers: Outlier[] = [];
  for (const row of next) {
    const old = before.get(row.name);
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
      const age = context?.ageOn(row.name) ?? null;
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

  return { newcomers, missing, renames, outliers, rankMismatches };
}

/** Ranks rows by chiffre when the source printed none (manual form). */
export function assignRanks(rows: readonly SnapshotRow[]): SnapshotRow[] {
  return [...rows]
    .sort((a, b) => b.chiffre - a.chiffre || a.name.localeCompare(b.name, "fr"))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
