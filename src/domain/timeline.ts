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
  /** The life the entry belongs to. */
  companyId: string;
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
  partial: Pick<TimelineEntry, "key" | "companyId" | "date" | "title"> & Partial<TimelineEntry>,
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
 * The life an event dated `date` belongs to: the last one seen by then (the first one for an
 * event older than KNX). A founding belongs to the first life seen on or after its date.
 */
export function lifeAt(
  lives: readonly CompanySeries[],
  date: IsoDate,
  founding = false,
): CompanySeries {
  if (founding) return lives.find((l) => l.firstSeen >= date) ?? lives[lives.length - 1];
  return lives.findLast((l) => l.firstSeen <= date) ?? lives[0];
}

/**
 * A corporation's history, newest first, across all its lives: what KNX reads from the reports
 * (first report, top 10, records, closure, destruction and refounding, namesakes), what it
 * estimates (founding), and what the operator recorded (renames, chief executives, closures,
 * other events). `company` is one life or every life of the page, oldest first; `events` holds
 * the recorded events of those lives.
 */
export function buildTimeline(
  company: CompanySeries | readonly CompanySeries[],
  events: readonly CompanyEvent[],
  marketEvents: readonly MarketEvent[] = [],
  ratings: readonly CompanyRating[] = [],
): TimelineEntry[] {
  const lives: readonly CompanySeries[] = Array.isArray(company) ? company : [company];
  const page: Page = {
    lives,
    // Records of the whole page, every life together.
    best: lives.reduce((a, b) => (b.bestRank.rank < a.bestRank.rank ? b : a)),
    record: lives.reduce((a, b) => (b.record.chiffre > a.record.chiffre ? b : a)),
  };
  const list: TimelineEntry[] = [];
  membershipEntries(list, lives);
  lives.forEach((life, index) =>
    lifeEntries(
      list,
      page,
      index,
      events.filter((e) => e.companyId === life.id),
      marketEvents,
      ratings.filter((r) => r.companyId === life.id),
    ),
  );
  return list.sort((a, b) => b.date.localeCompare(a.date));
}

interface Page {
  lives: readonly CompanySeries[];
  /** The life that reached the page's best rank, and the one that set its record. */
  best: CompanySeries;
  record: CompanySeries;
}

/**
 * Consortium moves typed by the operator: a joining, a leaving, or both on the same day (a move
 * from one consortium to another). A membership since before the history begins has no joining.
 */
function membershipEntries(list: TimelineEntry[], lives: readonly CompanySeries[]): void {
  const periods = lives[lives.length - 1].memberships;
  const push = (key: string, date: IsoDate, title: string) =>
    list.push(entry({ key, companyId: lifeAt(lives, date).id, date, title, origin: "manual" }));
  periods.forEach((m, i) => {
    const before = periods[i - 1];
    const after = periods[i + 1];
    const name = m.consortium.name;
    if (m.joinedOn !== null && before?.leftOn !== m.joinedOn)
      push(`membership-${i}-join`, m.joinedOn, `Rejoint le consortium ${name}`);
    if (m.leftOn === null) return;
    if (after && after.joinedOn === m.leftOn)
      push(
        `membership-${i}-move`,
        m.leftOn,
        `Quitte le consortium ${name} pour ${after.consortium.name}`,
      );
    else push(`membership-${i}-leave`, m.leftOn, `Quitte le consortium ${name}`);
  });
}

/** Other pages that carried the name: listed once, with the current life. */
function namesakeEntries(list: TimelineEntry[], lives: readonly CompanySeries[]): void {
  const first = lives[0];
  const current = lives[lives.length - 1];
  for (const other of current.namesakes) {
    const from = imperialYear(other.firstSeen);
    const to = imperialYear(other.closedOn ?? other.lastSeen);
    const years = from === to ? `an ${from}` : `ans ${from} à ${to}`;
    if (other.firstSeen < first.firstSeen)
      list.push(
        entry({
          key: `namesake-${other.slug}`,
          companyId: first.id,
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
          companyId: current.id,
          date: other.firstSeen,
          title: "Une nouvelle corporation reprend le nom",
          link: { slug: other.slug, label: `${other.name} (depuis l'an ${from})` },
        }),
      );
  }
}

