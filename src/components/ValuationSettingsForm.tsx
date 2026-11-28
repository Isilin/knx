import { useId, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useData } from "../data/DataProvider.tsx";
import { todayIn } from "../domain/dates.ts";
import { lifeValuation, type Market } from "../domain/market.ts";
import { cleanSettings } from "../domain/mutations.ts";
import { formatCompact, formatInteger, formatPercent } from "../domain/numbers.ts";
import { CATEGORY_INFO, CONFIDENCE_INFO, RATING_METHOD } from "../domain/rating.ts";
import { SECTORS } from "../domain/sectors.ts";
import { checkParams, DEFAULT_VALUATION, type ValuationParams } from "../domain/valuation.ts";
import { changedLevers } from "./bourseText.ts";
import { Change } from "./figures.tsx";
import "./ValuationSettingsForm.css";

/** Levers as typed: text, so a field can be emptied while editing. */
type Draft = Record<string, string>;

const SIMPLE: {
  key: Exclude<
    keyof ValuationParams,
    "categoryMultipliers" | "confidenceBands" | "sectorWages" | "defaultWage"
  >;
  label: string;
  unit: string;
  step: string;
  /** Typed as a percentage, stored as a ratio. */
  percent?: boolean;
  help: string;
}[] = [
  {
    key: "revenueDays",
    label: "Jours de recettes",
    unit: "jours",
    step: "1",
    help: "Valeur du fonds de commerce, en jours de CA réel.",
  },
  {
    key: "revenueWindow",
    label: "Fenêtre du CA",
    unit: "jours",
    step: "1",
    help: "Jours de CA réel lus avant chaque relevé.",
  },
  {
    key: "spikeCap",
    label: "Écrêtement des pics",
    unit: "jours ordinaires",
    step: "0.5",
    help: "Plafond d'un jour, en jours ordinaires de la corporation.",
  },
  {
    key: "spikeLookback",
    label: "Jour ordinaire",
    unit: "jours d'historique",
    step: "1",
    help: "Fenêtre de la médiane des jours actifs.",
  },
  {
    key: "minHistory",
    label: "Observation",
    unit: "jours connus",
    step: "1",
    help: "Recettes connues exigées avant de publier une valeur.",
  },
  {
    key: "maturityHalf",
    label: "Demi-maturité",
    unit: "jours",
    step: "1",
    help: "Âge auquel une corporation compte pour moitié.",
  },
  {
    key: "capitalWeight",
    label: "Poids du capital",
    unit: "%",
    step: "1",
    percent: true,
    help: "Part du capital retenu comptée.",
  },
  {
    key: "capitalWindow",
    label: "Fenêtre du capital",
    unit: "jours",
    step: "1",
    help: "Moyenne face à laquelle le capital du jour est retenu au plus bas.",
  },
  {
    key: "unratedMultiplier",
    label: "Sans notation",
    unit: "×",
    step: "0.05",
    help: "Multiplicateur d'une corporation non notée.",
  },
  {
    key: "unratedBand",
    label: "Fourchette sans notation",
    unit: "± %",
    step: "1",
    percent: true,
    help: "Largeur de la fourchette d'une corporation non notée.",
  },
  {
    key: "ratingValidity",
    label: "Validité d'une notation",
    unit: "jours",
    step: "1",
    help: "Au-delà, la notation ne compte plus.",
  },
  {
    key: "introductionPrice",
    label: "Cours d'introduction proposé",
    unit: "¢",
    step: "1",
    help: "Cible du nombre de titres proposé à l'introduction.",
  },
  {
    key: "landWeight",
    label: "Terrain",
    unit: "%",
    step: "5",
    percent: true,
    help: "Part du prix comptée : il se revend seul.",
  },
  {
    key: "buildingWeight",
    label: "Bâtiment",
    unit: "%",
    step: "5",
    percent: true,
    help: "Il se revend avec son terrain.",
  },
  {
    key: "fittingsWeight",
    label: "Aménagement",
    unit: "%",
    step: "5",
    percent: true,
    help: "Décoration, sécurités, ameublement : seulement avec la boutique installée.",
  },
  {
    key: "stockWeight",
    label: "Stock",
    unit: "%",
    step: "5",
    percent: true,
    help: "Part du prix d'achat comptée.",
  },
  {
    key: "stockLife",
    label: "Durée de vie du stock",
    unit: "jours",
    step: "1",
    help: "Sans nouveau chiffre, le stock s'efface sur cette durée.",
  },
  {
    key: "declaredWeight",
    label: "Chiffre déclaré",
    unit: "%",
    step: "5",
    percent: true,
    help: "Poids d'un montant déclaré par la direction ; audité, il compte en entier.",
  },
  {
    key: "listedDeclaredWeight",
    label: "Déclaré, une fois cotée",
    unit: "%",
    step: "5",
    percent: true,
    help: "Poids d'un montant déclaré quand de vrais crédits reposent sur le cours.",
  },
  {
    key: "commission",
    label: "Commission",
    unit: "%",
    step: "0.1",
    percent: true,
    help: "Prélevée sur chaque exécution, à l'achat comme à la vente.",
  },
  {
    key: "maxOffer",
    label: "Part maximale d'une offre",
    unit: "%",
    step: "1",
    percent: true,
    help: "Part des titres d'une corporation qu'une offre peut vendre au plus.",
  },
  {
    key: "offerBand",
    label: "Bande du prix d'offre",
    unit: "± %",
    step: "1",
    percent: true,
    help: "Écart maximal du prix d'une offre au cours KNX.",
  },
  {
    key: "carryFee",
    label: "Frais de report",
    unit: "%",
    step: "0.05",
    percent: true,
    help: "Part du montant d'un ordre non servi, prélevée à chaque séance où il est reporté.",
  },
];

