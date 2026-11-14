import { Link } from "react-router";
import { ratingDistribution, recentRatings } from "../domain/agency.ts";
import type { Market } from "../domain/market.ts";
import { formatScore2 } from "../domain/numbers.ts";
import { CATEGORY_INFO } from "../domain/rating.ts";
import { ImperialDate, Trend } from "./figures.tsx";
import { RatingBadge } from "./RatingBadge.tsx";
import "./AgencyOverview.css";

/**
 * The Agence impériale de notation on the market page: how the cote is rated, the latest ratings
 * and those under watch. Shown once the Agence has rated someone.
 */
export function AgencyOverview({ market }: { market: Market }) {
  const distribution = ratingDistribution(market.companies);
  if (distribution.rated === 0) return null;
  const moves = recentRatings(market, 6);
  const watched = market.companies.filter((c) => c.status !== "delisted" && c.watch?.watched);
  const highest = Math.max(1, ...distribution.categories.map((c) => c.count));

  return (
    <section className="market__agency" aria-labelledby="agence">
      <div className="section-head">
        <h2 id="agence">Agence impériale de notation</h2>
        <p>
          {distribution.rated} corporation{distribution.rated > 1 ? "s" : ""} notée
          {distribution.rated > 1 ? "s" : ""} sur {distribution.rated + distribution.unrated} cotées
        </p>
      </div>
      <div className="agency">
        <div className="agency__spread">
          <h3 className="label">Répartition des notes</h3>
          <ol className="agency__bars">
            {distribution.categories.map(({ category, count }) => (
              <li key={category}>
                <span className="agency__count">{count}</span>
                <span className="agency__bar" aria-hidden="true">
                  <span style={{ height: `${(count / highest) * 100}%` }} />
                </span>
                <RatingBadge category={category} confidence="standard" size="sm" />
                <span className="sr-only">
                  {CATEGORY_INFO[category].label} : {count} corporation{count > 1 ? "s" : ""}
                </span>
              </li>
            ))}
          </ol>
          <p className="agency__note">
            {distribution.unrated} corporation{distribution.unrated > 1 ? "s" : ""} pas encore notée
            {distribution.unrated > 1 ? "s" : ""}. Dernière note de chaque corporation cotée.
          </p>
        </div>

        <div className="agency__moves">
          <h3 className="label">Dernières notations</h3>
          <ol>
            {moves.map(({ company, rating, move }) => (
              <li key={rating.id}>
                <ImperialDate date={rating.date} />
                <RatingBadge category={rating.category} confidence={rating.confidence} size="sm" />
                <span className="agency__who">
                  <Link to={`/corporations/${company.slug}#notation`}>{company.name}</Link>
                  <small>
                    {move.up !== null ? (
                      <span className={`change change--${move.up ? "up" : "down"}`}>
                        <Trend up={move.up} />
                      </span>
                    ) : null}{" "}
                    {move.text} · {formatScore2(rating.score)}/5
                  </small>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="agency__watch">
          <h3 className="label">Sous surveillance</h3>
          {watched.length > 0 ? (
            <ul>
              {watched.map((c) => (
                <li key={c.slug}>
                  <span className="agency__mark" aria-hidden="true" />
                  <span className="agency__who">
                    <Link to={`/corporations/${c.slug}#notation`}>{c.name}</Link>
                    <small>{c.watch?.reasons.find((r) => r.kind !== "stale")?.text}</small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="agency__note">
              Aucune note sous surveillance : rien n'a bougé depuis les dernières notations.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
