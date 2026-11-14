import { formatImperialDate, imperialYear } from "./imperial.ts";
import type { CompanySeries } from "./market.ts";
import { listedOn, marketEventsBetween } from "./marketEvents.ts";
import { formatCompact, formatInteger, formatPercent, formatScore2 } from "./numbers.ts";
import { OUTLOOK_LABELS, ratingCode, ratingMove, type CompanyRating } from "./rating.ts";
import { largestFlows } from "./treasury.ts";
import type { CompanyEvent, EventKind, IsoDate, MarketEvent } from "./types.ts";

export const EVENT_LABELS: Record<EventKind, string> = {
  renamed: "Changement de nom",
  ceo_change: "Changement de DG",
  closed: "Fermeture",
  other: "Autre évènement",
};

export interface TimelineEntry {
  key: string;
  date: IsoDate;
  title: string;
  note: string | null;
  /**
   * `estimate`: computed by KNX (violet, dotted); `auto`: read from the reports; `manual`: typed;
   * `market`: an event of the whole market, edited on the Relevés page; `agency`: a rating of
   * the Agence impériale de notation.
   */
  origin: "auto" | "manual" | "estimate" | "market" | "agency";
  /** The recorded event behind the entry, when the operator can edit it. */
  event: CompanyEvent | null;
  /** The market event behind the entry. */
  market: MarketEvent | null;
  /** The typed founding date (the creation override). */
  founding: boolean;
  /** Another corporation the entry points to. */
  link: { slug: string; label: string } | null;
}

function eventTitle(event: CompanyEvent): string {
  const { details } = event;
  switch (event.kind) {
    case "renamed":
      return details.from && details.to
        ? `Changement de nom : ${details.from} devient ${details.to}`
        : EVENT_LABELS.renamed;
    case "ceo_change":
      return details.person ? `Changement de DG : ${details.person}` : EVENT_LABELS.ceo_change;
    case "closed":
      return EVENT_LABELS.closed;
    case "other":
      return details.title?.trim() || EVENT_LABELS.other;
  }
}

const entry = (
  partial: Pick<TimelineEntry, "key" | "date" | "title"> & Partial<TimelineEntry>,
): TimelineEntry => ({
  note: null,
  origin: "auto",
  event: null,
  market: null,
  founding: false,
  link: null,
  ...partial,
});

/**
 * A corporation's history, newest first: what KNX reads from the reports (first report, top 10,
 * records, closure, namesakes), what it estimates (founding), and what the operator recorded
 * (renames, chief executives, closures, other events).
 */