const CATEGORIES = RATING_METHOD.categories.map(([c]) => c);
const CONFIDENCES = ["high", "standard", "low"] as const;

const show = (n: number, percent = false) => String(percent ? Math.round(n * 1000) / 10 : n);

function toDraft(p: ValuationParams): Draft {
  const draft: Draft = {};
  for (const f of SIMPLE) draft[f.key] = show(p[f.key], f.percent);
  for (const c of CATEGORIES) draft[`m-${c}`] = show(p.categoryMultipliers[c]);
  for (const c of CONFIDENCES) draft[`b-${c}`] = show(p.confidenceBands[c], true);
  for (const s of SECTORS) draft[`w-${s.id}`] = show(p.sectorWages[s.id]);
  draft.defaultWage = show(p.defaultWage);
  return draft;
}

/** The typed levers as settings; null with a field that is not a number. */
function fromDraft(draft: Draft): ValuationParams | null {
  const read = (key: string, percent = false) => {
    const text = (draft[key] ?? "").replace(",", ".").trim();
    if (text === "") return NaN;
    const n = Number(text);
    return percent ? n / 100 : n;
  };
  const params: ValuationParams = {
    ...DEFAULT_VALUATION,
    categoryMultipliers: { ...DEFAULT_VALUATION.categoryMultipliers },
    confidenceBands: { ...DEFAULT_VALUATION.confidenceBands },
    sectorWages: { ...DEFAULT_VALUATION.sectorWages },
  };
  for (const f of SIMPLE) params[f.key] = read(f.key, f.percent);
  for (const c of CATEGORIES) params.categoryMultipliers[c] = read(`m-${c}`);
  for (const c of CONFIDENCES) params.confidenceBands[c] = read(`b-${c}`, true);
  for (const s of SECTORS) params.sectorWages[s.id] = read(`w-${s.id}`);
  params.defaultWage = read("defaultWage");
  const all = [
    ...SIMPLE.map((f) => params[f.key]),
    ...Object.values(params.categoryMultipliers),
    ...Object.values(params.confidenceBands),
    ...Object.values(params.sectorWages),
    params.defaultWage,
  ];
  return all.every(Number.isFinite) ? params : null;
}

interface Impact {
  slug: string;
  name: string;
  before: number | null;
  after: number | null;
  change: number | null;
}

