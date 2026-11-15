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
 * A period during which a corporation's page belonged to a consortium. A corporation can leave
 * its consortium and join another: every figure read by consortium over time reads the membership
 * of that date, never the current one. A page belongs to one consortium at a time.
 */
export interface ConsortiumMembership {
  id: string;
  profileId: string;
  consortiumId: string;
  /** First day in the consortium; null: a member since before the history begins. */
  joinedOn: IsoDate | null;
  /** First day out of it; null: still a member. */
  leftOn: IsoDate | null;
}

/**
 * A corporation's page: what stays across its lives. A corporation destroyed then refounded under
 * the same name is, in the game, a new company (its age and lifetime average restart), but for
 * the city it is the same house: one page, one logo, one history. Its consortiums are dated
 * apart (`ConsortiumMembership`).
 */
export interface CompanyProfile {
  id: string;
  sector: SectorId | null;
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

/**
 * One life of a corporation, as the game counts it: from its founding to its closure. Its identity
 * is `id`, never its name: a corporation can be renamed, and a closed life never reopens. A
 * refounding opens a new life on the same page (`profileId`); every game figure (age, lifetime
 * average, real revenue) is computed per life.
 */
export interface CompanyMeta {
  id: string;
  /** The page this life belongs to. A page has at most one open life. */
  profileId: string;
  name: string;
  /** Former names within this life, oldest first. */
  formerNames: string[];
  /** Creation date typed by hand by the operator; wins over the estimate. */
  creationOverride: IsoDate | null;
  /** Date of the first report the corporation was missing from (closure is final). */
  closedOn: IsoDate | null;
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
  profiles: CompanyProfile[];
  companies: CompanyMeta[];
  consortiums: Consortium[];
  /** Dated consortium memberships of the pages, oldest first within a page. */
  memberships: ConsortiumMembership[];
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
  /**
   * `companyId` null opens a new life: on the page `profileId` (a refounding, a namesake linked to
   * a closed corporation), or on a new page when that is null too. A known id with another name
   * renames it.
   */
  rows: (ReportRow & { companyId: string | null; profileId?: string | null })[];
  /** Corporations closed on this date: missing from the report, or replaced by a namesake. */
  closures: string[];
  /** Replace an existing report for the same date. */
  replace: boolean;
}
