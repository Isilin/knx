import { useId, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useData } from "../data/DataProvider.tsx";
import { ImperialDate } from "./figures.tsx";
import { formatImperialDate } from "../domain/imperial.ts";
import type { CompanySeries } from "../domain/market.ts";
import { buildTimeline, EVENT_LABELS, type TimelineEntry } from "../domain/timeline.ts";
import type { CompanyEvent, EventDetails, EventKind, MarketEvent } from "../domain/types.ts";
import "./CompanyTimeline.css";

const VISIBLE = 10;

type FormKind = "founding" | EventKind;

const KIND_OPTIONS: { id: FormKind; label: string }[] = [
  { id: "founding", label: "Fondation" },
  { id: "renamed", label: EVENT_LABELS.renamed },
  { id: "ceo_change", label: EVENT_LABELS.ceo_change },
  { id: "closed", label: EVENT_LABELS.closed },
  { id: "other", label: EVENT_LABELS.other },
];

function EventForm({
  company,
  entry,
  onClose,
}: {
  company: CompanySeries;
  /** The entry being edited; null records a new event. */
  entry: TimelineEntry | null;
  onClose: () => void;
}) {
  const { change } = useData();
  const id = useId();
  const event = entry?.event ?? null;
  const [kind, setKind] = useState<FormKind>(
    entry?.founding ? "founding" : (event?.kind ?? "ceo_change"),
  );
  const [date, setDate] = useState(entry?.date ?? "");
  const [from, setFrom] = useState(event?.details.from ?? company.formerNames.at(-1) ?? "");
  const [to, setTo] = useState(event?.details.to ?? company.name);
  const [person, setPerson] = useState(event?.details.person ?? "");
  const [title, setTitle] = useState(event?.details.title ?? "");
  const [note, setNote] = useState(event?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (kind === "founding" && date > company.firstSeen) {
      setError(
        `La fondation précède le premier relevé (${formatImperialDate(company.firstSeen)}).`,
      );
      return;
    }
    const details: EventDetails =
      kind === "renamed"
        ? { from: from.trim(), to: to.trim() }
        : kind === "ceo_change"
          ? { person: person.trim() }
          : kind === "other"
            ? { title: title.trim() }
            : {};
    setBusy(true);
    setError(null);
    try {
      await change((source) =>
        kind === "founding"
          ? source.updateCompany(company.id, { creationOverride: date })
          : source.saveEvent({
              id: event?.id ?? null,
              companyId: company.id,
              date,
              kind,
              details,
              note: note.trim() || null,
            }),
      );
      onClose();
    } catch (err) {
      setError(`Enregistrement refusé : ${err instanceof Error ? err.message : String(err)}`);
      setBusy(false);
    }
  };

  return (
    <form className="event-form" onSubmit={submit} aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="label">
        {entry ? "Modifier l'évènement" : "Nouvel évènement"}
      </h3>
      <div className="event-form__row">
        <label className="field">
          <span className="label">Type</span>
          <select
            value={kind}
            disabled={entry !== null}
            onChange={(e) => setKind(e.target.value as FormKind)}
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Date</span>
          <input
            type="date"
            required
            value={date}
            max={kind === "founding" ? company.firstSeen : undefined}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>

      {kind === "renamed" ? (
        <div className="event-form__row">
          <label className="field">
            <span className="label">Ancien nom</span>
            <input required value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field">
            <span className="label">Nouveau nom</span>
            <input required value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
      ) : null}
      {kind === "ceo_change" ? (
        <label className="field">
          <span className="label">Nouveau DG</span>
          <input required value={person} onChange={(e) => setPerson(e.target.value)} />
        </label>
      ) : null}
      {kind === "other" ? (
        <label className="field">
          <span className="label">Ce qui s'est passé</span>
          <input
            required
            value={title}
            placeholder="Rachat par Kessler, nouveau siège…"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
      ) : null}
      {kind === "founding" ? (
        <p className="event-form__hint">
          La date de fondation remplace l'estimation de KNX dans le calcul de l'âge et du CA réel.
        </p>
      ) : (
        <label className="field">
          <span className="label">Note (facultative)</span>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      )}
      {kind === "renamed" && !entry ? (
        <p className="event-form__hint">
          Pour un renommage antérieur à KNX. Les renommages vus dans les relevés sont enregistrés à
          la publication.
        </p>
      ) : null}

      {error ? (
        <p className="note note--error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="event-form__actions">
        <button type="submit" className="button" disabled={busy}>
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button type="button" className="button button--quiet" onClick={onClose} disabled={busy}>
          Annuler
        </button>
      </div>
    </form>
  );
}

function EntryTools({
  company,
  entry,
  onEdit,
}: {
  company: CompanySeries;
  entry: TimelineEntry;
  onEdit: () => void;
}) {
  const { change } = useData();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    setError(null);
    try {
      const event: CompanyEvent | null = entry.event;
      await change((source) =>
        event
          ? source.deleteEvent(event.id)
          : source.updateCompany(company.id, { creationOverride: null }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  return (
    <span className="timeline__tools">
      <button type="button" className="linklike" onClick={onEdit}>
        modifier
      </button>
      {confirming ? (
        <>
          <button type="button" className="linklike timeline__danger" onClick={remove}>
            confirmer la suppression
          </button>
          <button type="button" className="linklike" onClick={() => setConfirming(false)}>
            garder
          </button>
        </>
      ) : (
        <button type="button" className="linklike" onClick={() => setConfirming(true)}>
          supprimer
        </button>
      )}
      {error ? <span className="timeline__error">{error}</span> : null}
    </span>
  );
}

/** Dated history of a corporation: read from the reports, estimated, or recorded by hand. */
export function CompanyTimeline({
  company,
  events,
  marketEvents,
  isAdmin,
}: {
  company: CompanySeries;
  events: readonly CompanyEvent[];
  /** Events of the whole market; those dated while the corporation was listed show. */
  marketEvents: readonly MarketEvent[];
  isAdmin: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const [form, setForm] = useState<{ entry: TimelineEntry | null } | null>(null);
  const entries = buildTimeline(company, events, marketEvents);
  const visible = showAll ? entries : entries.slice(0, VISIBLE);

  return (
    <section className="timeline" aria-labelledby="evenements">
      <div className="section-head">
        <h2 id="evenements">Historique</h2>
        <p>{entries.length} évènements</p>
        {isAdmin && !form ? (
          <div className="push">
            <button
              type="button"
              className="button button--quiet"
              onClick={() => setForm({ entry: null })}
            >
              Ajouter un évènement
            </button>
          </div>
        ) : null}
      </div>

      {form ? (
        <EventForm
          key={form.entry?.key ?? "new"}
          company={company}
          entry={form.entry}
          onClose={() => setForm(null)}
        />
      ) : null}

      <ol className="milestones timeline__list">
        {visible.map((entry) => (
          <li key={entry.key} className={`is-${entry.origin}`}>
            <ImperialDate date={entry.date} />
            <span className="timeline__body">
              <span className="timeline__title">
                <span className={entry.origin === "estimate" ? "estimated" : undefined}>
                  {entry.title}
                </span>
                {entry.origin === "manual" ? <span className="timeline__tag">saisi</span> : null}
                {entry.origin === "market" ? (
                  <span
                    className="timeline__tag timeline__tag--market"
                    title="Évènement de toute la cote, géré depuis la page Relevés"
                  >
                    marché
                  </span>
                ) : null}
              </span>
              {entry.note ? <small className="timeline__note">{entry.note}</small> : null}
              {entry.link ? (
                <Link className="timeline__link" to={`/corporations/${entry.link.slug}`}>
                  Voir la fiche {entry.link.label}
                </Link>
              ) : null}
              {isAdmin && (entry.event || entry.founding) ? (
                <EntryTools company={company} entry={entry} onEdit={() => setForm({ entry })} />
              ) : null}
            </span>
          </li>
        ))}
      </ol>
      {entries.length > VISIBLE ? (
        <button
          type="button"
          className="linklike timeline__more"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? "Réduire" : `Tout afficher (${entries.length})`}
        </button>
      ) : null}
    </section>
  );
}
