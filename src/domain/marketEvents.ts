import { addDays } from "./dates.ts";
import type { IsoDate, MarketEvent } from "./types.ts";

/** Longest span an event's effects can be read over (three imperial years). */
export const MAX_EVENT_SPAN = 90;

/** What the charts print: the short label, or the title. */
export function marketEventLabel(event: MarketEvent): string {
  return event.label?.trim() || event.title;
}

/** The events as the charts draw them: a dated rule, a short label, the title on hover. */
export function marketMarkers(
  events: readonly MarketEvent[],
): { id: string; date: IsoDate; label: string; title: string }[] {
  return events.map((e) => ({
    id: e.id,
    date: e.date,
    label: marketEventLabel(e),
    title: e.title,
  }));
}

/** Last day of the event's span. */
export function marketEventEnd(event: MarketEvent): IsoDate {
  return addDays(event.date, Math.max(1, event.span) - 1);
}

/**
 * Events whose span meets the interval between two reports, `(from, to]`: what happened after the
 * first report and up to the second explains a change measured between them.
 */
export function marketEventsBetween(
  events: readonly MarketEvent[],
  from: IsoDate,
  to: IsoDate,
): MarketEvent[] {
  return events.filter((e) => e.date <= to && marketEventEnd(e) > from);
}

/**
 * Whether a corporation was listed on `date`: seen in a report on or before it, and not closed by
 * then. A corporation still in the cote is listed up to today; one gone from the reports without a
 * recorded closure, up to its last report.
 */
export function listedOn(
  company: {
    firstSeen: IsoDate;
    closedOn: IsoDate | null;
    status: "active" | "idle" | "delisted";
    latest: { date: IsoDate };
  },
  date: IsoDate,
): boolean {
  if (date < company.firstSeen) return false;
  if (company.closedOn) return date < company.closedOn;
  return company.status !== "delisted" || date <= company.latest.date;
}
