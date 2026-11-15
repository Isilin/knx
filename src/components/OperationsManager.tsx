import { useId, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useData } from "../data/DataProvider.tsx";
import { lifeValuation, type Market } from "../domain/market.ts";
import { checkRemoval, planOperation, type SecurityOperationDraft } from "../domain/mutations.ts";
import { formatInteger, formatPrice } from "../domain/numbers.ts";
import {
  listingSteps,
  OPERATION_INFO,
  OPERATION_KINDS,
  proposeShares,
  stepOn,
  type OperationKind,
} from "../domain/securities.ts";
import type { Dataset } from "../domain/types.ts";
import { operationDetail } from "./bourseText.ts";
import { ImperialDate } from "./figures.tsx";
import "./ValuationSettingsForm.css";

/** Operations that can follow the corporation's listing on that date. */
function possibleKinds(state: "listed" | "suspended" | "withdrawn" | null): OperationKind[] {
  if (state === null || state === "withdrawn") return ["introduction"];
  if (state === "listed") return ["split", "reverse_split", "suspension", "withdrawal"];
  return ["resumption", "split", "reverse_split", "withdrawal"];
}

function OperationForm({ market, dataset }: { market: Market; dataset: Dataset }) {
  const { change } = useData();
  const id = useId();
  const companies = useMemo(
    () =>
      market.companies
        .filter((c) => c.status !== "delisted")
        .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [market],
  );
  const [companyId, setCompanyId] = useState("");
  const [date, setDate] = useState(market.latestDate);
  const [kind, setKind] = useState<OperationKind>("introduction");
  const [shares, setShares] = useState("");
  const [ratio, setRatio] = useState("2");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const company = companies.find((c) => c.id === companyId) ?? null;
  const operations = company ? (market.operations.get(company.id) ?? []) : [];
  const state = stepOn(listingSteps(operations), date)?.state ?? null;
  const kinds = possibleKinds(state);
  const chosen = kinds.includes(kind) ? kind : kinds[0];
  const value = company ? (lifeValuation(market, company).on(date)?.value ?? null) : null;
  const proposed =
    value !== null ? proposeShares(value, market.valuation.params.introductionPrice) : null;

  const draft: SecurityOperationDraft | null = company
    ? {
        id: null,
        companyId: company.id,
        date,
        kind: chosen,
        shares: chosen === "introduction" ? Number(shares || proposed || 0) : null,
        ratio: chosen === "split" || chosen === "reverse_split" ? Number(ratio) : null,
        note: note || null,
      }
    : null;
  let problem: string | null = null;
  let planned: SecurityOperationDraft | null = null;
  if (draft) {
    try {
      planned = planOperation(dataset, draft);
    } catch (error) {
      problem = error instanceof Error ? error.message : String(error);
    }
  }
  const before = stepOn(listingSteps(operations), date);
  const sharesAfter = planned
    ? planned.kind === "introduction"
      ? (planned.shares ?? 0)
      : planned.kind === "split"
        ? (before?.shares ?? 0) * (planned.ratio ?? 1)
        : planned.kind === "reverse_split"
          ? (before?.shares ?? 0) / (planned.ratio ?? 1)
          : (before?.shares ?? 0)
    : 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!planned) return;
    setBusy(true);
    setMessage(null);
    const operation = planned;
    try {
      await change((source) => source.saveSecurityOperation(operation));
      setNote("");
      setShares("");
      setMessage({
        tone: "ok",
        text: `${OPERATION_INFO[operation.kind].label} enregistrée pour ${company?.name}.`,
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: `Enregistrement refusé : ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="ops-form" onSubmit={submit} aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="label">
        Nouvelle opération
      </h3>
      <label className="field">
        <span className="label">Corporation</span>
        <select value={companyId} required onChange={(e) => setCompanyId(e.target.value)}>
          <option value="">Choisir une corporation cotée au rapport</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="ops-form__row">
        <label className="field">
          <span className="label">Date</span>
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Opération</span>
          <select
            value={chosen}
            onChange={(e) => setKind(e.target.value as OperationKind)}
            disabled={!company}
          >
            {OPERATION_KINDS.filter((k) => kinds.includes(k)).map((k) => (
              <option key={k} value={k}>
                {OPERATION_INFO[k].label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {company ? (
        <p className="levers__muted">
          {OPERATION_INFO[chosen].help}
          {chosen === "introduction"
            ? " Le dossier d'introduction est l'occasion d'auditer le local et le stock : voir Bilans plus bas."
            : null}
        </p>
      ) : null}
      {chosen === "introduction" ? (
        <label className="field">
          <span className="label">Nombre de titres, choisi par la direction</span>
          <span className="levers__input">
            <input
              type="number"
              min={1}
              step={1}
              value={shares}
              placeholder={proposed ? String(proposed) : ""}
              onChange={(e) => setShares(e.target.value)}
            />
            <span className="levers__unit">titres</span>
          </span>
          {proposed ? (
            <span className="levers__help">
              Laissé vide : {formatInteger(proposed)} titres, proposés par KNX pour un premier cours
              près de {formatInteger(market.valuation.params.introductionPrice)} ¢.
            </span>
          ) : null}
        </label>
      ) : null}
      {chosen === "split" || chosen === "reverse_split" ? (
        <label className="field">
          <span className="label">
            {chosen === "split" ? "Chaque titre devient" : "Titres regroupés en un seul"}
          </span>
          <input
            type="number"
            min={2}
            max={1000}
            step={1}
            value={ratio}
            onChange={(e) => setRatio(e.target.value)}
          />
        </label>
      ) : null}
      <label className="field">
        <span className="label">
          {chosen === "suspension" || chosen === "withdrawal"
            ? "Motif, publié"
            : "Note, publiée (facultative)"}
        </span>
        <input
          value={note}
          placeholder={
            chosen === "suspension"
              ? "Enquête de la DAI, opération en cours…"
              : "Annonce de la direction…"
          }
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      {company ? (
        problem ? (
          <p className="note note--warn">{problem}</p>
        ) : planned ? (
          <p className="ops-form__preview">
            {planned.kind === "suspension" || planned.kind === "withdrawal" ? (
              "Le cours ne sera plus publié à partir de cette date ; le dernier cours reste affiché."
            ) : value === null ? (
              "KNX ne valorise pas encore cette corporation à cette date : le cours paraîtra dès qu'elle aura une valeur."
            ) : (
              <>
                {formatInteger(sharesAfter)} titres · cours du jour{" "}
                <span className="estimated">{formatPrice(value / sharesAfter)} ¢</span> pour une
                valeur KNX de <span className="estimated">{formatInteger(value)} ¢</span>
              </>
            )}
          </p>
        ) : null
      ) : null}

      <div className="levers__actions">
        <button className="button" type="submit" disabled={busy || !planned}>
          {busy ? "Enregistrement…" : "Enregistrer l'opération"}
        </button>
      </div>
      {message ? (
        <p
          className={`note note--${message.tone}`}
          role={message.tone === "error" ? "alert" : undefined}
        >
          {message.text}
        </p>
      ) : null}
    </form>
  );
}

export function OperationsManager({ market, dataset }: { market: Market; dataset: Dataset }) {
  const { change } = useData();
  const [error, setError] = useState<string | null>(null);
  const journal = [...market.operations.values()]
    .flat()
    .map((op) => ({ op, company: market.byId.get(op.companyId) ?? null }))
    .sort((a, b) => b.op.date.localeCompare(a.op.date));

  const remove = async (opId: string, label: string) => {
    setError(null);
    try {
      checkRemoval(dataset, opId);
    } catch (err) {
      setError(
        `Impossible de retirer cette opération : ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }
    if (!window.confirm(`Retirer « ${label} » ? Le cours sera recalculé sans elle.`)) return;
    try {
      await change((source) => source.deleteSecurityOperation(opId));
    } catch (err) {
      setError(`Retrait refusé : ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <section className="ops" aria-labelledby="operations-titres">
      <div className="section-head">
        <h2 id="operations-titres">Opérations sur titres</h2>
        <p>
          à la demande des directions ; chaque opération paraît sur la fiche et dans le{" "}
          <Link to="/bourse#operations">journal public</Link>
        </p>
      </div>
      <div className="ops__grid">
        <OperationForm market={market} dataset={dataset} />
        <div className="ops__journal">
          <h3 className="label">Enregistrées</h3>
          {error ? (
            <p className="note note--error" role="alert">
              {error}
            </p>
          ) : null}
          {journal.length === 0 ? (
            <p className="levers__muted">Aucune opération enregistrée.</p>
          ) : (
            <ol>
              {journal.map(({ op, company }) => {
                const label = `${OPERATION_INFO[op.kind].label} · ${company?.name ?? "?"}`;
                return (
                  <li key={op.id}>
                    <ImperialDate date={op.date} />
                    <span>
                      {company ? (
                        <Link to={`/corporations/${company.slug}`}>{company.name}</Link>
                      ) : (
                        "Corporation inconnue"
                      )}{" "}
                      · <strong>{OPERATION_INFO[op.kind].label}</strong>
                      {operationDetail(op) ? ` · ${operationDetail(op)}` : null}
                      {op.note ? <span className="levers__muted"> — {op.note}</span> : null}
                    </span>
                    <button
                      type="button"
                      className="linklike"
                      onClick={() => void remove(op.id, label)}
                    >
                      retirer
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
