import type { IsoDate } from "./types.ts";

const DAY_MS = 86_400_000;

export function toDayNumber(date: IsoDate): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
}

export function fromDayNumber(day: number): IsoDate {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromDayNumber(toDayNumber(date) + days);
}

export function isIsoDate(text: string): text is IsoDate {
  return /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(`${text}T00:00:00Z`));
}

/** Today's calendar date in a time zone (`Europe/Paris` for the game's day). */
export function todayIn(timeZone: string, now: Date = new Date()): IsoDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
