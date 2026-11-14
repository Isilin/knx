import { normalizeDataset } from "./mutations.ts";
import type {
  CompanyMeta,
  CompanyProfile,
  Dataset,
  IsoDate,
  ReportRow,
  SnapshotSource,
} from "./types.ts";

/**
 * A life written with its page fields, the way tests read best. Without `profileId`, each life
 * gets a page of its own (id = the life's id); lives sharing a `profileId` share a page, whose
 * fields come from the first of them.
 */
export type TestCompany = Partial<CompanyMeta> &
  Partial<Omit<CompanyProfile, "id">> & { id: string; name: string };

/** Test helper: a dataset whose lives carry their page fields. */
export function testDataset(
  raw: Omit<Dataset, "profiles" | "companies" | "ratings"> & {
    companies: TestCompany[];
    profiles?: CompanyProfile[];
    ratings?: Dataset["ratings"];
  },
): Dataset {
  return normalizeDataset({ profiles: [], ratings: [], ...raw });
}

/** A dataset written by company name, the way tests read best. */
export interface NamedDataset {
  generatedAt: string;
  companies?: (Partial<TestCompany> & { name: string })[];
  snapshots: { date: IsoDate; source: SnapshotSource; rows: ReportRow[] }[];
}

/**
 * Test helper: turns a dataset written by name into the registry form, each company's id being
 * its name. Companies only seen in reports are added to the registry.
 */
export function datasetByName(named: NamedDataset): Dataset {
  const companies = new Map<string, TestCompany>();
  const add = (meta: Partial<TestCompany> & { name: string }) =>
    companies.set(meta.name, { id: meta.name, ...meta });
  for (const meta of named.companies ?? []) add(meta);
  for (const snapshot of named.snapshots)
    for (const row of snapshot.rows) if (!companies.has(row.name)) add({ name: row.name });
  return testDataset({
    generatedAt: named.generatedAt,
    companies: [...companies.values()],
    consortiums: [],
    events: [],
    marketEvents: [],
    ratings: [],
    snapshots: named.snapshots.map((s) => ({
      date: s.date,
      source: s.source,
      rows: s.rows.map(({ name, ...figures }) => ({ companyId: name, ...figures })),
    })),
  });
}
