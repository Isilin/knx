import { daysBetween } from "./dates.ts";
import type {
  CompanyMeta,
  IsoDate,
  PublishRequest,
  ReportRow,
  RowFigures,
  Snapshot,
} from "./types.ts";

/** Lowercase, accents and punctuation removed: `Kessler Industries™` → `kesslerindustries`. */
export const foldName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Levenshtein distance. */
export function editDistance(a: string, b: string): number {
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
 * A corporation closed and a new one opened under the same name between two reports.
 *
 * `Chiffre` is a lifetime average: it never falls back to 0 while the company lives, so a 0 after
 * activity is a new company. A sharp fall together with a capital back to a starting amount is the
 * same story, caught a few days late (Paradox, 11 November 2026: 57 894 → 0, capital 785 352 → 3 340).
 */
export function isRefounding(before: RowFigures, after: RowFigures): boolean {
  if (before.chiffre <= 0) return false;
  if (after.chiffre === 0) return true;
  const capitalCollapsed =
    before.capital !== null &&
    after.capital !== null &&
    before.capital > 0 &&
    after.capital < before.capital * 0.1;
  return capitalCollapsed && after.chiffre < before.chiffre * 0.5;
}

export type Evidence = "name" | "chiffre" | "capital" | "employees";

export interface RenameProposal {
  /** The missing corporation that would take the new name. */
  companyId: string;
  from: string;
  to: string;
  evidence: Evidence[];
  /** Pre-checked in the preview: the figures carry on, not only the name. */
  suggested: boolean;
}

export interface RefoundingProposal {
  companyId: string;
  name: string;
  before: RowFigures;
  after: RowFigures;
}

export interface Namesake {
  name: string;
  /** The closed corporation that carried the name. */
  companyId: string;
  closedOn: IsoDate;
}

export interface IdentityProposals {
  /** Date of the report the new one is compared with. */
  previousDate: IsoDate | null;
  /** Report name → open corporation carrying that name. */
  matched: Map<string, string>;
  /** Names no open corporation carries. */
  newcomers: string[];
  /** Corporations of the previous report missing from this one. */
  missing: { companyId: string; name: string }[];
  renames: RenameProposal[];
  refoundings: RefoundingProposal[];
  /** Newcomers whose name belonged to a closed corporation: a new company, history from zero. */
  namesakes: Namesake[];
  /**
   * Closures, renames and refoundings only apply to the most recent report; an older day
   * published late only attaches its rows to the corporations open at the time.
   */
  latest: boolean;
}

export interface IdentityInput {
  companies: readonly CompanyMeta[];
  /** Every published report; one on `date` itself is about to be replaced. */
  snapshots: readonly Snapshot[];
  /** Corporations that have recorded events (they survive a replaced report). */
  withEvents?: ReadonlySet<string>;
  date: IsoDate;
  rows: readonly ReportRow[];
  /** Estimated days of activity of a corporation on `date`, when known. */
  ageOn?: (companyId: string) => number | null;
}

export interface IdentityDecisions {
  /** Company ids of accepted rename proposals. */
  renames: ReadonlySet<string>;
  /** Company ids of accepted refounding proposals. */
  refoundings: ReadonlySet<string>;
}

function evidenceFor(
  from: { name: string; row: RowFigures },
  to: ReportRow,
  gap: number,
  age: number | null,
): Evidence[] {
  const evidence: Evidence[] = [];
  const target = foldName(to.name);
  if (
    target.length > 0 &&
    editDistance(foldName(from.name), target) <= Math.max(2, Math.floor(target.length / 5))
  )
    evidence.push("name");

  const m = from.row;
  if (m.chiffre > 0 && to.chiffre > 0 && Math.abs(to.chiffre / m.chiffre - 1) <= 0.1) {
    let plausible = true;
    if (age !== null && gap > 0 && age - gap > 0) {
      // Same test as the outlier check: the period's implied revenue must stay possible.
      const realDaily = (to.chiffre * age - m.chiffre * (age - gap)) / gap;
      const noise = age / gap;
      plausible = realDaily >= -2 * noise && realDaily <= 50 * m.chiffre + noise;
    }
    if (plausible) evidence.push("chiffre");
  }
  if (
    m.capital !== null &&
    to.capital !== null &&
    m.capital > 0 &&
    Math.abs(to.capital / m.capital - 1) <= 0.3
  )
    evidence.push("capital");
  if (
    m.employees !== null &&
    to.employees !== null &&
    m.employees > 0 &&
    m.employees === to.employees
  )
    evidence.push("employees");
  return evidence;
}

const WEIGHT: Record<Evidence, number> = { name: 3, chiffre: 2, capital: 2, employees: 1 };

/**
 * Works out who is who in a report about to be published: corporations matched by name, missing
 * ones, likely renames (close name, or figures that carry on), refoundings (same name, figures
 * back to zero) and namesakes of closed corporations. The operator confirms in the preview.
 */
export function proposeIdentities(input: IdentityInput): IdentityProposals {
  const { date } = input;
  const replacing = input.snapshots.some((s) => s.date === date);
  const others = input.snapshots.filter((s) => s.date !== date);
  const previous =
    others.filter((s) => s.date < date).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  const latest = !others.some((s) => s.date > date);

  // A replaced report is undone first: its closures reopen, the companies it created vanish.
  const withRows = new Set(others.flatMap((s) => s.rows.map((r) => r.companyId)));
  const exists = (c: CompanyMeta) => withRows.has(c.id) || (input.withEvents?.has(c.id) ?? false);
  const isOpen = (c: CompanyMeta) =>
    c.closedOn === null || c.closedOn > date || (replacing && c.closedOn === date);

  const companies = new Map(input.companies.map((c) => [c.id, c]));
  const openByName = new Map<string, CompanyMeta>();
  for (const c of input.companies)
    if (exists(c) && isOpen(c) && !openByName.has(c.name)) openByName.set(c.name, c);

  const matched = new Map<string, string>();
  const newcomers: string[] = [];
  for (const row of input.rows) {
    const company = openByName.get(row.name);
    if (company) matched.set(row.name, company.id);
    else newcomers.push(row.name);
  }

  const before = new Map(previous?.rows.map((r) => [r.companyId, r]) ?? []);
  const matchedIds = new Set(matched.values());
  const missing = (previous?.rows ?? [])
    .filter((r) => !matchedIds.has(r.companyId))
    .flatMap((r) => {
      const company = companies.get(r.companyId);
      return company && isOpen(company) ? [{ companyId: company.id, name: company.name }] : [];
    });

  const refoundings: RefoundingProposal[] = [];
  const renames: RenameProposal[] = [];
  if (latest && previous) {
    for (const row of input.rows) {
      const id = matched.get(row.name);
      const old = id ? before.get(id) : undefined;
      if (id && old && isRefounding(old, row))
        refoundings.push({ companyId: id, name: row.name, before: old, after: row });
    }

    const gap = daysBetween(previous.date, date);
    const candidates: { proposal: RenameProposal; score: number }[] = [];
    for (const to of input.rows.filter((r) => !matched.has(r.name))) {
      for (const from of missing) {
        const row = before.get(from.companyId);
        if (!row) continue;
        const evidence = evidenceFor(
          { name: from.name, row },
          to,
          gap,
          input.ageOn?.(from.companyId) ?? null,
        );
        const has = (e: Evidence) => evidence.includes(e);
        if (!has("name") && !(has("chiffre") && has("capital"))) continue;
        candidates.push({
          proposal: {
            companyId: from.companyId,
            from: from.name,
            to: to.name,
            evidence,
            suggested:
              (has("chiffre") && has("capital")) ||
              (has("name") && (has("chiffre") || has("capital"))),
          },
          score: evidence.reduce((sum, e) => sum + WEIGHT[e], 0),
        });
      }
    }
    // One missing corporation per newcomer, strongest evidence first.
    const usedFrom = new Set<string>();
    const usedTo = new Set<string>();
    for (const { proposal } of candidates.sort((a, b) => b.score - a.score)) {
      if (usedFrom.has(proposal.companyId) || usedTo.has(proposal.to)) continue;
      usedFrom.add(proposal.companyId);
      usedTo.add(proposal.to);
      renames.push(proposal);
    }
  }

  const namesakes: Namesake[] = [];
  for (const name of newcomers) {
    const closed = input.companies
      .filter((c) => c.name === name && c.closedOn !== null && !isOpen(c))
      .sort((a, b) => (b.closedOn ?? "").localeCompare(a.closedOn ?? ""))[0];
    if (closed?.closedOn) namesakes.push({ name, companyId: closed.id, closedOn: closed.closedOn });
  }

  return {
    previousDate: previous?.date ?? null,
    matched,
    newcomers,
    missing,
    renames,
    refoundings,
    namesakes,
    latest,
  };
}

/** Default decisions: the pre-checked proposals. */
export function suggestedDecisions(proposals: IdentityProposals): IdentityDecisions {
  return {
    renames: new Set(proposals.renames.filter((r) => r.suggested).map((r) => r.companyId)),
    refoundings: new Set(proposals.refoundings.map((r) => r.companyId)),
  };
}

export type ResolvedRows = Pick<PublishRequest, "rows" | "closures">;

/** Applies the operator's decisions: each row gets its corporation, or none (a new one). */
export function resolveReport(
  rows: readonly ReportRow[],
  proposals: IdentityProposals,
  decisions: IdentityDecisions,
): ResolvedRows {
  const renamedTo = new Map(
    proposals.renames
      .filter((r) => decisions.renames.has(r.companyId))
      .map((r) => [r.to, r.companyId]),
  );
  const refounded = new Set(
    proposals.refoundings
      .filter((r) => decisions.refoundings.has(r.companyId))
      .map((r) => r.companyId),
  );
  const resolved = rows.map((row) => {
    const id = proposals.matched.get(row.name) ?? renamedTo.get(row.name) ?? null;
    return { ...row, companyId: id !== null && refounded.has(id) ? null : id };
  });
  const renamedFrom = new Set(renamedTo.values());
  const closures = proposals.latest
    ? [
        ...proposals.missing.map((m) => m.companyId).filter((id) => !renamedFrom.has(id)),
        ...refounded,
      ]
    : [];
  return { rows: resolved, closures };
}
