import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useData } from "../data/DataProvider.tsx";
import type { CompanySeries } from "../domain/market.ts";
import { formatDecimal, formatScore2 } from "../domain/numbers.ts";
import {
  assessRating,
  AXIS_LABELS,
  CATEGORY_INFO,
  CONFIDENCE_INFO,
  CRITERION_LABELS,
  DISTRICT_LABELS,
  EMPTY_INPUTS,
  isDistrict,
  OUTLOOK_LABELS,
  RATING_METHOD,
  type CriterionId,
  type CriterionScore,
  type District,
  type PresenceLevel,
  type RatingAxis,
  type RatingInputs,
  type RatingOutlook,
  type Transparency,
  type WagesLevel,
} from "../domain/rating.ts";
import type { IsoDate } from "../domain/types.ts";
import { ImperialDate } from "./figures.tsx";
import { RatingBadge } from "./RatingBadge.tsx";
import "./RatingForm.css";

const WAGES: { id: WagesLevel; label: string }[] = [
  { id: "insufficient", label: "Insuffisants pour vivre au quotidien" },
  { id: "decent", label: "Décents" },
  { id: "coherent", label: "Cohérents avec l'activité" },
];

const PRESENCE: { id: PresenceLevel; label: string }[] = [
  { id: "none", label: "Absente" },
  { id: "occasional", label: "Ponctuelle" },
  { id: "regular", label: "Régulière et entretenue" },
];

const TRANSPARENCY: { id: Transparency; label: string }[] = [
  { id: "none", label: "Aucune donnée transmise (0)" },
  { id: "partial", label: "Partielle, pertinente et cohérente (+0,10)" },
  { id: "complete", label: "Complète, cohérente et exploitable (+0,25)" },
  { id: "inconsistent", label: "Incohérences significatives (−0,10)" },
  { id: "contradictory", label: "Incohérence majeure (−0,25)" },
];

function Select<T extends string>({
  label,
  value,
  options,
  empty,
  onChange,
}: {
  label: string;
  value: T | null;
  options: readonly { id: T; label: string }[];
  /** Label of the « not assessed » choice; omit when a value is required. */
  empty?: string;
  onChange: (value: T | null) => void;
}) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => {
          const next = options.find((o) => o.id === e.target.value);
          onChange(next ? next.id : null);
        }}
      >
        {empty !== undefined ? <option value="">{empty}</option> : null}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="rating-form__check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/** A criterion as the form previews it: its measure and its score, live. */
function Measured({ criterion }: { criterion: CriterionScore | undefined }) {
  if (!criterion) return null;
  return (
    <p className="rating-form__measure">
      <span className="rating-form__measure-label">{CRITERION_LABELS[criterion.id]}</span>
      <span
        className={criterion.source === "estimate" ? "estimated" : undefined}
        title={criterion.source === "estimate" ? "Estimation KNX" : undefined}
      >
        {criterion.value ?? "—"}
      </span>
      <b>{criterion.score === null ? "écarté" : `${formatDecimal(criterion.score)}/5`}</b>
      {criterion.note ? <small>{criterion.note}</small> : null}
    </p>
  );
}

function Axis({
  axis,
  score,
  children,
}: {
  axis: RatingAxis;
  score: number | null;
  children: ReactNode;
}) {
  return (
    <fieldset className="rating-form__axis">
      <legend>
        <span>Axe {AXIS_LABELS[axis].toLowerCase()}</span>
        <b>{score === null ? "—" : `${formatDecimal(score)}/5`}</b>
      </legend>
      {children}
    </fieldset>
  );
}

/**
 * The operator's rating form. KNX fills the criteria it can read; the operator assesses the rest
 * and sees the category move as they go. Publishing freezes everything shown.
 */
