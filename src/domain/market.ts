import { watchRating, type RatingWatch } from "./agency.ts";
import { activityDays, estimateCreation, type CreationEstimate } from "./age.ts";
import { daysBetween, toDayNumber } from "./dates.ts";
import { membershipOn, membershipsByProfile } from "./memberships.ts";
import { projectMarket, type CompanyProjection, type Crossing } from "./projection.ts";
import type { CompanyRating, District } from "./rating.ts";
import { rateBetween } from "./revenue.ts";
import { assessRisk, type CompanyRisk } from "./risk.ts";
import { summarizeSectors, type SectorSummary } from "./sectorStats.ts";
import type { SectorId } from "./sectors.ts";
import { inOrder, type SecurityOperation } from "./securities.ts";
import {
  LifeValuation,
  settingsInForce,
  sortSettings,
  summarizeValuation,
  type CompanyValuation,
  type ValuationParams,
  type ValuationSettings,
} from "./valuation.ts";
import type {
  CompanyEvent,
  CompanyMeta,
  CompanyProfile,
  Consortium,
  Dataset,
  IsoDate,
  MarketEvent,
  Snapshot,
} from "./types.ts";

export interface CompanyPoint {
  date: IsoDate;
  rank: number;
  chiffre: number;
  capital: number | null;
  employees: number | null;
  /** Days of activity (divisor of `Chiffre`), from the creation estimate. */
  days: number | null;
  /** Cumulative revenue = chiffre × days. Estimated. */
  cumulative: number | null;
  /** Days since the previous report of this company. */
  gap: number | null;
  /** Average real revenue per day since the previous report. Estimated. */
  realDaily: number | null;
  /** ± rounding uncertainty on `realDaily` (the game rounds `Chiffre` to the credit). */
  realDailyNoise: number | null;
  /** realDaily ÷ previous chiffre − 1: how the period compares with the lifetime average. */
  performance: number | null;
  /**
   * Capital change since the previous report that revenue does not explain: Δcapital − revenue
   * earned. Negative = money left (wages, withdrawals, purchases); positive = money came in.
   * Estimated.
   */
  otherFlow: number | null;
  /** ± rounding uncertainty on `otherFlow`, inherited from the revenue estimate. */
  otherFlowNoise: number | null;
}

/**
 * `delisted`: closed, gone from the cote for good (a closed life never reopens; a refounding opens
 * a new life on the same page).
 */
export type CompanyStatus = "active" | "idle" | "delisted";

export interface CompanyScores {
  /** −1…1: revenue rate of the last 30 days against the 90 days before. */
  dynamics: number | null;
  /** −1…1: revenue rate of the last 30 days against the lifetime average. */
  activity: number | null;
  /** 0…1: share of the market's real revenue over the last 30 days. */
  weight: number | null;
  /** 0…1: share of its sector's real revenue over the last 30 days. */
  sectorWeight: number | null;
  /** −2…2: dynamics minus its sector's (positive: does better than its sector). */
  dynamicsVsSector: number | null;
  /** −2…2: activity minus its sector's. */
  activityVsSector: number | null;
}

/** Another page whose corporation carried the same name, before or after this one. */
export interface Namesake {
  slug: string;
  name: string;
  firstSeen: IsoDate;
  lastSeen: IsoDate;
  closedOn: IsoDate | null;
}

/** A period of a page in a consortium, the consortium resolved. */
export interface ResolvedMembership {
  consortium: Consortium;
  /** First day in it; null: since before the history begins. */
  joinedOn: IsoDate | null;
  /** First day out of it; null: still a member. */
  leftOn: IsoDate | null;
}

