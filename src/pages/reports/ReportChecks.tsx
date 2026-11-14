import { Amount, Change } from "../../components/figures.tsx";
import type { Evidence } from "../../domain/identity.ts";
import { formatImperialDate } from "../../domain/imperial.ts";
import { formatPercent } from "../../domain/numbers.ts";
import {
  refoundKey,
  renameKey,
  type IdentityChoices,
  type ReportReview,
} from "../../domain/review.ts";
import { list } from "./format.ts";

const EVIDENCE: Record<Evidence, string> = {
  name: "nom proche",
  chiffre: "CA",
  capital: "capital",
  employees: "effectif",
};

/** `nom proche · mêmes CA, capital et effectif` */
function evidenceText(evidence: readonly Evidence[]): string {
  const parts: string[] = [];
  if (evidence.includes("name")) parts.push(EVIDENCE.name);
  const figures = evidence.filter((e) => e !== "name").map((e) => EVIDENCE[e]);
  if (figures.length === 1) parts.push(`même ${figures[0]}`);
  if (figures.length > 1)
    parts.push(`mêmes ${figures.slice(0, -1).join(", ")} et ${figures.at(-1)}`);
  return parts.join(" · ");
}

/**
 * The checks shown before any report is published, typed by hand or sent by the in-game module:
 * who is new, who closes, likely renames and refoundings to confirm, suspicious figures and rank
 * disorder.
 */
export function ReportChecks({
  review,
  choices,
  onChoice,
  showClean,
}: {
  review: ReportReview;
  choices: IdentityChoices;
  onChoice: (key: string, value: boolean) => void;
  /** Say « no anomaly » when nothing is flagged (off while the report still has errors). */
  showClean: boolean;
}) {
  const { proposals, diff, created, closed } = review;
  const namesakes = new Map(proposals.namesakes.map((n) => [n.name, n.closedOn]));
  const clean =
    (diff?.outliers.length ?? 0) === 0 &&
    proposals.renames.length === 0 &&
    proposals.refoundings.length === 0;

  return (
    <>
      {!proposals.latest ? (
        <p className="note">
          Ce relevé est antérieur au dernier publié : ses lignes sont rattachées aux corporations
          ouvertes à cette date, sans fermeture ni renommage.
        </p>
      ) : null}
      <ul className="checks">
        <li>
          <span className="label">Nouvelles</span>
          <span>
            {created.length === 0
              ? "aucune"
              : list(
                  created.map((name) => {
                    const closedOn = namesakes.get(name);
                    return closedOn
                      ? `${name} (homonyme d'une corporation fermée le ${formatImperialDate(closedOn)} : nouvelle fiche)`
                      : name;
                  }),
                )}
          </span>
        </li>
        <li className={closed.length > 0 ? "is-warn" : undefined}>
          <span className="label">Fermetures</span>
          <span>
            {closed.length === 0
              ? "aucune"
              : `${closed.length} : ${list(closed)}. Une fermeture est définitive.`}
          </span>
        </li>
        {proposals.renames.length > 0 ? (
          <li className="is-warn">
            <span className="label">Renommages</span>
            <span className="choices">
              {proposals.renames.map((r) => (
                <label key={renameKey(r)} className="choice">
                  <input
                    type="checkbox"
                    checked={choices[renameKey(r)] ?? r.suggested}
                    onChange={(e) => onChoice(renameKey(r), e.target.checked)}
                  />
                  <span>
                    <strong>{r.from}</strong> devient <strong>{r.to}</strong>
                    <small>
                      {evidenceText(r.evidence)} · décoché : {r.from} fermée, {r.to} nouvelle
                    </small>
                  </span>
                </label>
              ))}
            </span>
          </li>
        ) : null}
        {proposals.refoundings.length > 0 ? (
          <li className="is-warn">
            <span className="label">Refondations</span>
            <span className="choices">
              {proposals.refoundings.map((r) => (
                <label key={refoundKey(r)} className="choice">
                  <input
                    type="checkbox"
                    checked={choices[refoundKey(r)] ?? true}
                    onChange={(e) => onChoice(refoundKey(r), e.target.checked)}
                  />
                  <span>
                    <strong>{r.name}</strong> a fermé puis rouvert sous le même nom : nouvelle
                    fiche, historique repris à zéro
                    <small>
                      CA <Amount value={r.before.chiffre} unit={false} /> →{" "}
                      <Amount value={r.after.chiffre} unit={false} />
                      {r.before.capital !== null && r.after.capital !== null ? (
                        <>
                          {" "}
                          · capital <Amount value={r.before.capital} unit={false} /> →{" "}
                          <Amount value={r.after.capital} unit={false} />
                        </>
                      ) : null}
                    </small>
                  </span>
                </label>
              ))}
            </span>
          </li>
        ) : null}
        {diff && diff.outliers.length > 0 ? (
          <li className="is-warn">
            <span className="label">À vérifier</span>
            <span>
              {diff.outliers.map((o) => (
                <span key={`${o.name}-${o.field}`} className="outlier">
                  <strong>{o.name}</strong> · {o.field === "chiffre" ? "chiffre" : "capital"}{" "}
                  <Amount value={o.before} unit={false} /> → <Amount value={o.after} unit={false} />{" "}
                  <Change ratio={o.ratio} />
                  <small>{o.reason}</small>
                </span>
              ))}
            </span>
          </li>
        ) : null}
        {diff && diff.rankMismatches.length > 0 ? (
          <li className="is-warn">
            <span className="label">Rangs</span>
            <span>Ordre incohérent avec le chiffre pour {diff.rankMismatches.join(", ")}.</span>
          </li>
        ) : null}
      </ul>
      {showClean && diff && clean ? (
        <p className="note note--ok">
          Aucune anomalie détectée. Variation moyenne du chiffre :{" "}
          {formatPercent(review.averageChange)}.
        </p>
      ) : null}
    </>
  );
}
