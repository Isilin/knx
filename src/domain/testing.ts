import type { CompanyMeta, Dataset, IsoDate, ReportRow, SnapshotSource } from "./types.ts";

/** A dataset written by company name, the way tests read best. */
export interface NamedDataset {
  generatedAt: string;
  companies?: (Partial<CompanyMeta> & { name: string })[];
  snapshots: { date: IsoDate; source: SnapshotSource; rows: ReportRow[] }[];
}

/**
 * Test helper: turns a dataset written by name into the registry form, each company's id being
 * its name. Companies only seen in reports are added to the registry.
 */
export function datasetByName(named: NamedDataset): Dataset {
  const companies = new Map<string, CompanyMeta>();
  const add = (meta: Partial<CompanyMeta> & { name: string }) =>
    companies.set(meta.name, {
      id: meta.name,
      formerNames: [],
      consortiumId: null,
      sector: null,
      creationOverride: null,
      closedOn: null,
      logoUrl: null,
      ...meta,
    });
  for (const meta of named.companies ?? []) add(meta);
  for (const snapshot of named.snapshots)
    for (const row of snapshot.rows) if (!companies.has(row.name)) add({ name: row.name });
  return {
    generatedAt: named.generatedAt,
    companies: [...companies.values()],
    consortiums: [],
    events: [],
    snapshots: named.snapshots.map((s) => ({
      date: s.date,
      source: s.source,
      rows: s.rows.map(({ name, ...figures }) => ({ companyId: name, ...figures })),
    })),
  };
}
