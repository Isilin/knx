import { isSectorId, type SectorId } from "./sectors.ts";
import {
  CONSORTIUM_COLORS,
  type CompanyEvent,
  type CompanyMeta,
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

/** Fields of a corporation the operator edits by hand. */
export interface CompanyPatch {
  consortiumId?: string | null;
  sector?: SectorId | null;
  creationOverride?: IsoDate | null;
}

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
  | { type: "updateCompany"; id: string; patch: CompanyPatch }
  | { type: "setLogo"; id: string; url: string | null }
  | { type: "saveConsortium"; consortium: Consortium }
  | { type: "deleteConsortium"; id: string }
  | { type: "saveEvent"; event: CompanyEvent }
  | { type: "deleteEvent"; id: string }
  | { type: "saveMarketEvent"; event: MarketEvent }
  | { type: "deleteMarketEvent"; id: string };

const blank = (id: string, name: string): CompanyMeta => ({
  id,
  name,
  formerNames: [],
  consortiumId: null,
  sector: null,
  creationOverride: null,
  closedOn: null,
  logoUrl: null,
});

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
  return {
    generatedAt: data.generatedAt ?? new Date().toISOString(),
    companies: data.companies.map((c) => ({
      ...blank(c.id, c.name),
      formerNames: c.formerNames ?? [],
      consortiumId: c.consortiumId ?? null,
      sector: isSectorId(c.sector) ? c.sector : null,
      creationOverride: c.creationOverride ?? null,
      closedOn: c.closedOn ?? null,
      logoUrl: c.logoUrl ?? null,
    })),
    consortiums: (data.consortiums ?? []).filter((k) =>
      (CONSORTIUM_COLORS as readonly string[]).includes(k.color),
    ),
    events: (data.events ?? []).map((e) => ({
      ...e,
      details: e.details ?? {},
      note: e.note ?? null,
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
    companies = [...companies, blank(id, row.name)];
    return id;
  });

  return {
    ...dataset,
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

function requireCompany(dataset: Dataset, id: string): void {
  if (!dataset.companies.some((c) => c.id === id)) throw new Error("corporation introuvable");
}

/** Applies one local operation; throws in the operator's words when it breaks a rule. */
export function applyOp(dataset: Dataset, op: LocalOp): Dataset {
  switch (op.type) {
    case "publish":
      return applyPublish(dataset, op.request, op.newIds);
    case "updateCompany": {
      requireCompany(dataset, op.id);
      const { consortiumId } = op.patch;
      if (consortiumId && !dataset.consortiums.some((k) => k.id === consortiumId))
        throw new Error("consortium introuvable");
      return {
        ...dataset,
        companies: dataset.companies.map((c) => (c.id === op.id ? { ...c, ...op.patch } : c)),
      };
    }
    case "setLogo":
      requireCompany(dataset, op.id);
      return {
        ...dataset,
        companies: dataset.companies.map((c) => (c.id === op.id ? { ...c, logoUrl: op.url } : c)),
      };
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
        companies: dataset.companies.map((c) =>
          c.consortiumId === op.id ? { ...c, consortiumId: null } : c,
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
  }
}
