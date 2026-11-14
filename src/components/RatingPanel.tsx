import { useState } from "react";
import { useData } from "../data/DataProvider.tsx";
import { formatDecimal, formatScore2 } from "../domain/numbers.ts";
import {
  AXIS_LABELS,
  CATEGORY_INFO,
  CONFIDENCE_INFO,
  CRITERION_LABELS,
  OUTLOOK_LABELS,
  ratingMove,
  type CompanyRating,
  type CriterionScore,
  type RatingAxis,
} from "../domain/rating.ts";
import { ImperialDate, Trend } from "./figures.tsx";
import { RatingBadge } from "./RatingBadge.tsx";
import "./RatingPanel.css";

const AXES: readonly RatingAxis[] = ["accounting", "economic", "imperial"];

const SOURCE_LABELS: Record<CriterionScore["source"], { label: string; title: string }> = {
  report: { label: "relevé", title: "Lu dans le rapport « Corporations » du jeu" },
  estimate: { label: "KNX", title: "Calculé par KNX à partir des relevés" },
  agency: { label: "Agence", title: "Apprécié par l'Agence" },
};

/** A 0–5 score as a figure and a thin bar. */
function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return <span className="rating-score rating-score--none">écarté</span>;
  return (
    <span className="rating-score">
      <span className="rating-score__track" aria-hidden="true">
        <span style={{ width: `${(score / 5) * 100}%` }} />
      </span>
      <span>
        {formatDecimal(score)}
        <span className="amount__unit">/5</span>
      </span>
    </span>
  );
}

function HistoryRow({
  rating,
  previous,
  isAdmin,
}: {
  rating: CompanyRating;
  previous: CompanyRating | null;
  isAdmin: boolean;
}) {
  const { change } = useData();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const move = ratingMove(rating, previous);
  const withdraw = async () => {
    setError(null);
    try {
      await change((source) => source.deleteRating(rating.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  return (
    <li>
      <ImperialDate date={rating.date} />
      <RatingBadge category={rating.category} confidence={rating.confidence} size="sm" />
      <span className="rating-history__move">
        {move.up !== null ? (
          <span className={`change change--${move.up ? "up" : "down"}`}>
            <Trend up={move.up} />
          </span>
        ) : null}
        {move.text} · {formatScore2(rating.score)}/5 · perspective {OUTLOOK_LABELS[rating.outlook]}
      </span>
      {isAdmin ? (
        <span className="rating-history__tools">
          {confirming ? (
            <>
              <button type="button" className="linklike rating-history__danger" onClick={withdraw}>
                confirmer le retrait
              </button>
              <button type="button" className="linklike" onClick={() => setConfirming(false)}>
                garder
              </button>
            </>
          ) : (
            <button type="button" className="linklike" onClick={() => setConfirming(true)}>
              retirer
            </button>
          )}
          {error ? <span className="rating-history__danger">{error}</span> : null}
        </span>
      ) : null}
    </li>
  );
}

/** The Agence's latest rating of a corporation, criterion by criterion, and its history. */
export function RatingPanel({
  ratings,
  isAdmin,
}: {
  /** Oldest first; at least one. */
  ratings: readonly CompanyRating[];
  isAdmin: boolean;
}) {
  const latest = ratings[ratings.length - 1];
  const info = CATEGORY_INFO[latest.category];
  const newestFirst = [...ratings].reverse();
  return (
    <div className="rating">
      <div className="rating__summary">
        <RatingBadge category={latest.category} confidence={latest.confidence} size="lg" />
        <div className="rating__verdict">
          <p className="rating__title">
            {info.label}
            <span> · {formatScore2(latest.score)}/5</span>
          </p>
          <p>{info.meaning}.</p>
          <p className="rating__meta">
            {CONFIDENCE_INFO[latest.confidence].label} · perspective{" "}
            {OUTLOOK_LABELS[latest.outlook]} · avis du <ImperialDate date={latest.date} /> · méthode{" "}
            {latest.method}
          </p>
          {latest.rationale ? <p className="rating__rationale">{latest.rationale}</p> : null}
        </div>
      </div>

      <div className="rating__axes">
        {AXES.map((axis) => {
          const axisScore = latest.axes.find((a) => a.id === axis)?.score ?? null;
          return (
            <section key={axis} className="rating-axis" aria-label={`Axe ${AXIS_LABELS[axis]}`}>
              <h3 className="rating-axis__head">
                <span>{AXIS_LABELS[axis]}</span>
                <ScoreBar score={axisScore} />
              </h3>
              <dl>
                {latest.criteria
                  .filter((c) => c.axis === axis)
                  .map((c) => (
                    <div key={c.id} className="rating-criterion">
                      <dt>
                        {CRITERION_LABELS[c.id]}
                        <span
                          className="rating-criterion__source"
                          title={SOURCE_LABELS[c.source].title}
                        >
                          {SOURCE_LABELS[c.source].label}
                        </span>
                      </dt>
                      <dd className="rating-criterion__value">
                        <span
                          className={c.source === "estimate" && c.value ? "estimated" : undefined}
                          title={c.source === "estimate" ? "Estimation KNX" : undefined}
                        >
                          {c.value ?? "—"}
                        </span>
                        {c.note ? <small>{c.note}</small> : null}
                      </dd>
                      <dd className="rating-criterion__score">
                        <ScoreBar score={c.score} />
                      </dd>
                    </div>
                  ))}
              </dl>
            </section>
          );
        })}
      </div>

      <div className="rating-history">
        <h3 className="label">Historique des notations</h3>
        <ol>
          {newestFirst.map((rating, index) => (
            <HistoryRow
              key={rating.id}
              rating={rating}
              previous={newestFirst[index + 1] ?? null}
              isAdmin={isAdmin}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}
