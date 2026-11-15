import type { ConsortiumMembership, IsoDate } from "./types.ts";

/** A membership period as the operator types it, before it gets an id. */
export interface MembershipDraft {
  consortiumId: string;
  /** First day in the consortium; null: a member since before the history begins. */
  joinedOn: IsoDate | null;
  /** First day out of it; null: still a member. */
  leftOn: IsoDate | null;
}

/** Periods with an open start come first, then by joining date. */
function byStart(a: MembershipDraft, b: MembershipDraft): number {
  if (a.joinedOn === b.joinedOn) return 0;
  if (a.joinedOn === null) return -1;
  if (b.joinedOn === null) return 1;
  return a.joinedOn.localeCompare(b.joinedOn);
}

/**
 * Checks the membership periods of one page and puts them in order, in the operator's words.
 * A page belongs to one consortium at a time: periods may touch (leaving one consortium and
 * joining another the same day) but never overlap. Touching periods of the same consortium merge.
 */
export function cleanMemberships<T extends MembershipDraft>(
  periods: readonly T[],
  consortiumIds: ReadonlySet<string>,
): T[] {
  for (const p of periods) {
    if (!p.consortiumId) throw new Error("période sans consortium");
    if (!consortiumIds.has(p.consortiumId)) throw new Error("consortium introuvable");
    if (p.joinedOn !== null && p.leftOn !== null && p.leftOn <= p.joinedOn)
      throw new Error("la date de départ doit suivre la date d'entrée");
  }
  const sorted = [...periods].sort(byStart);
  const out: T[] = [];
  for (const p of sorted) {
    const last = out.at(-1);
    if (last) {
      const overlaps = last.leftOn === null || p.joinedOn === null || last.leftOn > p.joinedOn;
      if (overlaps)
        throw new Error(
          "deux périodes se chevauchent : une corporation n'appartient qu'à un consortium à la fois",
        );
      if (last.leftOn === p.joinedOn && last.consortiumId === p.consortiumId) {
        out[out.length - 1] = { ...last, leftOn: p.leftOn };
        continue;
      }
    }
    out.push(p);
  }
  return out;
}

/** The dates of a membership, whatever else it carries. */
export type Period = Pick<MembershipDraft, "joinedOn" | "leftOn">;

/** Whether a period covers `date`: from its joining day included to its leaving day excluded. */
export function covers(period: Period, date: IsoDate): boolean {
  return (
    (period.joinedOn === null || period.joinedOn <= date) &&
    (period.leftOn === null || date < period.leftOn)
  );
}

/** The membership of one page on `date`, if any. */
export function membershipOn<T extends Period>(periods: readonly T[], date: IsoDate): T | null {
  return periods.find((p) => covers(p, date)) ?? null;
}

/** Memberships grouped by page, each list in order. */
export function membershipsByProfile(
  memberships: readonly ConsortiumMembership[],
): Map<string, ConsortiumMembership[]> {
  const byProfile = new Map<string, ConsortiumMembership[]>();
  for (const m of memberships)
    byProfile.set(m.profileId, [...(byProfile.get(m.profileId) ?? []), m]);
  for (const list of byProfile.values()) list.sort(byStart);
  return byProfile;
}
