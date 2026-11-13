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

const longFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const shortFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});
const monthYearFormat = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** `13 novembre 2026` */
export function formatLongDate(date: IsoDate): string {
  return longFormat.format(new Date(`${date}T00:00:00Z`));
}

/** `13/11` */
export function formatShortDate(date: IsoDate): string {
  return shortFormat.format(new Date(`${date}T00:00:00Z`));
}

/** `nov. 2026` */
export function formatMonthYear(date: IsoDate): string {
  return monthYearFormat.format(new Date(`${date}T00:00:00Z`));
}

/** Human duration in days: `1 jour`, `12 jours`, `3 ans et 2 mois`. */
export function formatDuration(days: number): string {
  const d = Math.max(0, Math.round(days));
  if (d < 60) return `${d} jour${d > 1 ? "s" : ""}`;
  const years = Math.floor(d / 365.25);
  const months = Math.floor((d - years * 365.25) / 30.44);
  if (years === 0) return `${months} mois`;
  const y = `${years} an${years > 1 ? "s" : ""}`;
  return months > 0 ? `${y} et ${months} mois` : y;
}
