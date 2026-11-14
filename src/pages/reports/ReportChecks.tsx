import { Amount, Change } from "../../components/figures.tsx";
import type { ReportDiff } from "../../domain/diff.ts";
import { formatPercent } from "../../domain/numbers.ts";
import { list } from "./format.ts";

/**
 * The checks shown before any report is published, typed by hand or sent by the in-game module:
 * newcomers, absentees, likely renames, suspicious figures and rank disorder.
 */
export function ReportChecks({
  diff,
  averageChange,
  showClean,
}: {
  diff: ReportDiff;
  averageChange: number;
  /** Say « no anomaly » when nothing is flagged (off while the report still has errors). */
  showClean: boolean;
}) {
  return (
    <>
      <ul className="checks">
        <li>
          <span className="label">Nouvelles</span>
          <span>{list(diff.newcomers)}</span>
        </li>
        <li className={diff.missing.length > 5 ? "is-warn" : undefined}>
          <span className="label">Absentes</span>
          <span>
            {diff.missing.length === 0
              ? "aucune"
              : `${diff.missing.length} : ${list(diff.missing)} (seront marquées radiées)`}
          </span>
        </li>
        {diff.renames.length > 0 ? (
          <li className="is-warn">
            <span className="label">Renommages ?</span>
            <span>{diff.renames.map((r) => `${r.from} → ${r.to}`).join(" · ")}</span>
          </li>
        ) : null}
        {diff.outliers.length > 0 ? (
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
        {diff.rankMismatches.length > 0 ? (
          <li className="is-warn">
            <span className="label">Rangs</span>
            <span>Ordre incohérent avec le chiffre pour {diff.rankMismatches.join(", ")}.</span>
          </li>
        ) : null}
      </ul>
      {showClean && diff.outliers.length === 0 && diff.renames.length === 0 ? (
        <p className="note note--ok">
          Aucune anomalie détectée. Variation moyenne du chiffre : {formatPercent(averageChange)}.
        </p>
      ) : null}
    </>
  );
}
