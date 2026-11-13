import { daysBetween, fromDayNumber, toDayNumber } from "./dates.ts";
import type { IsoDate } from "./types.ts";

/**
 * The imperial calendar of Dreadcast.
 *
 * One real month is one imperial year, one real day is one imperial day. A year is cut into
 * heptades of seven days counted from the 1st of the month, whatever weekday it falls on: days
 * 1–28 make four full heptades, days 29–31 a short fifth one.
 */

/** Imperial year of November 2026, the calendar's reference point. */
const REFERENCE_YEAR = 393;
const REFERENCE_MONTH_INDEX = 2026 * 12 + 10;

export const HEPTADE_DAYS = 7;

export interface ImperialDate {
  /** Day within the heptade: 1–7, or 1–3 in a fifth heptade. */
  day: number;
  /** Heptade within the year: 1–4, or 5 for days 29–31. */
  heptade: number;
  year: number;
}

export interface ImperialAge {
  years: number;
  heptades: number;
  days: number;
}

function parts(date: IsoDate): [year: number, month: number, day: number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y, m, d];
}

function monthIndex(year: number, month: number): number {
  return year * 12 + (month - 1);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isoDate(year: number, month: number, day: number): IsoDate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function yearOfIndex(index: number): number {
  return index - REFERENCE_MONTH_INDEX + REFERENCE_YEAR;
}

function firstDayOfIndex(index: number): IsoDate {
  const year = Math.floor(index / 12);
  return isoDate(year, index - year * 12 + 1, 1);
}

/**
 * The same day `years` imperial years (real months) later, or earlier when negative; clamped to
 * the last day of a shorter year.
 */
export function addImperialYears(date: IsoDate, years: number): IsoDate {
  const [y, m, d] = parts(date);
  const index = monthIndex(y, m) + years;
  const year = Math.floor(index / 12);
  const month = index - year * 12 + 1;
  return isoDate(year, month, Math.min(d, daysInMonth(year, month)));
}

/** Imperial year of a real date: one per real month, 393 in November 2026. */
export function imperialYear(date: IsoDate): number {
  const [y, m] = parts(date);
  return yearOfIndex(monthIndex(y, m));
}

export function toImperial(date: IsoDate): ImperialDate {
  const [, , d] = parts(date);
  return {
    day: ((d - 1) % HEPTADE_DAYS) + 1,
    heptade: Math.floor((d - 1) / HEPTADE_DAYS) + 1,
    year: imperialYear(date),
  };
}

/** `J/AAA.H`: `6/393.2` for 13 November 2026. */
export function formatImperialDate(date: IsoDate): string {
  const { day, heptade, year } = toImperial(date);
  return `${day}/${String(year).padStart(3, "0")}.${heptade}`;
}

/** `PTI JJMMAAAA` (Point Temporel Impérial): `PTI 13112026` for 13 November 2026. */
export function formatPti(date: IsoDate): string {
  const [y, m, d] = parts(date);
  return `PTI ${String(d).padStart(2, "0")}${String(m).padStart(2, "0")}${String(y).padStart(4, "0")}`;
}

/** `an 393`: the imperial year alone, for coarse axes. */
export function formatImperialYear(date: IsoDate): string {
  return `an ${imperialYear(date)}`;
}

export interface DateTick {
  date: IsoDate;
  label: string;
}

/** Day-of-month filters for fine axes, finest first: every day, heptade starts, two per year. */
const DAY_LEVELS: ReadonlyArray<(dayOfMonth: number) => boolean> = [
  () => true,
  // Fifth heptades are skipped: two or three days later a new year starts.
  (d) => d === 1 || d === 8 || d === 15 || d === 22,
  (d) => d === 1 || d === 15,
];
/** Year steps for coarse axes, aligned on round imperial years. */
const YEAR_STEPS = [1, 2, 5, 10, 20, 50, 100];

/**
 * Axis ticks between two dates in the imperial calendar: the finest level that yields at most
 * `maxCount` ticks — days, heptade starts, half-years, then the start of every Nth year.
 */
export function imperialTicks(start: IsoDate, end: IsoDate, maxCount: number): DateTick[] {
  const limit = Math.max(1, Math.floor(maxCount));
  const first = toDayNumber(start);
  const last = toDayNumber(end);
  if (last < first) return [];

  for (const keep of DAY_LEVELS) {
    const ticks: DateTick[] = [];
    for (let day = first; day <= last && ticks.length <= limit; day++) {
      const date = fromDayNumber(day);
      if (keep(Number(date.slice(8)))) ticks.push({ date, label: formatImperialDate(date) });
    }
    if (ticks.length <= limit) return ticks;
  }

  const [sy, sm, sd] = parts(start);
  const [ey, em] = parts(end);
  const from = monthIndex(sy, sm) + (sd > 1 ? 1 : 0);
  const to = monthIndex(ey, em);
  let ticks: DateTick[] = [];
  for (const step of YEAR_STEPS) {
    const offset = (((step - (yearOfIndex(from) % step)) % step) + step) % step;
    ticks = [];
    for (let index = from + offset; index <= to; index += step) {
      const date = firstDayOfIndex(index);
      ticks.push({ date, label: formatImperialYear(date) });
    }
    if (ticks.length <= limit) return ticks;
  }
  return ticks;
}

/**
 * Imperial age between two real dates: whole real months become years, the days left over are
 * split into heptades of seven days. Zero when `to` precedes `from`.
 */
export function imperialAge(from: IsoDate, to: IsoDate): ImperialAge {
  if (to <= from) return { years: 0, heptades: 0, days: 0 };
  const [fy, fm] = parts(from);
  const [ty, tm] = parts(to);
  let years = monthIndex(ty, tm) - monthIndex(fy, fm);
  let anniversary = addImperialYears(from, years);
  if (anniversary > to) {
    years -= 1;
    anniversary = addImperialYears(from, years);
  }
  const rest = daysBetween(anniversary, to);
  return {
    years,
    heptades: Math.floor(rest / HEPTADE_DAYS),
    days: rest % HEPTADE_DAYS,
  };
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}

/** `235 ans, 2 heptades et 3 jours`; zero parts are left out, `0 jour` when nothing is left. */
export function formatImperialAge(age: ImperialAge): string {
  const words = [
    age.years > 0 ? plural(age.years, "an") : null,
    age.heptades > 0 ? plural(age.heptades, "heptade") : null,
    age.days > 0 ? plural(age.days, "jour") : null,
  ].filter((w): w is string => w !== null);
  if (words.length === 0) return "0 jour";
  if (words.length === 1) return words[0];
  return `${words.slice(0, -1).join(", ")} et ${words[words.length - 1]}`;
}
