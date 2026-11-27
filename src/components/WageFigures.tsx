import { useId, useState, type FormEvent } from "react";
import { useData } from "../data/DataProvider.tsx";
import { SOURCE_INFO, type AssetSource } from "../domain/balance.ts";
import type { CompanySeries, Market } from "../domain/market.ts";
import { planWage, type WageFigureDraft } from "../domain/mutations.ts";
import { formatInteger } from "../domain/numbers.ts";
import type { Dataset } from "../domain/types.ts";
import { describeWage, wageOn } from "../domain/wages.ts";
import { ImperialDate } from "./figures.tsx";
import "./ValuationSettingsForm.css";

/**
 * The operator's record of a life's own wage: the mean daily wage of its paid employees, read
 * with deck commands by the Agence (audited) or given by the direction (declared). Without one,
 * KNX assumes the reference wage of the sector.
 */
export function WageFigures({
  company,
  market,
  dataset,
}: {
  company: CompanySeries;
  market: Market;
  dataset: Dataset;
}) {
  const { change } = useData();
  const id = useId();
  const [date, setDate] = useState(company.latest.date);
  const [wage, setWage] = useState("");
  const [source, setSource] = useState<AssetSource>("audited");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const figures = company.wageFigures;
  const params = market.valuation.params;
  const reference = wageOn([], company.sector, params, company.latest.date);
  const cleaned = wage.replace(/[\s.  ]/g, "");
  const draft: WageFigureDraft = {
    id: null,
    companyId: company.id,
    date,
    wage: Number(cleaned),
    source,
    note: note || null,
  };
  let problem: string | null = null;
  let planned: WageFigureDraft | null = null;
  // An untouched form is not an error: it waits for a wage.
  if (cleaned !== "") {
    try {
      planned = planWage(dataset, draft);
    } catch (error) {
      problem = error instanceof Error ? error.message : String(error);
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!planned) return;
    setBusy(true);
    setMessage(null);
    const figure = planned;
    try {
      await change((s) => s.saveWageFigure(figure));
      setWage("");
      setNote("");
      setMessage({ tone: "ok", text: "Salaire enregistré." });
    } catch (error) {
      setMessage({
        tone: "error",
        text: `Enregistrement refusé : ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (figureId: string, label: string) => {
    setMessage(null);
    if (!window.confirm(`Retirer le salaire du ${label} ? KNX reprendra le chiffre précédent.`))
      return;
    try {
      await change((s) => s.deleteWageFigure(figureId));
    } catch (error) {
      setMessage({
        tone: "error",
        text: `Retrait refusé : ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  };

  return (
    <section className="ops" aria-labelledby={`${id}-title`}>
      <div className="section-head">
        <h2 id={`${id}-title`}>Salaires</h2>
        <p>
          salaire moyen d'un salarié payé, le DG ne l'étant pas ; sans chiffre, KNX suppose le
          barème : {describeWage(reference)}
        </p>
      </div>
      <div className="ops__grid">
        <form className="ops-form" onSubmit={submit} aria-labelledby={`${id}-new`}>
          <h3 id={`${id}-new`} className="label">
            Nouveau chiffre
          </h3>
          <div className="ops-form__row">
            <label className="field">
              <span className="label">Date</span>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <div className="field">
              <span className="label">Source</span>
              <div className="segmented" role="group" aria-label="Source du salaire">
                {(["audited", "declared"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={source === s}
                    onClick={() => setSource(s)}
                  >
                    {s === "declared" ? "Déclaré" : "Audité"}
                  </button>
                ))}
              </div>
            </div>
            <label className="field levers__field">
              <span className="label">Salaire moyen</span>
              <span className="levers__input">
                <input
                  inputMode="numeric"
                  required
                  value={wage}
                  placeholder={formatInteger(reference.wage)}
                  onChange={(e) => setWage(e.target.value)}
                />
                <span className="levers__unit">¢ / jour</span>
              </span>
            </label>
          </div>
          <p className="levers__muted">
            Le chiffre vaut depuis sa date jusqu'au suivant ; le premier couvre aussi les jours
            d'avant. Il ne concerne que cette vie de la corporation.
          </p>
          <label className="field">
            <span className="label">Note, publiée (facultative)</span>
            <input
              value={note}
              placeholder="Relevé par commandes de deck, dossier d'introduction…"
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          {problem ? <p className="note note--warn">{problem}</p> : null}
          <div className="levers__actions">
            <button className="button" type="submit" disabled={busy || !planned}>
              {busy ? "Enregistrement…" : "Enregistrer le salaire"}
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
        <div className="ops__journal">
          <h3 className="label">Enregistrés</h3>
          {figures.length === 0 ? (
            <p className="levers__muted">Aucun salaire enregistré : le barème s'applique.</p>
          ) : (
            <ol>
              {[...figures].reverse().map((f) => (
                <li key={f.id}>
                  <ImperialDate date={f.date} />
                  <span>
                    <strong>{formatInteger(f.wage)} ¢</strong> par jour ·{" "}
                    {SOURCE_INFO[f.source].label}
                    {f.note ? <span className="levers__muted"> — {f.note}</span> : null}
                  </span>
                  <button
                    type="button"
                    className="linklike"
                    onClick={() => void remove(f.id, f.date)}
                  >
                    retirer
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