/** Latest value of every listed corporation, with the settings in force and with the draft. */
function impactOf(market: Market, params: ValuationParams): Impact[] {
  return market.companies
    .filter((c) => c.status !== "delisted")
    .map((c) => {
      const before = c.valuation?.latest?.value ?? null;
      const after = lifeValuation(market, c, params).at(c.points.length - 1)?.value ?? null;
      return {
        slug: c.slug,
        name: c.name,
        before,
        after,
        change: before && after !== null ? after / before - 1 : null,
      };
    });
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function ValuationSettingsForm({ market }: { market: Market }) {
  const { change } = useData();
  const id = useId();
  const inForce = market.valuation.params;
  const [draft, setDraft] = useState<Draft>(() => toDraft(inForce));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const params = useMemo(() => fromDraft(draft), [draft]);
  const problem = useMemo(() => {
    if (!params) return "un champ n'est pas un nombre";
    try {
      checkParams(params);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }, [params]);
  const changes = params ? changedLevers(inForce, params) : [];
  const impact = useMemo(
    () => (params && !problem ? impactOf(market, params) : []),
    [market, params, problem],
  );
  const moved = impact.filter((i) => i.change !== null);
  const totalBefore = impact.reduce((s, i) => s + (i.before ?? 0), 0);
  const totalAfter = impact.reduce((s, i) => s + (i.after ?? 0), 0);
  const typical = median(moved.map((i) => i.change ?? 0));
  const largest = [...moved]
    .sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0))
    .slice(0, 12);

  const set = (key: string) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!params || problem) return;
    setBusy(true);
    setMessage(null);
    try {
      const settings = cleanSettings({
        date: todayIn("Europe/Paris"),
        params,
        note: note || null,
      });
      await change((source) => source.publishValuationSettings(settings));
      setNote("");
      setMessage({ tone: "ok", text: "Réglages publiés : toute la cote est recalculée." });
    } catch (error) {
      setMessage({
        tone: "error",
        text: `Publication refusée : ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setBusy(false);
    }
  };

  const field = (key: string, label: string, unit: string, step: string, help?: string) => (
    <label className="field levers__field" key={key}>
      <span className="label" title={help}>
        {label}
      </span>
      <span className="levers__input">
        <input
          inputMode="decimal"
          type="number"
          step={step}
          value={draft[key] ?? ""}
          onChange={set(key)}
          aria-describedby={help ? `${id}-${key}` : undefined}
        />
        <span className="levers__unit">{unit}</span>
      </span>
      {help ? (
        <span className="levers__help" id={`${id}-${key}`}>
          {help}
        </span>
      ) : null}
    </label>
  );

  return (
    <form className="levers" onSubmit={submit} aria-labelledby={`${id}-title`}>
      <div className="section-head">
        <h2 id={`${id}-title`}>Leviers</h2>
        <p>
          réglages de la valeur KNX, salaires de référence compris (ils séparent les salaires dans
          la trésorerie et les retirent de la recette dans la valeur) ; publiés, ils s'appliquent à
          tout l'historique et paraissent sur la <Link to="/bourse#reglages">page Bourse</Link>
        </p>
      </div>

      <div className="levers__groups">
        <div className="levers__column">
          <fieldset>
            <legend className="label">Recettes</legend>
            {SIMPLE.slice(0, 5).map((f) => field(f.key, f.label, f.unit, f.step, f.help))}
          </fieldset>
          <fieldset>
            <legend className="label">Bilan</legend>
            <span className="levers__sub">Part comptée de chaque poste</span>
            <div className="levers__pairs">
              {SIMPLE.slice(12, 16).map((f) => field(f.key, f.label, f.unit, f.step))}
            </div>
            {SIMPLE.slice(16, 19).map((f) => field(f.key, f.label, f.unit, f.step, f.help))}
          </fieldset>
        </div>
        <div className="levers__column">
          <fieldset>
            <legend className="label">Âge et capital</legend>
            {SIMPLE.slice(5, 8).map((f) => field(f.key, f.label, f.unit, f.step, f.help))}
          </fieldset>
          <fieldset>
            <legend className="label">Marché</legend>
            {SIMPLE.slice(19, 20).map((f) => field(f.key, f.label, f.unit, f.step, f.help))}
            <div className="levers__pairs">
              {SIMPLE.slice(20, 22).map((f) => field(f.key, f.label, f.unit, f.step))}
            </div>
            {SIMPLE.slice(22, 23).map((f) => field(f.key, f.label, f.unit, f.step, f.help))}
          </fieldset>
          <fieldset>
            <legend className="label">Introduction</legend>
            {field(
              SIMPLE[11].key,
              SIMPLE[11].label,
              SIMPLE[11].unit,
              SIMPLE[11].step,
              SIMPLE[11].help,
            )}
          </fieldset>
        </div>
        <fieldset>
          <legend className="label">Agence impériale</legend>
          <span className="levers__sub">Multiplicateur de la valeur, par catégorie</span>
          <div className="levers__pairs">
            {CATEGORIES.map((c) =>
              field(`m-${c}`, `${CATEGORY_INFO[c].symbol} ${CATEGORY_INFO[c].label}`, "×", "0.05"),
            )}
            {field("unratedMultiplier", "Sans notation", "×", "0.05")}
          </div>
          <span className="levers__sub">Fourchette publiée, selon la confiance</span>
          <div className="levers__pairs">
            {CONFIDENCES.map((c) =>
              field(
                `b-${c}`,
                CONFIDENCE_INFO[c].label.replace("confiance ", "Confiance "),
                "± %",
                "1",
              ),
            )}
            {field("unratedBand", "Sans notation", "± %", "1")}
          </div>
          {field(
            SIMPLE[10].key,
            SIMPLE[10].label,
            SIMPLE[10].unit,
            SIMPLE[10].step,
            SIMPLE[10].help,
          )}
        </fieldset>
        <fieldset>
          <legend className="label">Salaires de référence</legend>
          <span className="levers__sub">
            Salaire d'un salarié payé, par jour, selon le secteur ; le DG n'est pas payé, et un
            salaire audité l'emporte
          </span>
          <div className="levers__pairs">
            {SECTORS.map((s) => field(`w-${s.id}`, s.short, "¢", "100"))}
            {field("defaultWage", "Tous secteurs", "¢", "100")}
          </div>
        </fieldset>
      </div>

      <div className="levers__impact" aria-live="polite">
        <h3 className="label">Aperçu avant publication</h3>
        {problem ? (
          <p className="note note--warn">{problem}</p>
        ) : changes.length === 0 ? (
          <p className="levers__muted">Aucun levier ne change : rien à publier.</p>
        ) : (
          <>
            <ul className="levers__changes">
              {changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="levers__summary">
              Valeur de la cote <span className="estimated">{formatCompact(totalBefore)} ¢</span> →{" "}
              <span className="estimated">{formatCompact(totalAfter)} ¢</span> (
              <Change ratio={totalBefore > 0 ? totalAfter / totalBefore - 1 : null} estimated />) ·
              écart médian {typical === null ? "—" : formatPercent(typical)} sur {moved.length}{" "}
              corporations
            </p>
            <table className="levers__table">
              <caption className="sr-only">Plus forts écarts de valeur</caption>
              <thead>
                <tr>
                  <th scope="col">Plus forts écarts</th>
                  <th scope="col" className="num">
                    En vigueur
                  </th>
                  <th scope="col" className="num">
                    Aperçu
                  </th>
                  <th scope="col" className="num">
                    Écart
                  </th>
                </tr>
              </thead>
              <tbody>
                {largest.map((i) => (
                  <tr key={i.slug}>
                    <th scope="row">
                      <Link to={`/corporations/${i.slug}`}>{i.name}</Link>
                    </th>
                    <td className="num">{i.before === null ? "—" : formatInteger(i.before)}</td>
                    <td className="num">
                      <span className="estimated">
                        {i.after === null ? "—" : formatInteger(i.after)}
                      </span>
                    </td>
                    <td className="num">
                      <Change ratio={i.change} estimated />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <label className="field">
        <span className="label">Motif, publié avec les réglages</span>
        <textarea
          rows={2}
          value={note}
          placeholder="Calage sur la vente de telle corporation, retour d'expérience…"
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <div className="levers__actions">
        <button
          className="button"
          type="submit"
          disabled={busy || problem !== null || changes.length === 0}
        >
          {busy ? "Publication…" : "Publier les réglages"}
        </button>
        <button
          className="button button--quiet"
          type="button"
          onClick={() => setDraft(toDraft(inForce))}
        >
          Revenir aux réglages en vigueur
        </button>
        <button
          className="button button--quiet"
          type="button"
          onClick={() => setDraft(toDraft(DEFAULT_VALUATION))}
        >
          Valeurs par défaut
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