/** Entries of the `index`-th life of the page. */
function lifeEntries(
  list: TimelineEntry[],
  page: Page,
  index: number,
  events: readonly CompanyEvent[],
  marketEvents: readonly MarketEvent[],
  /** The Agence's ratings of this life, oldest first. */
  ratings: readonly CompanyRating[],
): void {
  const company = page.lives[index];
  // The life that followed it on the page, if any.
  const next = page.lives[index + 1] ?? null;
  const { creation } = company;
  const companyId = company.id;
  // Keys stay those of a single life for the first one; later lives get a prefix.
  const key = (k: string) => (index === 0 ? k : `life${index + 1}-${k}`);
  const refounding = index > 0;

  if (creation?.method === "manual")
    list.push(
      entry({
        key: key("founding"),
        companyId,
        date: creation.creation,
        title: refounding ? "Refondation" : "Fondation",
        note: refounding ? "Nouvelle vie : l'âge et le CA moyen repartent de zéro." : null,
        origin: "manual",
        founding: true,
      }),
    );
  else if (creation?.method === "bounds")
    list.push(
      entry({
        key: key("founding"),
        companyId,
        date: creation.creation,
        title: refounding ? "Refondation estimée" : "Fondation estimée",
        note: refounding
          ? "Nouvelle vie, déduite par KNX de l'historique du CA publié : l'âge et le CA moyen repartent de zéro."
          : "Déduite par KNX de l'historique du CA publié.",
        origin: "estimate",
      }),
    );

  list.push(
    entry({
      key: key("first-seen"),
      companyId,
      date: company.firstSeen,
      title: refounding ? "Premier relevé après la refondation" : "Premier relevé KNX",
      note:
        refounding && creation?.method !== "manual" && creation?.method !== "bounds"
          ? "Nouvelle vie : l'âge et le CA moyen repartent de zéro."
          : null,
    }),
  );

  let inTop = company.points[0].rank <= 10;
  company.points.slice(1).forEach((p, i) => {
    const nowIn = p.rank <= 10;
    if (nowIn !== inTop)
      list.push(
        entry({
          key: key(`top-${i}`),
          companyId,
          date: p.date,
          title: nowIn
            ? `Entre dans le top 10 (rang ${p.rank})`
            : `Sort du top 10 (rang ${p.rank})`,
        }),
      );
    if (p.chiffre === 0 && company.points[i].chiffre > 0)
      list.push(
        entry({ key: key(`zero-${i}`), companyId, date: p.date, title: "CA publié retombé à 0" }),
      );
    inTop = nowIn;
  });
  if (page.best === company)
    list.push(
      entry({
        key: "best-rank",
        companyId,
        date: company.bestRank.date,
        title: `Meilleur rang : ${company.bestRank.rank}`,
      }),
    );
  if (page.record === company)
    list.push(
      entry({
        key: "record",
        companyId,
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
        key: key(`flow-${f.date}`),
        companyId,
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

  ratings.forEach((rating, i) => {
    const move = ratingMove(rating, ratings[i - 1] ?? null);
    list.push(
      entry({
        key: `rating-${rating.id}`,
        companyId,
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
          key: key(`market-${market.id}`),
          companyId,
          date: market.date,
          title: market.title,
          note: market.description,
          origin: "market",
          market,
        }),
      );

  const typedClosure = events.some((e) => e.kind === "closed");
  if (company.status === "delisted" && !typedClosure) {
    const lastSeen = formatImperialDate(company.latest.date);
    let note: string | null = null;
    if (next && company.closedOn === next.firstSeen)
      note = `Refondée sous le même nom au relevé suivant (dernier relevé de l'ancienne vie le ${lastSeen}).`;
    else if (company.closedOn) note = `Absente du rapport ; dernier relevé le ${lastSeen}.`;
    list.push(
      entry({
        key: key("closed"),
        companyId,
        date: company.closedOn ?? company.latest.date,
        title: next ? "Destruction" : company.closedOn ? "Fermeture" : "Dernier relevé",
        note,
      }),
    );
  }

  if (next === null) namesakeEntries(list, page.lives);

  for (const event of events)
    list.push(
      entry({
        key: `event-${event.id}`,
        companyId,
        date: event.date,
        title: eventTitle(event),
        note: event.note,
        origin: event.origin,
        event,
      }),
    );
}
