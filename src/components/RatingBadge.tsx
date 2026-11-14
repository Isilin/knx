import {
  CATEGORY_INFO,
  CONFIDENCE_INFO,
  type RatingCategory,
  type RatingConfidence,
} from "../domain/rating.ts";
import "./RatingBadge.css";

/**
 * The Agence's mark: category symbol in its colour, confidence sign beside it, inside a framed
 * cartouche so the colour never stands alone.
 */
export function RatingBadge({
  category,
  confidence,
  size = "md",
  title,
}: {
  category: RatingCategory;
  confidence: RatingConfidence;
  size?: "sm" | "md" | "lg";
  title?: string;
}) {
  const info = CATEGORY_INFO[category];
  const sign = CONFIDENCE_INFO[confidence].sign;
  const label = `${info.label}${sign ? ` ${sign === "+" ? "plus" : "moins"}` : ""}, ${CONFIDENCE_INFO[confidence].label}`;
  return (
    <span
      className={`rating-badge rating-badge--${size} rating-badge--${category}`}
      title={title ?? `${info.label} : ${info.meaning}. ${CONFIDENCE_INFO[confidence].label}.`}
      role="img"
      aria-label={label}
    >
      <span className="rating-badge__symbol" aria-hidden="true">
        {info.symbol}
      </span>
      {sign ? (
        <span className="rating-badge__sign" aria-hidden="true">
          {sign}
        </span>
      ) : null}
    </span>
  );
}
