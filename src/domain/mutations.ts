import { EMPTY_INPUTS, isDistrict, type CompanyRating, type District } from "./rating.ts";
import { cleanMemberships } from "./memberships.ts";
import { isSectorId, type SectorId } from "./sectors.ts";
import {
  CONSORTIUM_COLORS,
  type CompanyEvent,
  type CompanyMeta,
  type CompanyProfile,
  type Consortium,
  type ConsortiumColor,
  type ConsortiumMembership,
  type Dataset,
  type EventDetails,
  type EventKind,
  type IsoDate,
  type MarketEvent,
  type PublishRequest,
} from "./types.ts";
import { MAX_EVENT_SPAN } from "./marketEvents.ts";
import { checkOperations, isOperationKind, type SecurityOperation } from "./securities.ts";
import {
  checkParams,
  cleanParams,
  VALUATION_METHOD,
  type ValuationParams,
  type ValuationSettings,
} from "./valuation.ts";

/**
 * Fields of a corporation's page the operator edits by hand: shared by all its lives. Its
 * consortiums are dated and set apart (`setMemberships`).
 */
export interface ProfilePatch {
  sector?: SectorId | null;
  district?: District | null;
  hidden?: boolean;
}

/** Fields of one life the operator edits by hand. */
export interface CompanyPatch {
  creationOverride?: IsoDate | null;
}

/**
 * A page patch as logged before memberships were dated: the consortium was a plain field, a
 * member since always.
 */
type LegacyProfilePatch = ProfilePatch & { consortiumId?: string | null };

/** A life patch as logged before pages existed: page fields went with it. */
type LegacyCompanyPatch = CompanyPatch & LegacyProfilePatch;

/** A rating about to be published: frozen as computed, never edited afterwards. */
export type RatingDraft = Omit<CompanyRating, "id">;

export interface ConsortiumDraft {
  /** null creates a consortium. */
  id: string | null;
  name: string;
  color: ConsortiumColor;
}

export interface EventDraft {
  /** null records a new event. */
  id: string | null;
  companyId: string;
  date: IsoDate;
  kind: EventKind;
  details: EventDetails;
  note: string | null;
}

export interface MarketEventDraft {
  /** null records a new event. */
  id: string | null;
  date: IsoDate;
  label: string | null;
  title: string;
  description: string | null;
  span: number;
}

/** Settings of the theoretical value about to be published; a published version is never edited. */
export interface ValuationSettingsDraft {
  date: IsoDate;
  params: ValuationParams;
  note: string | null;
}

/** An operation on securities about to be recorded. */
export type SecurityOperationDraft = Omit<SecurityOperation, "id"> & {
  /** null records a new operation. */
  id: string | null;
};

/** Checks settings before they are published and trims the note. */
export function cleanSettings(draft: ValuationSettingsDraft): ValuationSettingsDraft {
  checkParams(draft.params);
  return { ...draft, note: draft.note?.trim() || null };
}

/**
 * Checks an operation against the corporation's life and the operations already recorded, in
 * the operator's words, and returns it trimmed: only the fields its kind uses.
 */
export function planOperation<T extends SecurityOperationDraft>(dataset: Dataset, draft: T): T {
  const company = requireCompany(dataset, draft.companyId);
  const reported = dataset.snapshots
    .filter((s) => s.rows.some((r) => r.companyId === draft.companyId))
    .map((s) => s.date)
    .sort();
  if (reported.length === 0) throw new Error("aucun relevé de cette corporation");
  if (draft.date < reported[0])
    throw new Error(`date antérieure au premier relevé de la corporation (${reported[0]})`);
  if (company.closedOn !== null && draft.date >= company.closedOn)
    throw new Error("la corporation est fermée à cette date");
  const operation = {
    ...draft,
    shares: draft.kind === "introduction" ? draft.shares : null,
    ratio: draft.kind === "split" || draft.kind === "reverse_split" ? draft.ratio : null,
    note: draft.note?.trim() || null,
  };
  const others = (dataset.securityOperations ?? []).filter(
    (o) => o.companyId === draft.companyId && o.id !== draft.id,
  );
  checkOperations([...others, { ...operation, id: operation.id ?? "nouvelle" }]);
  return operation;
}

