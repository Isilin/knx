/** ISO calendar date, `YYYY-MM-DD`, always interpreted in UTC. */
export type IsoDate = string;

export type SnapshotSource = "sheet" | "form" | "paste" | "userscript";

/** One line of an in-game « Corporations » report, as published. */
export interface SnapshotRow {
  /** Exact company name as written in the game, character for character. */
  name: string;
  /** Rank printed in the report, when known (the historical sheet has none). */
  rank: number | null;
  /** Published `Chiffre`: lifetime average daily revenue, in imperial credits. */
  chiffre: number;
  /** Published `Capital`, in imperial credits, when it was recorded. */
  capital: number | null;
  /** Published `Employés`, when it was recorded. */
  employees: number | null;
}

/** A daily report as taken from the game on a given date. */
export interface Snapshot {
  date: IsoDate;
  source: SnapshotSource;
  rows: SnapshotRow[];
}

export interface CompanyMeta {
  name: string;
  /** Former names that must resolve to this company. */
  aliases?: string[];
  group?: string | null;
  sector?: string | null;
  /** Creation date typed by hand by the operator; wins over the estimate. */
  creationOverride?: IsoDate | null;
}

export interface Dataset {
  generatedAt: string;
  companies: CompanyMeta[];
  snapshots: Snapshot[];
}
