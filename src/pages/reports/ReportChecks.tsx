import { Amount, Change } from "../../components/figures.tsx";
import type { Evidence } from "../../domain/identity.ts";
import { formatImperialDate } from "../../domain/imperial.ts";
import { formatPercent } from "../../domain/numbers.ts";
import {
  linkKey,
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
 * The checks shown before a report sent by the in-game module is published: who is new, who
 * closes, likely renames and refoundings to confirm, suspicious figures and rank disorder.
 */
export function ReportChecks({
  review,
  choices,
  onChoice,
}: {
  review: ReportReview;
  choices: IdentityChoices;
  onChoice: (key: string, value: boolean) => void;
}) {
  const { proposals, diff, created, closed } = review;
  const namesakes = new Set(proposals.namesakes.map((n) => n.name));
  const refounded = new Set(proposals.refoundings.map((r) => r.name));
  // Lives opened on an existing page are listed with their choice, not as new corporations.
  const fresh = created.filter((name) => !namesakes.has(name) && !refounded.has(name));
  const clean =
    (diff?.outliers.length ?? 0) === 0 &&
    proposals.renames.length === 0 &&
    proposals.refoundings.length === 0 &&
    proposals.namesakes.length === 0;

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
          <span>{fresh.length === 0 ? "aucune" : list(fresh)}</span>
        </li>
        <li className={closed.length > 0 ? "is-warn" : undefined}>
          <span className="label">Fermetures</span>
          <span>
            {closed.length === 0
              ? "aucune"
              : `${closed.length} : ${list(closed)}. Une vie fermée ne rouvre pas ; une refondation ouvre une nouvelle vie sur la même fiche.`}
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
                    <strong>{r.name}</strong> a été détruite puis refondée : même fiche, nouvelle
                    vie (âge et CA moyen repartent de zéro)
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
        {proposals.namesakes.length > 0 ? (
          <li className="is-warn">
            <span className="label">Retours</span>
            <span className="choices">
              {proposals.namesakes.map((n) => (
                <label key={linkKey(n)} className="choice">
                  <input
                    type="checkbox"
                    checked={choices[linkKey(n)] ?? true}
                    onChange={(e) => onChoice(linkKey(n), e.target.checked)}
                  />
                  <span>
                    <strong>{n.name}</strong> revient : rattachée à la fiche de la corporation
                    fermée le {formatImperialDate(n.closedOn)}, nouvelle vie (âge et CA moyen
                    repartent de zéro)
                    <small>décoché : corporation distincte, nouvelle fiche</small>
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
      {diff && clean ? (
        <p className="note note--ok">
          Aucune anomalie détectée. Variation moyenne du chiffre :{" "}
          {formatPercent(review.averageChange)}.
        </p>
      ) : null}
    </>
  );
}