/** One life of a corporation and every figure KNX derives from it. */
export interface CompanySeries {
  /** The life. */
  id: string;
  /** The page it belongs to; every life of a page shares its slug, seal and page fields. */
  profileId: string;
  /** Rank of this life among the page's lives, from 1 (oldest), and their number. */
  life: { index: number; count: number };
  name: string;
  slug: string;
  /** Names the page carried before its current name, across all its lives, oldest first. */
  formerNames: string[];
  /** Consortium on the life's latest report: today's for a listed corporation. */
  consortium: Consortium | null;
  /** Every consortium period of the page, oldest first. */
  memberships: ResolvedMembership[];
  sector: SectorId | null;
  district: District | null;
  logoUrl: string | null;
  closedOn: IsoDate | null;
  /** Seed of the guilloché seal: stable across renames, distinct between namesakes. */
  sealSeed: string;
  namesakes: Namesake[];
  creation: CreationEstimate | null;
  points: CompanyPoint[];
  status: CompanyStatus;
  firstSeen: IsoDate;
  latest: CompanyPoint;
  previous: CompanyPoint | null;
  /** Rank change since the previous report (positive = climbed). */
  rankChange: number | null;
  /** Published chiffre change since the previous report, as a ratio. */
  chiffreChange: number | null;
  scores: CompanyScores;
  /** Real revenue per day over the last 30 days. Estimated. */
  recentRate: number | null;
  /** Real revenue per day over the 90 days before those 30. Estimated. */
  previousRate: number | null;
  /** Rank by revenue of the last 30 days among the listed corporations of its sector. */
  sectorRank: { rank: number; of: number } | null;
  /** Where the published chiffre heads if that rate holds; null when the estimate cannot say. */
  projection: CompanyProjection | null;
  /** KNX risk profile over the last five imperial years; null unless the company is active. */
  risk: CompanyRisk | null;
  /** Latest rating of the Agence impériale de notation, if any. */
  rating: CompanyRating | null;
  /** What changed since that rating; null when not rated. */
  watch: RatingWatch | null;
  /** KNX theoretical value and, once introduced, share price. */
  valuation: CompanyValuation | null;
  /** Best rank ever held, and the date it was first reached. */
  bestRank: { rank: number; date: IsoDate };
  /** Highest published chiffre and its date. */
  record: { chiffre: number; date: IsoDate };
}

export interface ReportFacts {
  date: IsoDate;
  previousDate: IsoDate | null;
  gap: number | null;
  listed: number;
  active: number;
  idle: number;
  newcomers: string[];
  delisted: string[];
  /** Pages whose life closed and a new one opened on this report. */
  refounded: string[];
}

export interface Market {
  dates: IsoDate[];
  latestDate: IsoDate;
  /** One corporation per page: its latest life. What the cote, the search and the counts list. */
  companies: CompanySeries[];
  /** Every life of every page, for totals over the whole history. */
  allLives: CompanySeries[];
  /** Lives of each page, by page id, oldest first. */
  lives: Map<string, CompanySeries[]>;
  consortiums: Consortium[];
  /** Each sector on the latest report, in the fixed order of the sector list. */
  sectors: Map<SectorId, SectorSummary>;
  facts: ReportFacts;
  /** Page slug → its latest life. */
  bySlug: Map<string, CompanySeries>;
  /** Every life, by id. */
  byId: Map<string, CompanySeries>;
  /** Slug of a former name, or of an earlier life's own page, → current slug: old links work. */
  slugAliases: Map<string, string>;
  /** Recorded events, by corporation id, oldest first. */
  events: Map<string, CompanyEvent[]>;
  /** Events of the whole market, oldest first. */
  marketEvents: MarketEvent[];
  /** Published ratings, by corporation id, oldest first. */
  ratings: Map<string, CompanyRating[]>;
  /** Horizon of the projections and the changes of order expected before it. */
  projection: { horizon: IsoDate; days: number; crossings: Crossing[] };
  /** Settings of the theoretical value in force, and every published version, oldest first. */
  valuation: { params: ValuationParams; versions: ValuationSettings[] };
  /** Operations on securities, by corporation id, in the order they apply. */
  operations: Map<string, SecurityOperation[]>;
}

const ARTICLES = new Set(["la", "le", "les", "las", "l", "the", "de"]);

/** `Kessler Industries™` → `kessler-industries`. */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Groups inferred from a shared leading brand word (Armacham, Sovereign, Donnellys…). Only used
 * to seed the consortium list from the historical sheet; the operator manages it afterwards.
 */