/** Trims a market event and checks it, in the operator's words. */
export function cleanMarketEvent<T extends MarketEventDraft | MarketEvent>(event: T): T {
  const title = event.title.trim();
  const label = event.label?.trim() || null;
  const description = event.description?.trim() || null;
  if (title === "") throw new Error("titre d'évènement vide");
  if (label !== null && label.length > 24) throw new Error("étiquette de plus de 24 caractères");
  if (!Number.isInteger(event.span) || event.span < 1 || event.span > MAX_EVENT_SPAN)
    throw new Error(`durée entre 1 et ${MAX_EVENT_SPAN} jours`);
  return { ...event, title, label, description };
}

/**
 * A change made in local mode. Operations are kept as a log and replayed over the imported
 * history at every load, so a regenerated history still shows them. They follow the same rules
 * as the Supabase functions.
 */
export type LocalOp =
  | { type: "publish"; request: PublishRequest; newIds: string[] }
  | { type: "withdraw"; date: IsoDate }
  | { type: "updateCompany"; id: string; patch: LegacyCompanyPatch }
  | { type: "updateProfile"; id: string; patch: LegacyProfilePatch }
  /** Replaces every consortium membership of a page. */
  | { type: "setMemberships"; profileId: string; memberships: ConsortiumMembership[] }
  /** Logged before pages existed: `id` is a life, the logo goes to its page. */
  | { type: "setLogo"; id: string; url: string | null }
  | { type: "setProfileLogo"; id: string; url: string | null }
  | { type: "saveConsortium"; consortium: Consortium }
  | { type: "deleteConsortium"; id: string }
  | { type: "saveEvent"; event: CompanyEvent }
  | { type: "deleteEvent"; id: string }
  | { type: "saveMarketEvent"; event: MarketEvent }
  | { type: "deleteMarketEvent"; id: string }
  | { type: "saveRating"; rating: CompanyRating }
  | { type: "deleteRating"; id: string }
  | { type: "publishValuation"; settings: ValuationSettings }
  | { type: "saveOperation"; operation: SecurityOperation }
  | { type: "deleteOperation"; id: string };

const blank = (id: string, name: string, profileId: string): CompanyMeta => ({
  id,
  profileId,
  name,
  formerNames: [],
  creationOverride: null,
  closedOn: null,
});

const blankProfile = (id: string): CompanyProfile => ({
  id,
  sector: null,
  logoUrl: null,
  district: null,
  hidden: false,
});

/** A page as an older base serves it: the consortium as a plain field, not dated. */
type RawProfile = Partial<CompanyProfile> & { id: string; consortiumId?: string | null };

/** A life as an older base serves it: page fields on the life itself. */
type RawCompany = Partial<CompanyMeta> & Omit<RawProfile, "id"> & { id: string; name: string };

/** Drops the pages left without any life, and their memberships. */
function withoutEmptyProfiles(
  dataset: Pick<Dataset, "profiles" | "memberships">,
  companies: readonly CompanyMeta[],
): Pick<Dataset, "profiles" | "memberships"> {
  const used = new Set(companies.map((c) => c.profileId));
  return {
    profiles: dataset.profiles.filter((p) => used.has(p.id)),
    memberships: dataset.memberships.filter((m) => used.has(m.profileId)),
  };
}

/** A legacy undated consortium: a member since before the history begins, still a member. */
const sinceAlways = (profileId: string, consortiumId: string): ConsortiumMembership => ({
  id: `legacy-${profileId}`,
  profileId,
  consortiumId,
  joinedOn: null,
  leftOn: null,
});

/** A page carries at most one open life. */
function checkOneOpenLife(companies: readonly CompanyMeta[]): void {
  const open = new Map<string, string>();
  for (const c of companies) {
    if (c.closedOn !== null) continue;
    const other = open.get(c.profileId);
    if (other !== undefined)
      throw new Error(`« ${other} » et « ${c.name} » seraient deux vies ouvertes de la même fiche`);
    open.set(c.profileId, c.name);
  }
}

/**
 * Checks the shape of a dataset and fills optional fields. A Supabase base still on the first
 * schema serves rows by name: say so plainly instead of drawing an empty cote.
 */
