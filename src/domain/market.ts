import { activityDays, estimateCreation, type CreationEstimate } from "./age.ts";
import { daysBetween, toDayNumber } from "./dates.ts";
import type { CompanyMeta, Dataset, IsoDate, Snapshot } from "./types.ts";

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
}

export type CompanyStatus = "active" | "idle" | "delisted";

export interface CompanyScores {
  /** −1…1: revenue rate of the last 30 days against the 90 days before. */
  dynamics: number | null;
  /** −1…1: revenue rate of the last 30 days against the lifetime average. */
  activity: number | null;
  /** 0…1: share of the market's real revenue over the last 30 days. */
  weight: number | null;
}

export interface CompanySeries {
  name: string;
  slug: string;
  group: string | null;
  sector: string | null;
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
  facts: ReportFacts;
  bySlug: Map<string, CompanySeries>;
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

/** Groups inferred from a shared leading brand word (Armacham, Sovereign, Donnellys…). */
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

function rankSnapshot(snapshot: Snapshot): Map<string, number> {
  const sorted = [...snapshot.rows].sort(
    (a, b) =>
      (a.rank ?? Infinity) - (b.rank ?? Infinity) ||
      b.chiffre - a.chiffre ||
      a.name.localeCompare(b.name, "fr"),
  );
  return new Map(sorted.map((row, index) => [row.name, row.rank ?? index + 1]));
}

/** Cumulative revenue at or before `day`, with the matching report day. */
function cumulativeAt(
  points: readonly CompanyPoint[],
  day: number,
): { value: number; day: number } | null {
  for (let k = points.length - 1; k >= 0; k--) {
    const p = points[k];
    if (toDayNumber(p.date) <= day && p.cumulative !== null)
      return { value: p.cumulative, day: toDayNumber(p.date) };
  }
  return null;
}

/** Real revenue per day between `fromDay` and `toDay` (both snapped to available reports). */
function rateBetween(
  points: readonly CompanyPoint[],
  fromDay: number,
  toDay: number,
): number | null {
  const end = cumulativeAt(points, toDay);
  // When the window opens before the history, start at the first report inside it.
  let start = cumulativeAt(points, fromDay);
  if (!start) {
    const first = points.find((p) => p.cumulative !== null && toDayNumber(p.date) > fromDay);
    if (first?.cumulative != null)
      start = { value: first.cumulative, day: toDayNumber(first.date) };
  }
  if (!end || !start || end.day - start.day < 7) return null;
  return (end.value - start.value) / (end.day - start.day);
}

function buildPoints(
  snapshots: readonly Snapshot[],
  ranks: readonly Map<string, number>[],
  name: string,
  creation: CreationEstimate | null,
): CompanyPoint[] {
  const points: CompanyPoint[] = [];
  snapshots.forEach((snapshot, index) => {
    const row = snapshot.rows.find((r) => r.name === name);
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
    points.push({
      date: snapshot.date,
      rank: ranks[index].get(name) ?? 0,
      chiffre: row.chiffre,
      capital: row.capital,
      employees: row.employees,
      days: usable ? days : null,
      cumulative,
      gap,
      realDaily,
      realDailyNoise,
      performance,
    });
  });
  return points;
}

/** Derives every series, fact and score the interface reads from the raw dataset. */
export function buildMarket(dataset: Dataset): Market {
  const snapshots = [...dataset.snapshots].sort((a, b) => a.date.localeCompare(b.date));
  if (snapshots.length === 0) throw new Error("Aucun relevé.");
  const ranks = snapshots.map(rankSnapshot);
  const latest = snapshots[snapshots.length - 1];
  const previous = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
  const latestDay = toDayNumber(latest.date);

  const metaByName = new Map<string, CompanyMeta>(dataset.companies.map((c) => [c.name, c]));
  const names = new Set<string>();
  for (const s of snapshots) for (const r of s.rows) names.add(r.name);
  const inferred = inferGroups([...names]);

  const companies: CompanySeries[] = [];
  for (const name of names) {
    const meta = metaByName.get(name);
    const chiffres = snapshots.flatMap((s) => {
      const row = s.rows.find((r) => r.name === name);
      return row ? [{ date: s.date, chiffre: row.chiffre }] : [];
    });
    const creation = estimateCreation(chiffres, meta?.creationOverride ?? null);
    const points = buildPoints(snapshots, ranks, name, creation);
    const last = points[points.length - 1];
    const prev = points.length > 1 ? points[points.length - 2] : null;
    const inLatest = last.date === latest.date;
    const status: CompanyStatus = !inLatest ? "delisted" : last.chiffre === 0 ? "idle" : "active";
    const recent = rateBetween(points, latestDay - 30, latestDay);
    const before = rateBetween(points, latestDay - 120, latestDay - 30);
    let bestRank = { rank: points[0].rank, date: points[0].date };
    let record = { chiffre: points[0].chiffre, date: points[0].date };
    for (const p of points) {
      if (p.rank < bestRank.rank) bestRank = { rank: p.rank, date: p.date };
      if (p.chiffre > record.chiffre) record = { chiffre: p.chiffre, date: p.date };
    }
    companies.push({
      name,
      slug: slugify(name),
      group: meta?.group ?? inferred.get(name) ?? null,
      sector: meta?.sector ?? null,
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

  companies.sort((a, b) => {
    const order = { active: 0, idle: 1, delisted: 2 } as const;
    return order[a.status] - order[b.status] || a.latest.rank - b.latest.rank;
  });

  const latestNames = new Set(latest.rows.map((r) => r.name));
  const previousNames = new Set(previous?.rows.map((r) => r.name) ?? []);
  const facts: ReportFacts = {
    date: latest.date,
    previousDate: previous?.date ?? null,
    gap: previous ? daysBetween(previous.date, latest.date) : null,
    listed: latest.rows.length,
    active: latest.rows.filter((r) => r.chiffre > 0).length,
    idle: latest.rows.filter((r) => r.chiffre === 0).length,
    newcomers: previous ? [...latestNames].filter((n) => !previousNames.has(n)) : [],
    delisted: [...previousNames].filter((n) => !latestNames.has(n)),
  };

  return {
    dates: snapshots.map((s) => s.date),
    latestDate: latest.date,
    companies,
    facts,
    bySlug: new Map(companies.map((c) => [c.slug, c])),
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
