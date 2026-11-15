import type { ResolvedMembership } from "../domain/market.ts";
import { cleanMemberships, type MembershipDraft } from "../domain/memberships.ts";
import type { Consortium } from "../domain/types.ts";

/** One period as the form holds it: empty strings for open dates. */
export interface MembershipRow {
  key: string;
  consortiumId: string;
  joinedOn: string;
  leftOn: string;
}

export const newRow = (fields: Partial<MembershipRow> = {}): MembershipRow => ({
  key: crypto.randomUUID(),
  consortiumId: "",
  joinedOn: "",
  leftOn: "",
  ...fields,
});

export function toRows(memberships: readonly ResolvedMembership[]): MembershipRow[] {
  return memberships.map((m) =>
    newRow({ consortiumId: m.consortium.id, joinedOn: m.joinedOn ?? "", leftOn: m.leftOn ?? "" }),
  );
}

/** The periods typed in the form, checked and in order; or what is wrong, in the operator's words. */
export function checkRows(
  rows: readonly MembershipRow[],
  consortiums: readonly Consortium[],
): { drafts: MembershipDraft[]; error: null } | { drafts: null; error: string } {
  try {
    const drafts = cleanMemberships(
      rows.map((r) => ({
        consortiumId: r.consortiumId,
        joinedOn: r.joinedOn || null,
        leftOn: r.leftOn || null,
      })),
      new Set(consortiums.map((k) => k.id)),
    );
    return { drafts, error: null };
  } catch (e) {
    return { drafts: null, error: e instanceof Error ? e.message : String(e) };
  }
}
