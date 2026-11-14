import { useId, useState, type FormEvent } from "react";
import { useData } from "../data/DataProvider.tsx";
import { listedOn, MAX_EVENT_SPAN } from "../domain/marketEvents.ts";
import type { Market } from "../domain/market.ts";
import type { MarketEvent } from "../domain/types.ts";
import { ImperialDate } from "./figures.tsx";
import "./MarketEventManager.css";

function EventForm({ event, onClose }: { event: MarketEvent | null; onClose: () => void }) {
  const { change } = useData();
  const id = useId();
  const [date, setDate] = useState(event?.date ?? "");
  const [title, setTitle] = useState(event?.title ?? "");
  const [label, setLabel] = useState(event?.label ?? "");
  const [span, setSpan] = useState(String(event?.span ?? 1));
  const [description, setDescription] = useState(event?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await change((source) =>
        source.saveMarketEvent({
          id: event?.id ?? null,
          date,
          title,
          label: label || null,
          span: Number(span),
          description: description || null,
        }),
      );
      onClose();
    } catch (err) {
      setError(`Enregistrement refusé : ${err instanceof Error ? err.message : String(err)}`);
      setBusy(false);
    }
  };

  return (
    <form className="market-event-form" onSubmit={submit} aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="label">
        {event ? "Modifier l'évènement" : "Nouvel évènement de marché"}
      </h3>
      <label className="field">
        <span className="label">Titre</span>
        <input
          required
          value={title}
          placeholder="Faille ZD-385, nouvelle taxe…"
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <div className="market-event-form__row">
        <label className="field">
          <span className="label">Date</span>
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Durée (jours)</span>
          <input
            type="number"
            required
            min={1}
            max={MAX_EVENT_SPAN}
            step={1}
            value={span}
            onChange={(e) => setSpan(e.target.value)}
          />
        </label>
      </div>
      <label className="field">
        <span className="label">Étiquette des graphiques (facultative)</span>
        <input
          value={label}
          maxLength={24}
          placeholder="ZD-385"
          onChange={(e) => setLabel(e.target.value)}
        />
      </label>
      <label className="field">
        <span className="label">Description (facultative)</span>
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <p className="market-event-form__hint">
        L'évènement s'affiche dans l'historique de chaque corporation cotée à sa date, et sur les
        graphiques. Les flux hors CA mesurés pendant sa durée lui sont rattachés.
      </p>
      {error ? (
        <p className="note note--error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="market-event-form__actions">
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

function Row({
  event,
  listed,
  onEdit,
}: {
  event: MarketEvent;
  listed: number;
  onEdit: () => void;
}) {
  const { change } = useData();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    setError(null);
    try {
      await change((source) => source.deleteMarketEvent(event.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  return (
    <li className="market-event">
      <ImperialDate date={event.date} />
      <span className="market-event__body">
        <span className="market-event__title">
          {event.title}
          {event.label && event.label !== event.title ? (
            <span className="market-event__label">{event.label}</span>
          ) : null}
        </span>
        <small className="market-event__meta">
          {event.span > 1 ? `sur ${event.span} jours · ` : ""}
          {listed} corporation{listed > 1 ? "s" : ""} cotée{listed > 1 ? "s" : ""} ce jour-là
        </small>
        <span className="market-event__buttons">
          <button type="button" className="linklike" onClick={onEdit}>
            modifier
          </button>
          {confirming ? (
            <>
              <button type="button" className="linklike market-event__danger" onClick={remove}>
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
        </span>
        {error ? <span className="market-event__error">{error}</span> : null}
      </span>
    </li>
  );
}

/** Events of the whole market: added here, shown on every corporation listed that day. */
export function MarketEventManager({ market }: { market: Market }) {
  const [form, setForm] = useState<{ event: MarketEvent | null } | null>(null);
  const events = [...market.marketEvents].reverse();
  const listed = (date: string) => market.companies.filter((c) => listedOn(c, date)).length;

  return (
    <section className="market-events" aria-labelledby="evenements-marche">
      <div className="section-head">
        <h2 id="evenements-marche">Évènements de marché</h2>
        <p>
          {events.length} évènement{events.length > 1 ? "s" : ""} · affichés sur chaque fiche
        </p>
      </div>
      {form ? (
        <EventForm key={form.event?.id ?? "new"} event={form.event} onClose={() => setForm(null)} />
      ) : null}
      {events.length > 0 ? (
        <ol>
          {events.map((event) => (
            <Row
              key={event.id}
              event={event}
              listed={listed(event.date)}
              onEdit={() => setForm({ event })}
            />
          ))}
        </ol>
      ) : null}
      {form ? null : (
        <button
          type="button"
          className="button button--quiet market-events__add"
          onClick={() => setForm({ event: null })}
        >
          Ajouter un évènement
        </button>
      )}
    </section>
  );
}