export function normalizeDataset(raw: unknown): Dataset {
  const data = raw as Partial<Dataset> & { snapshots?: { rows?: object[] }[] };
  const firstRow = data.snapshots?.find((s) => (s.rows?.length ?? 0) > 0)?.rows?.[0];
  if (
    !Array.isArray(data.companies) ||
    !Array.isArray(data.snapshots) ||
    (firstRow && !("companyId" in firstRow)) ||
    data.companies.some((c) => typeof c.id !== "string")
  ) {
    throw new Error(
      "Les données ne sont pas au format attendu. Sur Supabase, exécuter la migration 20261114000000_fiche_identite_historique.sql.",
    );
  }
  // Before memberships were dated, a page carried its consortium as a plain field.
  const legacyConsortium = new Map<string, string>();
  const cleanProfile = (p: RawProfile): CompanyProfile => {
    if (p.consortiumId) legacyConsortium.set(p.id, p.consortiumId);
    return {
      ...blankProfile(p.id),
      sector: isSectorId(p.sector) ? p.sector : null,
      logoUrl: p.logoUrl ?? null,
      district: isDistrict(p.district) ? p.district : null,
      hidden: p.hidden === true,
    };
  };
  // A base served before pages existed (or a life without its page) gets one page per life,
  // carrying the page fields it served on the life.
  const profiles = new Map(
    (Array.isArray(data.profiles) ? (data.profiles as RawProfile[]) : []).map((p) => [
      p.id,
      cleanProfile(p),
    ]),
  );
  const companies = (data.companies as RawCompany[]).map((c) => {
    let profileId = typeof c.profileId === "string" ? c.profileId : null;
    if (profileId === null || !profiles.has(profileId)) {
      profileId ??= c.id;
      profiles.set(profileId, cleanProfile({ ...c, id: profileId }));
    }
    return {
      ...blank(c.id, c.name, profileId),
      formerNames: c.formerNames ?? [],
      creationOverride: c.creationOverride ?? null,
      closedOn: c.closedOn ?? null,
    };
  });
  const consortiums = (data.consortiums ?? []).filter((k) =>
    (CONSORTIUM_COLORS as readonly string[]).includes(k.color),
  );
  const known = new Set(consortiums.map((k) => k.id));
  // A base that dates memberships serves them; an older one, the consortium of each page.
  const memberships: ConsortiumMembership[] = Array.isArray(data.memberships)
    ? data.memberships.map((m) => ({
        ...m,
        joinedOn: m.joinedOn ?? null,
        leftOn: m.leftOn ?? null,
      }))
    : [...legacyConsortium].map(([profileId, consortiumId]) =>
        sinceAlways(profileId, consortiumId),
      );
  return {
    generatedAt: data.generatedAt ?? new Date().toISOString(),
    profiles: [...profiles.values()],
    companies,
    consortiums,
    memberships: memberships.filter((m) => known.has(m.consortiumId) && profiles.has(m.profileId)),
    events: (data.events ?? []).map((e) => ({
      ...e,
      details: e.details ?? {},
      note: e.note ?? null,
    })),
    ratings: (data.ratings ?? []).map((r) => ({
      ...r,
      score: Number(r.score),
      inputs: { ...EMPTY_INPUTS, ...r.inputs },
      district: isDistrict(r.district) ? r.district : null,
      rationale: r.rationale ?? null,
    })),
    marketEvents: (data.marketEvents ?? []).map((e) => ({
      ...e,
      label: e.label ?? null,
      description: e.description ?? null,
      span: Number.isInteger(e.span) && e.span > 0 ? e.span : 1,
    })),
    snapshots: data.snapshots,
    valuationSettings: (Array.isArray(data.valuationSettings) ? data.valuationSettings : []).map(
      (v): ValuationSettings => ({
        id: String(v.id),
        date: v.date,
        method: v.method ?? VALUATION_METHOD,
        params: cleanParams(v.params),
        note: v.note ?? null,
      }),
    ),
    securityOperations: (Array.isArray(data.securityOperations) ? data.securityOperations : [])
      .filter((o) => isOperationKind(o.kind))
      .map((o): SecurityOperation => ({
        id: String(o.id),
        companyId: String(o.companyId),
        date: o.date,
        kind: o.kind,
        shares: o.shares == null ? null : Number(o.shares),
        ratio: o.ratio == null ? null : Number(o.ratio),
        note: o.note ?? null,
      })),
  };
}

