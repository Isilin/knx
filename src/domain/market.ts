import { activityDays, estimateCreation, type CreationEstimate } from "./age.ts";
import { daysBetween, toDayNumber } from "./dates.ts";
import { projectMarket, type CompanyProjection, type Crossing } from "./projection.ts";
import { rateBetween } from "./revenue.ts";
import { assessRisk, type CompanyRisk } from "./risk.ts";
import type { SectorId } from "./sectors.ts";
import type {
  CompanyEvent,
  CompanyMeta,
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

/** `delisted`: closed, gone from the cote for good (a closed corporation never reopens). */
export type CompanyStatus = "active" | "idle" | "delisted";

export interface CompanyScores {
  /** −1…1: revenue rate of the last 30 days against the 90 days before. */
  dynamics: number | null;
  /** −1…1: revenue rate of the last 30 days against the lifetime average. */
  activity: number | null;
  /** 0…1: share of the market's real revenue over the last 30 days. */
  weight: number | null;
}

/** Another corporation that carried the same name, before or after this one. */
export interface Namesake {
  slug: string;
  name: string;
  firstSeen: IsoDate;
  lastSeen: IsoDate;
  closedOn: IsoDate | null;
}

export interface CompanySeries {
  id: string;
  name: string;
  slug: string;
  /** Former names, oldest first. */
  formerNames: string[];
  consortium: Consortium | null;
  sector: SectorId | null;
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
  /** Where the published chiffre heads if that rate holds; null when the estimate cannot say. */
  projection: CompanyProjection | null;
  /** KNX risk profile over the last five imperial years; null unless the company is active. */
  risk: CompanyRisk | null;
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
}

export interface Market {
  dates: IsoDate[];
  latestDate: IsoDate;
  companies: CompanySeries[];
  consortiums: Consortium[];
  facts: ReportFacts;
  bySlug: Map<string, CompanySeries>;
  byId: Map<string, CompanySeries>;
  /** Slug of a former name → current slug, to keep old links working. */
  slugAliases: Map<string, string>;
  /** Recorded events, by corporation id, oldest first. */
  events: Map<string, CompanyEvent[]>;
  /** Events of the whole market, oldest first. */
  marketEvents: MarketEvent[];
  /** Horizon of the projections and the changes of order expected before it. */
  projection: { horizon: IsoDate; days: number; crossings: Crossing[] };
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

/**
 * Gives every corporation a unique, readable address. Among namesakes, the open one (or the most
 * recent) keeps the plain name; earlier ones take the year they were first seen.
 */
function assignSlugs(companies: CompanySeries[]): void {
  const taken = new Set<string>();
  const groups = groupBy(companies, (c) => slugify(c.name) || `corporation-${c.id}`);
  for (const [base, members] of groups) {
    members.sort(
      (a, b) =>
        Number(a.status === "delisted") - Number(b.status === "delisted") ||
        b.firstSeen.localeCompare(a.firstSeen),
    );
    members.forEach((c, index) => {
      let slug = index === 0 ? base : `${base}-${c.firstSeen.slice(0, 4)}`;
      if (taken.has(slug)) slug = `${base}-${c.id}`;
      taken.add(slug);
      c.slug = slug;
    });
  }
}

/** Seals follow the first name a corporation carried; a later namesake gets its own. */
function assignSealSeeds(companies: CompanySeries[]): void {
  const groups = groupBy(companies, (c) => c.formerNames[0] ?? c.name);
  for (const [original, members] of groups) {
    members.sort((a, b) => a.firstSeen.localeCompare(b.firstSeen));
    members.forEach((c, index) => {
      c.sealSeed = index === 0 ? original : `${original}·${c.firstSeen}`;
    });
  }
}

/**
 * Derives every series, fact and score the interface reads from the raw dataset. Hidden
 * corporations get no series and count in no fact or share; ranks stay the ones of the full
 * report, as the game prints them.
 */
export function buildMarket(dataset: Dataset): Market {
  const snapshots = [...dataset.snapshots].sort((a, b) => a.date.localeCompare(b.date));
  if (snapshots.length === 0) throw new Error("Aucun relevé.");
  const consortiums = new Map(dataset.consortiums.map((c) => [c.id, c]));
  const metaById = new Map<string, CompanyMeta>(dataset.companies.map((c) => [c.id, c]));
  const ranks = snapshots.map((s) => rankSnapshot(s, (id) => metaById.get(id)?.name ?? id));
  const latest = snapshots[snapshots.length - 1];
  const previous = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
  const latestDay = toDayNumber(latest.date);

  const shown = (id: string) => metaById.get(id)?.hidden !== true;
  const ids = new Set<string>();
  for (const s of snapshots) for (const r of s.rows) if (shown(r.companyId)) ids.add(r.companyId);

  const companies: CompanySeries[] = [];
  for (const id of ids) {
    const meta = metaById.get(id);
    if (!meta) continue;
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
    companies.push({
      id,
      name: meta.name,
      slug: "",
      formerNames: meta.formerNames,
      consortium: meta.consortiumId ? (consortiums.get(meta.consortiumId) ?? null) : null,
      sector: meta.sector,
      logoUrl: meta.logoUrl,
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
      },
      recentRate: recent === null ? null : Math.max(0, recent),
      projection: null,
      risk: null,
      bestRank,
      record,
    });
  }

  // Weight is a share of the whole market's real revenue over the same 30 days.
  const totalRecent = companies.reduce((sum, c) => sum + Math.max(0, c.scores.weight ?? 0), 0);
  for (const c of companies) {
    c.scores.weight =
      c.scores.weight !== null && totalRecent > 0
        ? Math.max(0, c.scores.weight) / totalRecent
        : null;
  }

  for (const c of companies) c.risk = assessRisk(c, latest.date);

  assignSlugs(companies);
  assignSealSeeds(companies);
  for (const members of groupBy(companies, (c) => c.name).values()) {
    if (members.length < 2) continue;
    for (const c of members)
      c.namesakes = members
        .filter((other) => other !== c)
        .map((other) => ({
          slug: other.slug,
          name: other.name,
          firstSeen: other.firstSeen,
          lastSeen: other.latest.date,
          closedOn: other.closedOn,
        }))
        .sort((a, b) => a.firstSeen.localeCompare(b.firstSeen));
  }

  companies.sort((a, b) => {
    const order = { active: 0, idle: 1, delisted: 2 } as const;
    return order[a.status] - order[b.status] || a.latest.rank - b.latest.rank;
  });

  const bySlug = new Map(companies.map((c) => [c.slug, c]));
  const slugAliases = new Map<string, string>();
  for (const c of companies)
    for (const former of c.formerNames) {
      const alias = slugify(former);
      if (alias && !bySlug.has(alias) && !slugAliases.has(alias)) slugAliases.set(alias, c.slug);
    }

  const events = new Map<string, CompanyEvent[]>();
  for (const event of [...dataset.events].sort((a, b) => a.date.localeCompare(b.date)))
    events.set(event.companyId, [...(events.get(event.companyId) ?? []), event]);

  const byId = new Map(companies.map((c) => [c.id, c]));
  const nameOf = (id: string) => byId.get(id)?.name ?? id;
  const latestRows = latest.rows.filter((r) => shown(r.companyId));
  const latestIds = new Set(latestRows.map((r) => r.companyId));
  const previousIds = new Set(
    previous?.rows.filter((r) => shown(r.companyId)).map((r) => r.companyId) ?? [],
  );
  const facts: ReportFacts = {
    date: latest.date,
    previousDate: previous?.date ?? null,
    gap: previous ? daysBetween(previous.date, latest.date) : null,
    listed: latestRows.length,
    active: latestRows.filter((r) => r.chiffre > 0).length,
    idle: latestRows.filter((r) => r.chiffre === 0).length,
    newcomers: previous ? [...latestIds].filter((id) => !previousIds.has(id)).map(nameOf) : [],
    delisted: [...previousIds].filter((id) => !latestIds.has(id)).map(nameOf),
  };

  const { bySlug: projections, ...projection } = projectMarket(companies, latest.date);
  for (const c of companies) c.projection = projections.get(c.slug) ?? null;

  return {
    dates: snapshots.map((s) => s.date),
    latestDate: latest.date,
    companies,
    consortiums: [...dataset.consortiums].sort((a, b) => a.name.localeCompare(b.name, "fr")),
    facts,
    bySlug,
    byId,
    slugAliases,
    events,
    marketEvents: [...dataset.marketEvents].sort(
      (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
    ),
    projection,
  };
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
