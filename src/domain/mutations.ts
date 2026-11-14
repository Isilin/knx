import { EMPTY_INPUTS, isDistrict, type CompanyRating, type District } from "./rating.ts";
import { isSectorId, type SectorId } from "./sectors.ts";
import {
  CONSORTIUM_COLORS,
  type CompanyEvent,
  type CompanyMeta,
  type CompanyProfile,
  type Consortium,
  type ConsortiumColor,
  type Dataset,
  type EventDetails,
  type EventKind,
  type IsoDate,
  type MarketEvent,
  type PublishRequest,
} from "./types.ts";
import { MAX_EVENT_SPAN } from "./marketEvents.ts";

/** Fields of a corporation's page the operator edits by hand: shared by all its lives. */
export interface ProfilePatch {
  consortiumId?: string | null;
  sector?: SectorId | null;
  district?: District | null;
  hidden?: boolean;
}

/** Fields of one life the operator edits by hand. */
export interface CompanyPatch {
  creationOverride?: IsoDate | null;
}

/** A life patch as logged before pages existed: page fields went with it. */
type LegacyCompanyPatch = CompanyPatch & ProfilePatch;

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
  | { type: "updateProfile"; id: string; patch: ProfilePatch }
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
  | { type: "deleteRating"; id: string };

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
  consortiumId: null,
  sector: null,
  logoUrl: null,
  district: null,
  hidden: false,
});

/** A life as an older base serves it: page fields on the life itself. */
type RawCompany = Partial<CompanyMeta> &
  Partial<Omit<CompanyProfile, "id">> & { id: string; name: string };

/** Drops the pages left without any life. */
function withoutEmptyProfiles(
  profiles: readonly CompanyProfile[],
  companies: readonly CompanyMeta[],
): CompanyProfile[] {
  const used = new Set(companies.map((c) => c.profileId));
  return profiles.filter((p) => used.has(p.id));
}

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
  const cleanProfile = (p: Partial<CompanyProfile> & { id: string }): CompanyProfile => ({
    ...blankProfile(p.id),
    consortiumId: p.consortiumId ?? null,
    sector: isSectorId(p.sector) ? p.sector : null,
    logoUrl: p.logoUrl ?? null,
    district: isDistrict(p.district) ? p.district : null,
    hidden: p.hidden === true,
  });
  // A base served before pages existed (or a life without its page) gets one page per life,
  // carrying the page fields it served on the life.
  const profiles = new Map(
    (Array.isArray(data.profiles) ? data.profiles : []).map((p) => [p.id, cleanProfile(p)]),
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
  return {
    generatedAt: data.generatedAt ?? new Date().toISOString(),
    profiles: [...profiles.values()],
    companies,
    consortiums: (data.consortiums ?? []).filter((k) =>
      (CONSORTIUM_COLORS as readonly string[]).includes(k.color),
    ),
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
  let profiles = dataset.profiles;
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
    profiles = withoutEmptyProfiles(profiles, companies);
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
    profiles: withoutEmptyProfiles(dataset.profiles, companies),
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

function updateProfile(dataset: Dataset, id: string, patch: ProfilePatch): Dataset {
  if (!dataset.profiles.some((p) => p.id === id)) throw new Error("fiche introuvable");
  const { consortiumId } = patch;
  if (consortiumId && !dataset.consortiums.some((k) => k.id === consortiumId))
    throw new Error("consortium introuvable");
  const fields: ProfilePatch = {};
  if (patch.consortiumId !== undefined) fields.consortiumId = patch.consortiumId;
  if (patch.sector !== undefined) fields.sector = patch.sector;
  if (patch.district !== undefined) fields.district = patch.district;
  if (patch.hidden !== undefined) fields.hidden = patch.hidden;
  return {
    ...dataset,
    profiles: dataset.profiles.map((p) => (p.id === id ? { ...p, ...fields } : p)),
  };
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
        profiles: dataset.profiles.map((p) =>
          p.consortiumId === op.id ? { ...p, consortiumId: null } : p,
        ),
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
  }
}