function applyPublish(
  dataset: Dataset,
  request: PublishRequest,
  newIds: readonly string[],
): Dataset {
  const { date } = request;
  let snapshots = dataset.snapshots;
  let companies = dataset.companies;
  let { profiles, memberships } = dataset;
  const events = [...dataset.events];

  if (snapshots.some((s) => s.date === date)) {
    if (!request.replace) throw new Error(`un relevé existe déjà pour le ${date}`);
    // Undo the replaced report: its rows, the corporations it created, its closures.
    snapshots = snapshots.filter((s) => s.date !== date);
    const withRows = new Set(snapshots.flatMap((s) => s.rows.map((r) => r.companyId)));
    const withEvents = new Set(events.map((e) => e.companyId));
    companies = companies
      .filter((c) => withRows.has(c.id) || withEvents.has(c.id))
      .map((c) => (c.closedOn === date ? { ...c, closedOn: null } : c));
    ({ profiles, memberships } = withoutEmptyProfiles({ profiles, memberships }, companies));
  }

  const closures = new Set(request.closures);
  const byId = new Map(companies.map((c) => [c.id, c]));
  for (const row of request.rows) {
    if (row.companyId === null) continue;
    const company = byId.get(row.companyId);
    if (
      !company ||
      (company.closedOn !== null && company.closedOn <= date) ||
      closures.has(company.id)
    )
      throw new Error(`corporation inconnue ou fermée pour « ${row.name} »`);
  }

  companies = companies.map((c) =>
    closures.has(c.id) && c.closedOn === null ? { ...c, closedOn: date } : c,
  );

  const newNames = new Map(
    request.rows.flatMap((r) => (r.companyId === null ? [] : [[r.companyId, r.name] as const])),
  );
  companies = companies.map((c) => {
    const name = newNames.get(c.id);
    if (name === undefined || name === c.name || c.closedOn !== null) return c;
    events.push({
      id: `auto-renamed-${date}-${c.id}`,
      companyId: c.id,
      date,
      kind: "renamed",
      details: { from: c.name, to: name },
      note: null,
      origin: "auto",
    });
    return { ...c, name, formerNames: [...c.formerNames, c.name] };
  });

  let created = 0;
  const rowIds = request.rows.map((row) => {
    if (row.companyId !== null) return row.companyId;
    if (companies.some((c) => c.name === row.name && c.closedOn === null))
      throw new Error(`une corporation ouverte porte déjà le nom « ${row.name} »`);
    const id = newIds[created++];
    if (!id) throw new Error("identifiant manquant pour une nouvelle corporation");
    let profileId = row.profileId ?? null;
    if (profileId === null) {
      // A new page: it takes the id of its first life.
      profileId = id;
      profiles = [...profiles, blankProfile(profileId)];
    } else if (!profiles.some((p) => p.id === profileId)) {
      throw new Error(`fiche introuvable pour « ${row.name} »`);
    }
    companies = [...companies, blank(id, row.name, profileId)];
    return id;
  });
  checkOneOpenLife(companies);

  return {
    ...dataset,
    profiles,
    memberships,
    companies,
    events,
    snapshots: [
      ...snapshots,
      {
        date,
        source: request.source,
        rows: request.rows.map(({ rank, chiffre, capital, employees }, i) => ({
          companyId: rowIds[i],
          rank,
          chiffre,
          capital,
          employees,
        })),
      },
    ],
  };
}

/** What withdrawing a published report undoes. */
export interface Withdrawal {
  date: IsoDate;
  /** Lines of the report, removed with it. */
  rows: number;
  /** Corporations that appeared with this report (no other line, no event): removed. */
  created: string[];
  /** Renames this report recorded: each corporation takes back its former name. */
  renamed: CompanyEvent[];
  /** Corporations this report closed: reopened. */
  reopened: string[];
}

/**
 * Plans the withdrawal of a published report. Only the latest one can go: nothing has followed
 * its closures and renames, so undoing them rewrites no later history. Same rules as the
 * Supabase function withdraw_snapshot.
 */
