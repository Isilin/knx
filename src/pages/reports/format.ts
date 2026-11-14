import { todayIn } from "../../domain/dates.ts";
import type { IsoDate } from "../../domain/types.ts";

const clock = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  minute: "2-digit",
});

/** The Paris calendar day of a timestamp, to show it as an imperial date. */
export const parisDay = (timestamp: string): IsoDate =>
  todayIn("Europe/Paris", new Date(timestamp));

/** `14:32`, Paris time. */
export const parisClock = (timestamp: string): string => clock.format(new Date(timestamp));

/** `A, B, C et 12 autres` */
export function list(names: readonly string[], limit = 8): string {
  if (names.length === 0) return "aucune";
  if (names.length <= limit) return names.join(", ");
  return `${names.slice(0, limit).join(", ")} et ${names.length - limit} autres`;
}
