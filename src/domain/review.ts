import type { CreationEstimate } from "./age.ts";
import { daysBetween } from "./dates.ts";
import { diffReport, type DiffRow, type ReportDiff } from "./diff.ts";
import {
  proposeIdentities,
  resolveReport,
  type IdentityDecisions,
  type IdentityProposals,
  type RefoundingProposal,
  type RenameProposal,
  type ResolvedRows,
} from "./identity.ts";
import type { Dataset, IsoDate, ReportRow, Snapshot } from "./types.ts";

/** What the operator sees before publishing a report, whatever its source. */
export interface ReportReview {
  /** Latest published report before `date`; null for the very first one. */
  previous: Snapshot | null;
  /** Who is who: renames, refoundings, closures and namesakes to confirm. */
  proposals: IdentityProposals;
  /** The report as it will be published, with the operator's choices applied. */
  resolved: ResolvedRows;
  /** Names of the rows that will create a corporation. */
  created: string[];
  /** Names of the corporations this report closes. */
  closed: string[];
  diff: ReportDiff | null;
  /** Mean relative change of chiffre against `previous`, over corporations present in both. */
  averageChange: number;
}

/** The operator's answers to the identity proposals; a missing key keeps the suggestion. */
export type IdentityChoices = Readonly<Record<string, boolean>>;

export const renameKey = (r: RenameProposal) => `rename:${r.companyId}:${r.to}`;
export const refoundKey = (r: RefoundingProposal) => `refound:${r.companyId}`;

/** Latest report strictly before `date`. */
export function previousSnapshot(snapshots: readonly Snapshot[], date: IsoDate): Snapshot | null {
  let best: Snapshot | null = null;
  for (const s of snapshots) if (s.date < date && (!best || s.date > best.date)) best = s;
  return best;
}

export function averageChange(previous: readonly DiffRow[], next: readonly DiffRow[]): number {
  const before = new Map(previous.map((r) => [r.key, r.chiffre]));
  const ratios = next.flatMap((r) => {
    const old = before.get(r.key);
    return old && old > 0 && r.chiffre > 0 ? [r.chiffre / old - 1] : [];
  });
  return ratios.length === 0 ? 0 : ratios.reduce((a, b) => a + b, 0) / ratios.length;
}

/**
 * Settles who is who in `rows`, about to be published for `date`, then compares the figures with
 * the previous published report, corporation by corporation (a renamed one keeps its line).
 * `creationOf` gives a corporation's estimated creation date, so the check can tell a real move
 * from a typo; return null when the estimate is unknown or unreliable.
 */
export function reviewReport(
  dataset: Pick<Dataset, "companies" | "snapshots" | "events">,
  creationOf: (companyId: string) => IsoDate | null,
  date: IsoDate,
  rows: readonly ReportRow[],
  choices: IdentityChoices = {},
): ReportReview {
  const ageOn = (id: string) => {
    const creation = creationOf(id);
    return creation ? daysBetween(creation, date) : null;
  };
  const proposals = proposeIdentities({
    companies: dataset.companies,
    snapshots: dataset.snapshots,
    withEvents: new Set(dataset.events.map((e) => e.companyId)),
    date,
    rows,
    ageOn,
  });
  const decisions: IdentityDecisions = {
    renames: new Set(
      proposals.renames.filter((r) => choices[renameKey(r)] ?? r.suggested).map((r) => r.companyId),
    ),
    refoundings: new Set(
      proposals.refoundings.filter((r) => choices[refoundKey(r)] ?? true).map((r) => r.companyId),
    ),
  };
  const resolved = resolveReport(rows, proposals, decisions);
  const names = new Map(dataset.companies.map((c) => [c.id, c.name]));
  const created = resolved.rows.filter((r) => r.companyId === null).map((r) => r.name);
  const closed = resolved.closures.map((id) => names.get(id) ?? id);

  const previous = previousSnapshot(dataset.snapshots, date);
  if (!previous || rows.length === 0)
    return { previous, proposals, resolved, created, closed, diff: null, averageChange: 0 };
  const before: DiffRow[] = previous.rows.map((r) => ({
    ...r,
    key: r.companyId,
    name: names.get(r.companyId) ?? r.companyId,
  }));
  const after: DiffRow[] = resolved.rows.map((r) => ({
    ...r,
    key: r.companyId ?? `new:${r.name}`,
  }));
  return {
    previous,
    proposals,
    resolved,
    created,
    closed,
    diff: diffReport(before, after, { gap: daysBetween(previous.date, date), ageOn }),
    averageChange: averageChange(before, after),
  };
}

/**
 * Creation dates usable by the outlier check, by corporation: an estimate seeded only by the
 * first report (`first-seen`) says nothing about the real age, so it is left out.
 */
export function creationLookup(
  companies: readonly { id: string; creation: CreationEstimate | null }[],
): (companyId: string) => IsoDate | null {
  const creations = new Map(
    companies.map((c) => [
      c.id,
      c.creation && c.creation.method !== "first-seen" ? c.creation.creation : null,
    ]),
  );
  return (id) => creations.get(id) ?? null;
}