export function planWithdrawal(dataset: Dataset, date: IsoDate): Withdrawal {
  const snapshot = dataset.snapshots.find((s) => s.date === date);
  if (!snapshot) throw new Error(`aucun relevé publié le ${date}`);
  if (dataset.snapshots.some((s) => s.date > date))
    throw new Error("seul le dernier relevé publié peut être retiré");

  const elsewhere = new Set(
    dataset.snapshots.filter((s) => s.date !== date).flatMap((s) => s.rows.map((r) => r.companyId)),
  );
  const withEvents = new Set(dataset.events.map((e) => e.companyId));
  return {
    date,
    rows: snapshot.rows.length,
    created: snapshot.rows
      .map((r) => r.companyId)
      .filter((id) => !elsewhere.has(id) && !withEvents.has(id)),
    renamed: dataset.events.filter(
      (e) =>
        e.date === date && e.kind === "renamed" && e.origin === "auto" && e.details.from != null,
    ),
    reopened: dataset.companies.filter((c) => c.closedOn === date).map((c) => c.id),
  };
}

function applyWithdraw(dataset: Dataset, date: IsoDate): Dataset {
  const plan = planWithdrawal(dataset, date);
  const created = new Set(plan.created);
  const formerName = new Map(plan.renamed.map((e) => [e.companyId, e.details.from ?? ""]));
  const undone = new Set(plan.renamed.map((e) => e.id));

  const companies = dataset.companies
    .filter((c) => !created.has(c.id))
    .map((c) => {
      let next = c;
      const from = formerName.get(c.id);
      if (from !== undefined)
        next = {
          ...next,
          name: from,
          formerNames:
            next.formerNames.at(-1) === from ? next.formerNames.slice(0, -1) : next.formerNames,
        };
      return next.closedOn === date ? { ...next, closedOn: null } : next;
    });

  const open = new Set<string>();
  for (const c of companies) {
    if (c.closedOn !== null) continue;
    if (open.has(c.name))
      throw new Error(`deux corporations ouvertes porteraient le nom « ${c.name} »`);
    open.add(c.name);
  }
  checkOneOpenLife(companies);

  return {
    ...dataset,
    ...withoutEmptyProfiles(dataset, companies),
    companies,
    events: dataset.events.filter((e) => !undone.has(e.id)),
    snapshots: dataset.snapshots.filter((s) => s.date !== date),
  };
}

function requireCompany(dataset: Dataset, id: string): CompanyMeta {
  const company = dataset.companies.find((c) => c.id === id);
  if (!company) throw new Error("corporation introuvable");
  return company;
}

/** Replaces every consortium membership of a page, after checking them. */
function setMemberships(
  dataset: Dataset,
  profileId: string,
  periods: readonly ConsortiumMembership[],
): Dataset {
  if (!dataset.profiles.some((p) => p.id === profileId)) throw new Error("fiche introuvable");
  const clean = cleanMemberships(
    periods.map((m) => ({ ...m, profileId })),
    new Set(dataset.consortiums.map((k) => k.id)),
  );
  return {
    ...dataset,
    memberships: [...dataset.memberships.filter((m) => m.profileId !== profileId), ...clean],
  };
}

function updateProfile(dataset: Dataset, id: string, patch: LegacyProfilePatch): Dataset {
  if (!dataset.profiles.some((p) => p.id === id)) throw new Error("fiche introuvable");
  const fields: ProfilePatch = {};
  if (patch.sector !== undefined) fields.sector = patch.sector;
  if (patch.district !== undefined) fields.district = patch.district;
  if (patch.hidden !== undefined) fields.hidden = patch.hidden;
  const next: Dataset = {
    ...dataset,
    profiles: dataset.profiles.map((p) => (p.id === id ? { ...p, ...fields } : p)),
  };
  // Logged before memberships were dated: the consortium, a member since always.
  if (patch.consortiumId === undefined) return next;
  return setMemberships(next, id, patch.consortiumId ? [sinceAlways(id, patch.consortiumId)] : []);
}

function setProfileLogo(dataset: Dataset, id: string, url: string | null): Dataset {
  if (!dataset.profiles.some((p) => p.id === id)) throw new Error("fiche introuvable");
  return {
    ...dataset,
    profiles: dataset.profiles.map((p) => (p.id === id ? { ...p, logoUrl: url } : p)),
  };
}

