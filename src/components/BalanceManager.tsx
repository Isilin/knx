import { useId, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useData } from "../data/DataProvider.tsx";
import {
  BALANCE_ITEM_INFO,
  BALANCE_ITEMS,
  SOURCE_INFO,
  type AssetSource,
  type BalanceItem,
} from "../domain/balance.ts";
import type { Market } from "../domain/market.ts";
import { planBalance, type BalanceSheetDraft } from "../domain/mutations.ts";
import { formatInteger } from "../domain/numbers.ts";
import type { Dataset } from "../domain/types.ts";
import { LifeValuation } from "../domain/valuation.ts";
import { ImperialDate } from "./figures.tsx";
import "./ValuationSettingsForm.css";

type Amounts = Record<BalanceItem, string>;
const EMPTY: Amounts = { land: "", building: "", fittings: "", stock: "" };

function BalanceForm({ market, dataset }: { market: Market; dataset: Dataset }) {
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
  const [source, setSource] = useState<AssetSource>("declared");
  const [amounts, setAmounts] = useState<Amounts>(EMPTY);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const company = companies.find((c) => c.id === companyId) ?? null;
  const sheets = company ? (market.balances.get(company.id) ?? []) : [];
  const read = (text: string) => {
    const cleaned = text.replace(/[\s.  ]/g, "");
    return cleaned === "" ? null : Number(cleaned);
  };
  const draft: BalanceSheetDraft | null = company
    ? {
        id: null,
        companyId: company.id,
        date,
        land: read(amounts.land),
        building: read(amounts.building),
        fittings: read(amounts.fittings),
        stock: read(amounts.stock),
        source,
        note: note || null,
      }
    : null;
  let problem: string | null = null;
  let planned: BalanceSheetDraft | null = null;
  // An untouched form is not an error: it waits for a first amount.
  const typed = BALANCE_ITEMS.some((item) => amounts[item].trim() !== "");
  if (draft && typed) {
    try {
      planned = planBalance(dataset, draft);
    } catch (error) {
      problem = error instanceof Error ? error.message : String(error);
    }
  }
  // The value on that date, without and with the sheet.
  const before = company
    ? new LifeValuation(
        company,
        market.ratings.get(company.id) ?? [],
        market.valuation.params,
        sheets,
      ).on(date)
    : null;
  const after =
    company && planned
      ? new LifeValuation(company, market.ratings.get(company.id) ?? [], market.valuation.params, [
          ...sheets,
          { ...planned, id: "aperçu" },
        ]).on(date)
      : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!planned) return;
    setBusy(true);
    setMessage(null);
    const sheet = planned;
    try {
      await change((s) => s.saveBalanceSheet(sheet));
      setAmounts(EMPTY);
      setNote("");
      setMessage({ tone: "ok", text: `Bilan enregistré pour ${company?.name}.` });
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
        Nouveau bilan
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
        <div className="field">
          <span className="label">Source</span>
          <div className="segmented" role="group" aria-label="Source des montants">
            {(["declared", "audited"] as const).map((s) => (
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
      </div>
      <div className="ops-form__row">
        {BALANCE_ITEMS.map((item) => (
          <label className="field levers__field" key={item}>
            <span className="label" title={BALANCE_ITEM_INFO[item].help}>
              {BALANCE_ITEM_INFO[item].label}
            </span>
            <span className="levers__input">
              <input
                inputMode="numeric"
                value={amounts[item]}
                placeholder="inchangé"
                onChange={(e) => setAmounts((a) => ({ ...a, [item]: e.target.value }))}
              />
              <span className="levers__unit">¢</span>
            </span>
          </label>
        ))}
      </div>
      <p className="levers__muted">
        Un poste laissé vide garde son dernier montant connu. Le stock se compte au prix d'achat.
      </p>
      <label className="field">
        <span className="label">Note, publiée (facultative)</span>
        <input
          value={note}
          placeholder="Dossier d'introduction, audit de l'Agence…"
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {company ? (
        problem ? (
          <p className="note note--warn">{problem}</p>
        ) : planned && after ? (
          <p className="ops-form__preview">
            Local compté <span className="estimated">{formatInteger(after.premises)} ¢</span>, stock
            compté <span className="estimated">{formatInteger(after.stock)} ¢</span> · valeur KNX du
            jour{" "}
            <span className="estimated">
              {before ? formatInteger(before.value) : "—"} → {formatInteger(after.value)} ¢
            </span>
          </p>
        ) : planned ? (
          <p className="ops-form__preview">
            KNX ne valorise pas encore cette corporation à cette date : le bilan comptera dès
            qu'elle aura une valeur.
          </p>
        ) : null
      ) : null}
      <div className="levers__actions">
        <button className="button" type="submit" disabled={busy || !planned}>
          {busy ? "Enregistrement…" : "Enregistrer le bilan"}
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

export function BalanceManager({ market, dataset }: { market: Market; dataset: Dataset }) {
  const { change } = useData();
  const [error, setError] = useState<string | null>(null);
  const journal = [...market.balances.values()]
    .flat()
    .map((sheet) => ({ sheet, company: market.byId.get(sheet.companyId) ?? null }))
    .sort((a, b) => b.sheet.date.localeCompare(a.sheet.date));

  const remove = async (sheetId: string, label: string) => {
    setError(null);
    if (!window.confirm(`Retirer le bilan « ${label} » ? La valeur sera recalculée sans lui.`))
      return;
    try {
      await change((s) => s.deleteBalanceSheet(sheetId));
    } catch (err) {
      setError(`Retrait refusé : ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <section className="ops" aria-labelledby="bilans">
      <div className="section-head">
        <h2 id="bilans">Bilans</h2>
        <p>
          local et stock, déclarés par les directions ou audités par l'Agence ; ils paraissent dans
          le calcul de la valeur sur chaque fiche (<Link to="/bourse#methode">méthode</Link>)
        </p>
      </div>
      <div className="ops__grid">
        <BalanceForm market={market} dataset={dataset} />
        <div className="ops__journal">
          <h3 className="label">Enregistrés</h3>
          {error ? (
            <p className="note note--error" role="alert">
              {error}
            </p>
          ) : null}
          {journal.length === 0 ? (
            <p className="levers__muted">Aucun bilan enregistré.</p>
          ) : (
            <ol>
              {journal.map(({ sheet, company }) => {
                const label = `${company?.name ?? "?"} du ${sheet.date}`;
                return (
                  <li key={sheet.id}>
                    <ImperialDate date={sheet.date} />
                    <span>
                      {company ? (
                        <Link to={`/corporations/${company.slug}`}>{company.name}</Link>
                      ) : (
                        "Corporation inconnue"
                      )}{" "}
                      · <strong>{SOURCE_INFO[sheet.source].label}</strong>
                      {BALANCE_ITEMS.filter((item) => sheet[item] !== null).map((item) => (
                        <span key={item}>
                          {" · "}
                          {BALANCE_ITEM_INFO[item].label.toLowerCase()}{" "}
                          {formatInteger(sheet[item] ?? 0)} ¢
                        </span>
                      ))}
                      {sheet.note ? <span className="levers__muted"> — {sheet.note}</span> : null}
                    </span>
                    <button
                      type="button"
                      className="linklike"
                      onClick={() => void remove(sheet.id, label)}
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