export function inferGroups(names: readonly string[]): Map<string, string> {
  const byWord = new Map<string, string[]>();
  for (const name of names) {
    const word = name.split(/[\s']+/)[0] ?? "";
    if (word.length < 4 || ARTICLES.has(word.toLowerCase())) continue;
    byWord.set(word, [...(byWord.get(word) ?? []), name]);
  }
  const groups = new Map<string, string>();
  for (const [word, members] of byWord) {
    if (members.length >= 2) for (const name of members) groups.set(name, word);
  }
  return groups;
}

function rankSnapshot(snapshot: Snapshot, nameOf: (id: string) => string): Map<string, number> {
  const sorted = [...snapshot.rows].sort(
    (a, b) =>
      (a.rank ?? Infinity) - (b.rank ?? Infinity) ||
      b.chiffre - a.chiffre ||
      nameOf(a.companyId).localeCompare(nameOf(b.companyId), "fr"),
  );
  return new Map(sorted.map((row, index) => [row.companyId, row.rank ?? index + 1]));
}

function buildPoints(
  snapshots: readonly Snapshot[],
  ranks: readonly Map<string, number>[],
  id: string,
  creation: CreationEstimate | null,
): CompanyPoint[] {
  const points: CompanyPoint[] = [];
  snapshots.forEach((snapshot, index) => {
    const row = snapshot.rows.find((r) => r.companyId === id);
    if (!row) return;
    const days = creation ? activityDays(creation.creation, snapshot.date) : null;
    const usable = days !== null && days > 0;
    const cumulative = usable && row.chiffre > 0 ? row.chiffre * days : usable ? 0 : null;
    const prev = points.at(-1) ?? null;
    const gap = prev ? daysBetween(prev.date, snapshot.date) : null;
    let realDaily: number | null = null;
    let realDailyNoise: number | null = null;
    let performance: number | null = null;
    if (
      prev &&
      gap &&
      cumulative !== null &&
      prev.cumulative !== null &&
      prev.chiffre > 0 &&
      row.chiffre > 0
    ) {
      realDaily = Math.max(0, (cumulative - prev.cumulative) / gap);
      realDailyNoise = ((days ?? 0) + (prev.days ?? 0)) / 2 / gap;
      performance = realDaily / prev.chiffre - 1;
    }
    let otherFlow: number | null = null;
    let otherFlowNoise: number | null = null;
    if (prev && gap && row.capital !== null && prev.capital !== null) {
      // A company published at 0 on both reports earned nothing in between.
      const silent = prev.chiffre === 0 && row.chiffre === 0;
      if (realDaily !== null && realDailyNoise !== null) {
        otherFlow = row.capital - prev.capital - realDaily * gap;
        otherFlowNoise = realDailyNoise * gap;
      } else if (silent) {
        otherFlow = row.capital - prev.capital;
        otherFlowNoise = 0;
      }
    }
    points.push({
      date: snapshot.date,
      rank: ranks[index].get(id) ?? 0,
      chiffre: row.chiffre,
      capital: row.capital,
      employees: row.employees,
      days: usable ? days : null,
      cumulative,
      gap,
      realDaily,
      realDailyNoise,
      performance,
      otherFlow,
      otherFlowNoise,
    });
  });
  return points;
}

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return groups;
}

/** A page, as the address and seal rules see it: its latest life and when it was first seen. */
interface PageKey {
  current: CompanySeries;
  firstSeen: IsoDate;
  /** First name the page ever carried. */
  original: string;
}

/**
 * Gives every page a unique, readable address. Among namesake pages, the open one (or the most
 * recent) keeps the plain name; earlier ones take the year they were first seen.
 */
function assignSlugs(pages: readonly PageKey[]): void {
  const taken = new Set<string>();
  const groups = groupBy(pages, (p) => slugify(p.current.name) || `corporation-${p.current.id}`);
  for (const [base, members] of groups) {
    members.sort(
      (a, b) =>
        Number(a.current.status === "delisted") - Number(b.current.status === "delisted") ||
        b.firstSeen.localeCompare(a.firstSeen),
    );
    members.forEach((p, index) => {
      let slug = index === 0 ? base : `${base}-${p.firstSeen.slice(0, 4)}`;
      if (taken.has(slug)) slug = `${base}-${p.current.profileId}`;
      taken.add(slug);
      p.current.slug = slug;
    });
  }
}

/** Seals follow the first name a page carried; a later namesake page gets its own. */
function assignSealSeeds(pages: readonly PageKey[]): void {
  for (const [original, members] of groupBy(pages, (p) => p.original)) {
    members.sort((a, b) => a.firstSeen.localeCompare(b.firstSeen));
    members.forEach((p, index) => {
      p.current.sealSeed = index === 0 ? original : `${original}·${p.firstSeen}`;
    });
  }
}

/**
 * Derives every series, fact and score the interface reads from the raw dataset. Figures are per
 * life: a refounded corporation starts again from zero, as in the game. Pages gather the lives
 * for display. Hidden corporations get no series and count in no fact or share; ranks stay the
 * ones of the full report, as the game prints them.
 */
export function buildMarket(dataset: Dataset): Market {
  const snapshots = [...dataset.snapshots].sort((a, b) => a.date.localeCompare(b.date));
  if (snapshots.length === 0) throw new Error("Aucun relevé.");
  const consortiums = new Map(dataset.consortiums.map((c) => [c.id, c]));
  const metaById = new Map<string, CompanyMeta>(dataset.companies.map((c) => [c.id, c]));
  const profileById = new Map<string, CompanyProfile>(dataset.profiles.map((p) => [p.id, p]));
  const profileOf = (id: string) => profileById.get(metaById.get(id)?.profileId ?? "");
  const periodsByProfile = new Map(
    [...membershipsByProfile(dataset.memberships)].map(([profileId, list]) => [
      profileId,
      list.flatMap((m): ResolvedMembership[] => {
        const consortium = consortiums.get(m.consortiumId);
        return consortium ? [{ consortium, joinedOn: m.joinedOn, leftOn: m.leftOn }] : [];
      }),
    ]),
  );
  const ranks = snapshots.map((s) => rankSnapshot(s, (id) => metaById.get(id)?.name ?? id));
  const latest = snapshots[snapshots.length - 1];
  const previous = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
  const latestDay = toDayNumber(latest.date);

  const shown = (id: string) => profileOf(id)?.hidden !== true;
  const ids = new Set<string>();
  for (const s of snapshots) for (const r of s.rows) if (shown(r.companyId)) ids.add(r.companyId);

  const allLives: CompanySeries[] = [];
  for (const id of ids) {
    const meta = metaById.get(id);
    if (!meta) continue;
    const profile = profileOf(id);
    const chiffres = snapshots.flatMap((s) => {
      const row = s.rows.find((r) => r.companyId === id);
      return row ? [{ date: s.date, chiffre: row.chiffre }] : [];
    });
    const creation = estimateCreation(chiffres, meta.creationOverride);
    const points = buildPoints(snapshots, ranks, id, creation);
    const last = points[points.length - 1];
    const prev = points.length > 1 ? points[points.length - 2] : null;
    const inLatest = last.date === latest.date;
    const status: CompanyStatus =
      meta.closedOn !== null || !inLatest ? "delisted" : last.chiffre === 0 ? "idle" : "active";
    const recent = rateBetween(points, latestDay - 30, latestDay);
    const before = rateBetween(points, latestDay - 120, latestDay - 30);
    let bestRank = { rank: points[0].rank, date: points[0].date };
    let record = { chiffre: points[0].chiffre, date: points[0].date };
    for (const p of points) {
      if (p.rank < bestRank.rank) bestRank = { rank: p.rank, date: p.date };
      if (p.chiffre > record.chiffre) record = { chiffre: p.chiffre, date: p.date };
    }
    const memberships = periodsByProfile.get(meta.profileId) ?? [];
    allLives.push({
      id,
      profileId: meta.profileId,
      life: { index: 1, count: 1 },
      name: meta.name,
      slug: "",
      formerNames: meta.formerNames,
      consortium: membershipOn(memberships, last.date)?.consortium ?? null,
      memberships,
      sector: profile?.sector ?? null,
      district: profile?.district ?? null,
      logoUrl: profile?.logoUrl ?? null,
      closedOn: meta.closedOn,
      sealSeed: meta.name,
      namesakes: [],
      creation,
      points,
      status,
      firstSeen: points[0].date,
      latest: last,
      previous: prev,
      rankChange: prev && inLatest && prev.date === previous?.date ? prev.rank - last.rank : null,
      chiffreChange: prev && prev.chiffre > 0 ? last.chiffre / prev.chiffre - 1 : null,
      scores: {
        dynamics:
          recent !== null && before !== null && before > 0
            ? Math.tanh((2.5 * (recent - before)) / before)
            : null,
        activity: recent !== null && last.chiffre > 0 ? Math.tanh(recent / last.chiffre - 1) : null,
        weight: recent,
        sectorWeight: null,
        dynamicsVsSector: null,
        activityVsSector: null,
      },
      recentRate: recent === null ? null : Math.max(0, recent),
      previousRate: before,
      sectorRank: null,
      projection: null,
      risk: null,
      rating: null,
      watch: null,
      valuation: null,
      bestRank,
      record,
    });
  }

  // Weight is a share of the whole market's real revenue over the same 30 days.
  const totalRecent = allLives.reduce((sum, c) => sum + Math.max(0, c.scores.weight ?? 0), 0);
  for (const c of allLives) {
    c.scores.weight =
      c.scores.weight !== null && totalRecent > 0
        ? Math.max(0, c.scores.weight) / totalRecent
        : null;
  }

  for (const c of allLives) c.risk = assessRisk(c, latest.date);

  // Pages: lives oldest first; the latest one stands for the page.
  const lives = groupBy(allLives, (c) => c.profileId);
  const pages: PageKey[] = [];
  for (const members of lives.values()) {
    members.sort((a, b) => a.firstSeen.localeCompare(b.firstSeen));
    const current = members[members.length - 1];
    const original = members[0].formerNames[0] ?? members[0].name;
    const formerNames: string[] = [];
    for (const life of members)
      for (const name of [...life.formerNames, life.name])
        if (name !== current.name && !formerNames.includes(name)) formerNames.push(name);
    members.forEach((life, index) => {
      life.life = { index: index + 1, count: members.length };
      life.formerNames = formerNames;
    });
    pages.push({
      current,
      firstSeen: members[0].firstSeen,
      original,
    });
  }
  assignSlugs(pages);
  assignSealSeeds(pages);
  for (const group of groupBy(pages, (p) => p.current.name).values()) {
    if (group.length < 2) continue;
    for (const page of group)
      page.current.namesakes = group
        .filter((other) => other !== page)
        .map((other) => ({
          slug: other.current.slug,
          name: other.current.name,
          firstSeen: other.firstSeen,
          lastSeen: other.current.latest.date,
          closedOn: other.current.closedOn,
        }))
        .sort((a, b) => a.firstSeen.localeCompare(b.firstSeen));
  }
  // Earlier lives answer to their page's address; their own former address stays an alias.
  const legacySlugs: [string, string][] = [];
  for (const members of lives.values()) {
    const current = members[members.length - 1];
    for (const life of members) {
      if (life === current) continue;
      legacySlugs.push([`${slugify(life.name)}-${life.firstSeen.slice(0, 4)}`, current.slug]);
      life.slug = current.slug;
      life.sealSeed = current.sealSeed;
      life.namesakes = current.namesakes;
    }
  }

  const companies = pages.map((p) => p.current);
  companies.sort((a, b) => {
    const order = { active: 0, idle: 1, delisted: 2 } as const;
    return order[a.status] - order[b.status] || a.latest.rank - b.latest.rank;
  });

  const sectors = summarizeSectors(allLives, companies, totalRecent);

  const bySlug = new Map(companies.map((c) => [c.slug, c]));
  const slugAliases = new Map<string, string>();
  const alias = (from: string, to: string) => {
    if (from && !bySlug.has(from) && !slugAliases.has(from)) slugAliases.set(from, to);
  };
  for (const c of companies) for (const former of c.formerNames) alias(slugify(former), c.slug);
  for (const [from, to] of legacySlugs) alias(from, to);

  const events = new Map<string, CompanyEvent[]>();
  for (const event of [...dataset.events].sort((a, b) => a.date.localeCompare(b.date)))
    events.set(event.companyId, [...(events.get(event.companyId) ?? []), event]);

  // A rating is about one life: a refounded corporation starts unrated.
  const ratings = new Map<string, CompanyRating[]>();
  for (const rating of [...dataset.ratings].sort((a, b) => a.date.localeCompare(b.date)))
    ratings.set(rating.companyId, [...(ratings.get(rating.companyId) ?? []), rating]);

  const marketEvents = [...dataset.marketEvents].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  for (const c of allLives) {
    const rating = ratings.get(c.id)?.at(-1) ?? null;
    c.rating = rating;
    c.watch = rating
      ? watchRating(c, rating, events.get(c.id) ?? [], marketEvents, latest.date)
      : null;
  }

  // Theoretical value with the settings in force; shares belong to one life.
  const versions = sortSettings(dataset.valuationSettings ?? []);
  const { params } = settingsInForce(versions);
  const operations = new Map<string, SecurityOperation[]>();
  for (const op of inOrder(dataset.securityOperations ?? []))
    operations.set(op.companyId, [...(operations.get(op.companyId) ?? []), op]);
  for (const c of allLives)
    c.valuation = summarizeValuation(
      new LifeValuation(c, ratings.get(c.id) ?? [], params),
      operations.get(c.id) ?? [],
    );

  const byId = new Map(allLives.map((c) => [c.id, c]));
  const nameOf = (id: string) => byId.get(id)?.name ?? id;
  const latestRows = latest.rows.filter((r) => shown(r.companyId));
  const latestIds = new Set(latestRows.map((r) => r.companyId));
  const previousIds = new Set(
    previous?.rows.filter((r) => shown(r.companyId)).map((r) => r.companyId) ?? [],
  );
  const arrived = previous ? [...latestIds].filter((id) => !previousIds.has(id)) : [];
  const left = [...previousIds].filter((id) => !latestIds.has(id));
  const pageOf = (id: string) => metaById.get(id)?.profileId;
  const refoundedPages = new Set(
    arrived.map(pageOf).filter((p) => p !== undefined && left.some((id) => pageOf(id) === p)),
  );
  const facts: ReportFacts = {
    date: latest.date,
    previousDate: previous?.date ?? null,
    gap: previous ? daysBetween(previous.date, latest.date) : null,
    listed: latestRows.length,
    active: latestRows.filter((r) => r.chiffre > 0).length,
    idle: latestRows.filter((r) => r.chiffre === 0).length,
    newcomers: arrived.filter((id) => !refoundedPages.has(pageOf(id))).map(nameOf),
    delisted: left.filter((id) => !refoundedPages.has(pageOf(id))).map(nameOf),
    refounded: arrived.filter((id) => refoundedPages.has(pageOf(id))).map(nameOf),
  };

  const { bySlug: projections, ...projection } = projectMarket(companies, latest.date);
  for (const c of companies) c.projection = projections.get(c.slug) ?? null;

  return {
    dates: snapshots.map((s) => s.date),
    latestDate: latest.date,
    companies,
    allLives,
    lives,
    consortiums: [...dataset.consortiums].sort((a, b) => a.name.localeCompare(b.name, "fr")),
    sectors,
    facts,
    bySlug,
    byId,
    slugAliases,
    events,
    ratings,
    marketEvents,
    projection,
    valuation: { params, versions },
    operations,
  };
}

/** The consortium a corporation belonged to on `date`: memberships are dated, never retroactive. */
export function consortiumOn(company: CompanySeries, date: IsoDate): Consortium | null {
  return membershipOn(company.memberships, date)?.consortium ?? null;
}

/**
 * Real revenue per day averaged over the `window` days before each report (estimated).
 * Smooths the lumpy period-to-period figure into a readable trend.
 */
export function smoothedRealDaily(
  points: readonly CompanyPoint[],
  window = 30,
): { date: IsoDate; value: number | null }[] {
  return points.map((p) => {
    const day = toDayNumber(p.date);
    const rate = rateBetween(points, day - window, day);
    return { date: p.date, value: rate === null ? null : Math.max(0, rate) };
  });
}

/**
 * One chart line over every life of a page, oldest first. A gap (a null value on the day the
 * earlier life closed) breaks the line where the corporation was destroyed: each life's figures
 * start from zero again.
 */
export function acrossLives(
  lives: readonly CompanySeries[],
  values: (life: CompanySeries) => readonly { date: IsoDate; value: number | null }[],
): { date: IsoDate; value: number | null }[] {
  const out: { date: IsoDate; value: number | null }[] = [];
  lives.forEach((life, index) => {
    const before = index > 0 ? lives[index - 1] : null;
    if (before) out.push({ date: before.closedOn ?? life.firstSeen, value: null });
    out.push(...values(life));
  });
  return out;
}

/** Chart rules at each refounding of a page: where a new life starts. */
export function refoundingMarkers(
  lives: readonly CompanySeries[],
): { id: string; date: IsoDate; label: string; title: string }[] {
  return lives.slice(1).map((life) => ({
    id: `life-${life.id}`,
    date: life.firstSeen,
    label: "Refondation",
    title: `Refondation (vie ${life.life.index}) : l'âge et le CA moyen repartent de zéro`,
  }));
}