/** Applies one local operation; throws in the operator's words when it breaks a rule. */
export function applyOp(dataset: Dataset, op: LocalOp): Dataset {
  switch (op.type) {
    case "publish":
      return applyPublish(dataset, op.request, op.newIds);
    case "withdraw":
      return applyWithdraw(dataset, op.date);
    case "updateCompany": {
      const company = requireCompany(dataset, op.id);
      const { creationOverride, ...profilePatch } = op.patch;
      // Page fields logged with a life before pages existed go to its page.
      let next = updateProfile(dataset, company.profileId, profilePatch);
      if (creationOverride !== undefined)
        next = {
          ...next,
          companies: next.companies.map((c) => (c.id === op.id ? { ...c, creationOverride } : c)),
        };
      return next;
    }
    case "updateProfile":
      return updateProfile(dataset, op.id, op.patch);
    case "setMemberships":
      return setMemberships(dataset, op.profileId, op.memberships);
    case "setLogo":
      return setProfileLogo(dataset, requireCompany(dataset, op.id).profileId, op.url);
    case "setProfileLogo":
      return setProfileLogo(dataset, op.id, op.url);
    case "saveConsortium": {
      const name = op.consortium.name.trim();
      if (name === "") throw new Error("nom de consortium vide");
      if (dataset.consortiums.some((k) => k.name === name && k.id !== op.consortium.id))
        throw new Error(`un consortium s'appelle déjà « ${name} »`);
      const consortium = { ...op.consortium, name };
      const exists = dataset.consortiums.some((k) => k.id === consortium.id);
      return {
        ...dataset,
        consortiums: exists
          ? dataset.consortiums.map((k) => (k.id === consortium.id ? consortium : k))
          : [...dataset.consortiums, consortium],
      };
    }
    case "deleteConsortium":
      return {
        ...dataset,
        consortiums: dataset.consortiums.filter((k) => k.id !== op.id),
        memberships: dataset.memberships.filter((m) => m.consortiumId !== op.id),
      };
    case "saveEvent": {
      requireCompany(dataset, op.event.companyId);
      const exists = dataset.events.some((e) => e.id === op.event.id);
      return {
        ...dataset,
        events: exists
          ? dataset.events.map((e) =>
              e.id === op.event.id ? { ...op.event, origin: e.origin } : e,
            )
          : [...dataset.events, op.event],
      };
    }
    case "deleteEvent":
      return { ...dataset, events: dataset.events.filter((e) => e.id !== op.id) };
    case "saveMarketEvent": {
      const event = cleanMarketEvent(op.event);
      const exists = dataset.marketEvents.some((e) => e.id === event.id);
      return {
        ...dataset,
        marketEvents: exists
          ? dataset.marketEvents.map((e) => (e.id === event.id ? event : e))
          : [...dataset.marketEvents, event],
      };
    }
    case "deleteMarketEvent":
      return {
        ...dataset,
        marketEvents: dataset.marketEvents.filter((e) => e.id !== op.id),
      };
    case "saveRating": {
      const { rating } = op;
      requireCompany(dataset, rating.companyId);
      if (!(rating.score >= 0 && rating.score <= 5)) throw new Error("score hors de l'échelle 0–5");
      if (dataset.ratings.some((r) => r.companyId === rating.companyId && r.date === rating.date))
        throw new Error("une notation existe déjà à cette date : retirez-la d'abord");
      return { ...dataset, ratings: [...dataset.ratings, rating] };
    }
    case "deleteRating":
      return { ...dataset, ratings: dataset.ratings.filter((r) => r.id !== op.id) };
    case "publishValuation": {
      const settings = { ...op.settings, ...cleanSettings(op.settings) };
      return {
        ...dataset,
        valuationSettings: [...(dataset.valuationSettings ?? []), settings],
      };
    }
    case "saveOperation": {
      const operation = planOperation(dataset, op.operation);
      const list = dataset.securityOperations ?? [];
      const exists = list.some((o) => o.id === operation.id);
      return {
        ...dataset,
        securityOperations: exists
          ? list.map((o) => (o.id === operation.id ? operation : o))
          : [...list, operation],
      };
    }
    case "deleteOperation":
      checkRemoval(dataset, op.id);
      return {
        ...dataset,
        securityOperations: (dataset.securityOperations ?? []).filter((o) => o.id !== op.id),
      };
  }
}

/**
 * Whether removing an operation leaves the others valid: a division cannot outlive the
 * introduction it applies to. Throws in the operator's words.
 */
export function checkRemoval(dataset: Dataset, id: string): void {
  const list = dataset.securityOperations ?? [];
  const removed = list.find((o) => o.id === id);
  if (!removed) return;
  checkOperations(list.filter((o) => o.companyId === removed.companyId && o.id !== id));
}
