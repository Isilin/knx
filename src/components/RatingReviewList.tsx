import { Link } from "react-router";
import type { Market } from "../domain/market.ts";
import { ImperialDate } from "./figures.tsx";
import { RatingBadge } from "./RatingBadge.tsx";
import "./RatingReviewList.css";

/**
 * The operator's to-do for the Agence: ratings under watch first, then those over a quarter old,
 * oldest first; and how many listed corporations were never rated.
 */
export function RatingReviewList({ market }: { market: Market }) {
  const due = market.companies
    .filter((c) => c.rating && (c.watch?.watched || c.watch?.stale))
    .sort(
      (a, b) =>
        Number(b.watch?.watched) - Number(a.watch?.watched) ||
        (a.rating?.date ?? "").localeCompare(b.rating?.date ?? ""),
    );
  const unrated = market.companies.filter((c) => c.status === "active" && !c.rating).length;

  return (
    <section className="rating-review" aria-labelledby="notations-a-revoir">
      <div className="section-head">
        <h2 id="notations-a-revoir">Notations à revoir</h2>
        <p>
          {due.length} à revoir · {unrated} active{unrated > 1 ? "s" : ""} jamais notée
          {unrated > 1 ? "s" : ""}
        </p>
      </div>
      {due.length > 0 ? (
        <ul>
          {due.map((c) => {
            const reason = c.watch?.reasons.find((r) => r.kind !== "stale") ?? c.watch?.reasons[0];
            return (
              <li key={c.slug}>
                {c.rating ? (
                  <RatingBadge
                    category={c.rating.category}
                    confidence={c.rating.confidence}
                    size="sm"
                  />
                ) : null}
                <span className="rating-review__who">
                  <Link to={`/corporations/${c.slug}#notation`}>{c.name}</Link>
                  <small>
                    <span className={c.watch?.watched ? "rating-review__watch" : undefined}>
                      {c.watch?.watched ? "Sous surveillance" : "À revoir"}
                    </span>{" "}
                    · notée le {c.rating ? <ImperialDate date={c.rating.date} /> : null}
                  </small>
                  {reason ? <small>{reason.text}</small> : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rating-review__empty">
          Toutes les notations publiées sont à jour : rien n'a bougé depuis, et aucune n'a plus d'un
          trimestre.
        </p>
      )}
    </section>
  );
}