export function RatingForm({
  company,
  asOf,
  onClose,
}: {
  company: CompanySeries;
  /** Date of the latest report: the data the rating rests on, and its date. */
  asOf: IsoDate;
  onClose: () => void;
}) {
  const { change } = useData();
  const id = useId();
  const [inputs, setInputs] = useState<RatingInputs>(EMPTY_INPUTS);
  const [district, setDistrict] = useState<District | null>(company.district);
  const assessment = useMemo(
    () => assessRating(company, inputs, district, asOf),
    [company, inputs, district, asOf],
  );
  const [outlook, setOutlook] = useState<RatingOutlook>(assessment.outlook);
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof RatingInputs>(key: K, value: RatingInputs[K]) =>
    setInputs((current) => ({ ...current, [key]: value }));
  const criterion = (cid: CriterionId) => assessment.criteria.find((c) => c.id === cid);
  const axisScore = (axis: RatingAxis) => assessment.axes.find((a) => a.id === axis)?.score ?? null;
  const tenders = inputs.tenders;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const { score, category } = assessment;
    if (score === null || category === null) {
      setError("Aucun axe évaluable : la notation ne peut pas être publiée.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await change(async (source) => {
        if (district !== company.district) await source.updateCompany(company.id, { district });
        await source.publishRating({
          companyId: company.id,
          date: asOf,
          method: RATING_METHOD.version,
          category,
          confidence: assessment.confidence,
          outlook,
          score,
          axes: assessment.axes,
          criteria: assessment.criteria,
          inputs,
          district,
          rationale: rationale.trim() || null,
        });
      });
      onClose();
    } catch (err) {
      setError(`Publication refusée : ${err instanceof Error ? err.message : String(err)}`);
      setBusy(false);
    }
  };

  const { category, confidence, score } = assessment;
  return (
    <form className="rating-form" onSubmit={submit} aria-labelledby={`${id}-title`}>
      <div className="section-head">
        <h2 id={`${id}-title`}>Noter {company.name}</h2>
        <p>
          méthode {RATING_METHOD.version}, données au relevé du <ImperialDate date={asOf} />
        </p>
      </div>

      <div className="rating-form__preview" aria-live="polite">
        {category ? (
          <RatingBadge category={category} confidence={confidence} size="lg" />
        ) : (
          <span className="rating-form__none">—</span>
        )}
        <div>
          <p className="rating-form__verdict">
            {category ? CATEGORY_INFO[category].label : "Non notable"}
            {score !== null ? <span> · {formatScore2(score)}/5</span> : null}
          </p>
          <p className="rating-form__detail">
            {category ? `${CATEGORY_INFO[category].meaning}.` : "Aucun axe évaluable."}
            {assessment.capped === "legality"
              ? " Plafonnée à Δ : irrégularité avérée."
              : assessment.capped === "coverage"
                ? ` Plafonnée à ß : grille évaluée à ${Math.round(assessment.coverage * 100)} %, il en faut ${Math.round(RATING_METHOD.fullCoverage * 100)} pour Ω ou α.`
                : ""}
          </p>
          <p className="rating-form__detail">
            {CONFIDENCE_INFO[confidence].label}
            {assessment.confidenceReasons.length > 0
              ? ` : ${assessment.confidenceReasons.join(" ; ")}`
              : ""}
          </p>
        </div>
      </div>

      <div className="rating-form__axes">
        <Axis axis="accounting" score={axisScore("accounting")}>
          <Measured criterion={criterion("growth")} />
          <Measured criterion={criterion("treasury")} />
          <Check
            label="Réserve justifiée par un plan d'investissement"
            checked={inputs.treasuryJustified}
            onChange={(v) => set("treasuryJustified", v)}
          />
          <Measured criterion={criterion("profitability")} />
          <Select
            label="Salaires"
            value={inputs.wages}
            options={WAGES}
            empty="Non évalués"
            onChange={(v) => set("wages", v)}
          />
        </Axis>

        <Axis axis="economic" score={axisScore("economic")}>
          <Measured criterion={criterion("team")} />
          <Select
            label="Publicité (AITL, matrice commerciale)"
            value={inputs.advertising}
            options={PRESENCE}
            empty="Non évaluée"
            onChange={(v) => set("advertising", v)}
          />
          <Check
            label="Spam publicitaire inconsidéré"
            checked={inputs.spam}
            onChange={(v) => set("spam", v)}
          />
          <div className="field">
            <span className="label">Intégration économique</span>
            <p className="rating-form__hint">
              {company.consortium
                ? `Consortium ${company.consortium.name} (fiche).`
                : "Aucun consortium sur la fiche."}
            </p>
            <Check
              label="Guilde"
              checked={inputs.integration.guild}
              onChange={(v) => set("integration", { ...inputs.integration, guild: v })}
            />
            <Check
              label="Chaîne logistique"
              checked={inputs.integration.logistics}
              onChange={(v) => set("integration", { ...inputs.integration, logistics: v })}
            />
            <Check
              label="Partenariats avec d'autres entreprises"
              checked={inputs.integration.partnerships}
              onChange={(v) => set("integration", { ...inputs.integration, partnerships: v })}
            />
            <Check
              label="Projets économiques collectifs"
              checked={inputs.integration.projects}
              onChange={(v) => set("integration", { ...inputs.integration, projects: v })}
            />
          </div>
        </Axis>

        <Axis axis="imperial" score={axisScore("imperial")}>
          <div className="rating-form__row">
            <label className="field">
              <span className="label">AO du secteur (5 derniers)</span>
              <select
                value={tenders?.held ?? 0}
                onChange={(e) => {
                  const held = Number(e.target.value);
                  set(
                    "tenders",
                    held > 0
                      ? {
                          held,
                          joined: Math.min(tenders?.joined ?? 0, held),
                          prices: tenders?.prices ?? "respected",
                        }
                      : null,
                  );
                }}
              >
                <option value={0}>Aucun organisé</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Participations</span>
              <select
                value={tenders?.joined ?? 0}
                disabled={!tenders}
                onChange={(e) =>
                  tenders && set("tenders", { ...tenders, joined: Number(e.target.value) })
                }
              >
                {Array.from({ length: (tenders?.held ?? 0) + 1 }, (_, n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {tenders ? (
            <Select
              label="Recommandations de prix"
              value={tenders.prices}
              options={[
                { id: "respected", label: "Respectées" },
                { id: "partly", label: "En partie respectées (−1)" },
                { id: "ignored", label: "Ignorées (−2)" },
              ]}
              onChange={(v) => v && set("tenders", { ...tenders, prices: v })}
            />
          ) : null}
          <div className="field">
            <span className="label">Légalité : irrégularités avérées</span>
            <Check
              label="Inscrite sur une liste noire"
              checked={inputs.legality.blacklist}
              onChange={(v) => set("legality", { ...inputs.legality, blacklist: v })}
            />
            <Check
              label="Emploie des acivis"
              checked={inputs.legality.acivis}
              onChange={(v) => set("legality", { ...inputs.legality, acivis: v })}
            />
            <Check
              label="Emploie des criminels recherchés"
              checked={inputs.legality.wanted}
              onChange={(v) => set("legality", { ...inputs.legality, wanted: v })}
            />
            <p className="rating-form__hint">
              Rien de coché : aucune irrégularité connue. Un doute ne vaut pas preuve.
            </p>
          </div>
          <label className="field">
            <span className="label">Quartier</span>
            <select
              value={district ?? ""}
              onChange={(e) => setDistrict(isDistrict(e.target.value) ? e.target.value : null)}
            >
              <option value="">Non renseigné</option>
              {(Object.keys(DISTRICT_LABELS) as District[]).map((d) => (
                <option key={d} value={d}>
                  {DISTRICT_LABELS[d]}
                </option>
              ))}
            </select>
          </label>
          <Select
            label="Vie impériale (Honoras, mondanités)"
            value={inputs.society}
            options={PRESENCE}
            empty="Non évaluée"
            onChange={(v) => set("society", v)}
          />
        </Axis>
      </div>

      <div className="rating-form__closing">
        <Select
          label="Transparence volontaire"
          value={inputs.transparency}
          options={TRANSPARENCY}
          onChange={(v) => set("transparency", v ?? "none")}
        />
        <Select
          label="Perspective"
          value={outlook}
          options={(Object.keys(OUTLOOK_LABELS) as RatingOutlook[]).map((o) => ({
            id: o,
            label: OUTLOOK_LABELS[o].replace(/^./, (c) => c.toUpperCase()),
          }))}
          onChange={(v) => v && setOutlook(v)}
        />
        <label className="field rating-form__rationale">
          <span className="label">Avis de l'Agence (facultatif)</span>
          <textarea
            rows={3}
            value={rationale}
            placeholder="Ce qui fonde la note, en quelques phrases."
            onChange={(e) => setRationale(e.target.value)}
          />
        </label>
      </div>

      {error ? (
        <p className="note note--error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="rating-form__actions">
        <button type="submit" className="button" disabled={busy || score === null}>
          {busy ? "Publication…" : "Publier la notation"}
        </button>
        <button type="button" className="button button--quiet" onClick={onClose} disabled={busy}>
          Annuler
        </button>
        <small className="rating-form__hint">
          Une notation publiée est figée : pour la corriger, la retirer puis noter à nouveau.
        </small>
      </div>
    </form>
  );
}