export function buildTimeline(
  company: CompanySeries,
  events: readonly CompanyEvent[],
  marketEvents: readonly MarketEvent[] = [],
  ratings: readonly CompanyRating[] = [],
): TimelineEntry[] {
  const list: TimelineEntry[] = [];
  const { creation } = company;

  if (creation?.method === "manual")
    list.push(
      entry({
        key: "founding",
        date: creation.creation,
        title: "Fondation",
        origin: "manual",
        founding: true,
      }),
    );
  else if (creation?.method === "bounds")
    list.push(
      entry({
        key: "founding",
        date: creation.creation,
        title: "Fondation estimée",
        note: "Déduite par KNX de l'historique du CA publié.",
        origin: "estimate",
      }),
    );

  list.push(entry({ key: "first-seen", date: company.firstSeen, title: "Premier relevé KNX" }));

  let inTop = company.points[0].rank <= 10;
  company.points.slice(1).forEach((p, i) => {
    const nowIn = p.rank <= 10;
    if (nowIn !== inTop)
      list.push(
        entry({
          key: `top-${i}`,
          date: p.date,
          title: nowIn
            ? `Entre dans le top 10 (rang ${p.rank})`
            : `Sort du top 10 (rang ${p.rank})`,
        }),
      );
    if (p.chiffre === 0 && company.points[i].chiffre > 0)
      list.push(entry({ key: `zero-${i}`, date: p.date, title: "CA publié retombé à 0" }));
    inTop = nowIn;
  });
  list.push(
    entry({
      key: "best-rank",
      date: company.bestRank.date,
      title: `Meilleur rang : ${company.bestRank.rank}`,
    }),
  );
  list.push(
    entry({
      key: "record",
      date: company.record.date,
      title: `Record de CA publié : ${formatInteger(company.record.chiffre)} ¢`,
    }),
  );

  // The largest flows outside revenue, when they moved at least a quarter of the capital.
  const flows = largestFlows(company.points, null, Infinity);
  const outflow = flows.find((f) => f.flow < 0 && (f.share ?? 0) <= -0.25);
  const inflow = flows.find((f) => f.flow > 0 && (f.share ?? 0) >= 0.25);
  for (const f of [outflow, inflow]) {
    if (!f) continue;
    const during = marketEventsBetween(marketEvents, f.previousDate, f.date);
    list.push(
      entry({
        key: `flow-${f.date}`,
        date: f.date,
        title: `${f.flow < 0 ? "Sortie" : "Entrée"} hors CA estimée : ${formatCompact(Math.abs(f.flow))} ¢ (${formatPercent(f.share ?? 0)} du disponible)`,
        note:
          during.length > 0
            ? `Coïncide avec ${during.map((e) => `« ${e.title} »`).join(", ")}.`
            : null,
        origin: "estimate",
      }),
    );
  }

  ratings.forEach((rating, index) => {
    const move = ratingMove(rating, ratings[index - 1] ?? null);
    list.push(
      entry({
        key: `rating-${rating.id}`,
        date: rating.date,
        title: `Notation ${ratingCode(rating.category, rating.confidence)} de l'Agence impériale`,
        note: `${move.text.replace(/^./, (c) => c.toUpperCase())} · ${formatScore2(rating.score)}/5 · perspective ${OUTLOOK_LABELS[rating.outlook]}.`,
        origin: "agency",
      }),
    );
  });

  for (const market of marketEvents)
    if (listedOn(company, market.date))
      list.push(
        entry({
          key: `market-${market.id}`,
          date: market.date,
          title: market.title,
          note: market.description,
          origin: "market",
          market,
        }),
      );

  const typedClosure = events.some((e) => e.kind === "closed");
  if (company.status === "delisted" && !typedClosure)
    list.push(
      entry({
        key: "closed",
        date: company.closedOn ?? company.latest.date,
        title: company.closedOn ? "Fermeture" : "Dernier relevé",
        note: company.closedOn
          ? `Absente du rapport ; dernier relevé le ${formatImperialDate(company.latest.date)}.`
          : null,
      }),
    );

  for (const other of company.namesakes) {
    const from = imperialYear(other.firstSeen);
    const to = imperialYear(other.closedOn ?? other.lastSeen);
    const years = from === to ? `an ${from}` : `ans ${from} à ${to}`;
    if (other.firstSeen < company.firstSeen)
      list.push(
        entry({
          key: `namesake-${other.slug}`,
          date: other.closedOn ?? other.lastSeen,
          title: `Une corporation du même nom a fermé (${years})`,
          note: "Corporation distincte : son historique n'est pas repris.",
          link: { slug: other.slug, label: `${other.name} (${years})` },
        }),
      );
    else
      list.push(
        entry({
          key: `namesake-${other.slug}`,
          date: other.firstSeen,
          title: "Une nouvelle corporation reprend le nom",
          link: { slug: other.slug, label: `${other.name} (depuis l'an ${from})` },
        }),
      );
  }

  for (const event of events)
    list.push(
      entry({
        key: `event-${event.id}`,
        date: event.date,
        title: eventTitle(event),
        note: event.note,
        origin: event.origin,
        event,
      }),
    );

  return list.sort((a, b) => b.date.localeCompare(a.date));
}
