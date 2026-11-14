import type { CompanyRating, District } from "./rating.ts";
import type { SectorId } from "./sectors.ts";

/** ISO calendar date, `YYYY-MM-DD`, always interpreted in UTC. */
export type IsoDate = string;

export type SnapshotSource = "sheet" | "form" | "paste" | "userscript";

/** Figures printed for one corporation in a report. */
export interface RowFigures {
  /** Rank printed in the report, when known (the historical sheet has none). */
  rank: number | null;
  /** Published `Chiffre`: lifetime average daily revenue, in imperial credits. */
  chiffre: number;
  /** Published `Capital`, in imperial credits, when it was recorded. */
  capital: number | null;
  /** Published `Employés`, when it was recorded. */
  employees: number | null;
}

/** One line of an in-game « Corporations » report as read: the company is known by its name. */
export interface ReportRow extends RowFigures {
  /** Exact company name as written in the game, character for character. */
  name: string;
}

/** A published line, attached to a corporation of the registry. */
export interface SnapshotRow extends RowFigures {
  companyId: string;
}

/** A daily report as taken from the game on a given date. */
export interface Snapshot {
  date: IsoDate;
  source: SnapshotSource;
  rows: SnapshotRow[];
}

export const CONSORTIUM_COLORS = ["cyan", "magenta", "ambre", "bleu"] as const;
export type ConsortiumColor = (typeof CONSORTIUM_COLORS)[number];

/** A group of corporations managed by the operator (Armacham, Sovereign…). */
export interface Consortium {
  id: string;
  name: string;
  color: ConsortiumColor;
}

/**
 * A corporation of the registry. Its identity is `id`, never its name: a corporation can be
 * renamed, and a closed one never reopens, so a later company may carry the same name.
 */
export interface CompanyMeta {
  id: string;
  name: string;
  /** Former names, oldest first. */
  formerNames: string[];
  consortiumId: string | null;
  sector: SectorId | null;
  /** Creation date typed by hand by the operator; wins over the estimate. */
  creationOverride: IsoDate | null;
  /** Date of the first report the corporation was missing from (closure is final). */
  closedOn: IsoDate | null;
  logoUrl: string | null;
  /** Centre-Ville, Basse-Ville or Haute-Ville; the Agence's « Localisation » criterion. */
  district: District | null;
  /**
   * Kept out of every KNX display (cote, charts, counts, shares). Its lines are still read and
   * published with the reports: the game prints it, so the registry must keep recognising it.
   * For a game-master company (MJ Immo) that is not a real player business.
   */
  hidden: boolean;
}

export type EventKind = "renamed" | "ceo_change" | "closed" | "other";

/** Kind-specific fields of an event. */
export interface EventDetails {
  /** `renamed`: former name. */
  from?: string;
  /** `renamed`: new name. */
  to?: string;
  /** `ceo_change`: the new chief executive. */
  person?: string;
  /** `other`: what happened, in a few words. */
  title?: string;
}

/** A dated event of a corporation's history, recorded by KNX or typed by the operator. */
export interface CompanyEvent {
  id: string;
  companyId: string;
  date: IsoDate;
  kind: EventKind;
  details: EventDetails;
  note: string | null;
  origin: "manual" | "auto";
}

/**
 * A dated fact of the whole market (a game rule, a breach): shown in the history of every
 * corporation listed that day and on the charts.
 */
export interface MarketEvent {
  id: string;
  date: IsoDate;
  /** Short label for the charts (`ZD-385`); the title when null. */
  label: string | null;
  title: string;
  description: string | null;
  /** Days, from `date`, over which its effects are read: flows in that span are tied to it. */
  span: number;
}

export interface Dataset {
  generatedAt: string;
  companies: CompanyMeta[];
  consortiums: Consortium[];
  events: CompanyEvent[];
  marketEvents: MarketEvent[];
  /** Ratings published by the Agence impériale de notation. */
  ratings: CompanyRating[];
  snapshots: Snapshot[];
}

/** A report ready to publish: each row resolved to a corporation, or to a new one. */
export interface PublishRequest {
  date: IsoDate;
  source: SnapshotSource;
  /** `companyId` null creates a corporation; a known id with another name renames it. */
  rows: (ReportRow & { companyId: string | null })[];
  /** Corporations closed on this date: missing from the report, or replaced by a namesake. */
  closures: string[];
  /** Replace an existing report for the same date. */
  replace: boolean;
}
