import { useState } from "react";
import { Link } from "react-router";
import { formatScore, formatShare } from "../domain/numbers.ts";
import { REGIMES, regimeOf, squarify, type MapTile, type Rect } from "../domain/regimes.ts";
import { useElementWidth } from "../hooks/useElementWidth.ts";
import { useFocus } from "../hooks/focus.tsx";
import { groupColor, Score, Trend } from "./figures.tsx";
import "./TimeChart.css";
import "./MarketMap.css";

/**
 * Diverging wash for a dynamics score: green above zero, red below, deeper with the magnitude,
 * neutral lacquer near zero. Always paired with a signed value in the tile or its tooltip.
 */
function dynamicsColor(dynamics: number | null): string {
  if (dynamics === null || Math.abs(dynamics) < 0.05) return "var(--laque-3)";
  const share = Math.round(12 + 32 * Math.min(1, Math.abs(dynamics)));
  const ink = dynamics > 0 ? "var(--hausse)" : "var(--baisse)";
  return `color-mix(in srgb, ${ink} ${share}%, var(--laque-2))`;
}

const regimeLabel = (tile: MapTile) => {
  if (tile.kind === "others") return "Autres corporations";
  const id = regimeOf(tile.company.scores);
  return REGIMES.find((r) => r.id === id)?.label ?? "Régime indéterminé";
};

/** Room for the name, then for the figures under it. */
const fitsName = (r: Rect<MapTile>) => r.w >= 64 && r.h >= 30;
const fitsFigures = (r: Rect<MapTile>) => r.w >= 92 && r.h >= 52;

/**
 * Treemap of the market: each company's area is its share of the market's revenue over the last
 * 30 days, its colour its dynamics. Hover or focus lights the company up across the page.
 */
export function MarketMap({ tiles, height = 440 }: { tiles: MapTile[]; height?: number }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const { focused, setFocused } = useFocus();
  const [hover, setHover] = useState<Rect<MapTile> | null>(null);
  const rects = width > 0 ? squarify(tiles, (t) => t.weight, width, height) : [];

  const enter = (rect: Rect<MapTile>) => {
    setHover(rect);
    if (rect.item.kind === "company") setFocused(rect.item.company.slug);
  };
  const leave = () => {
    setHover(null);
    setFocused(null);
  };

  return (
    <div ref={ref} className="map" style={{ height }}>
      {rects.map((rect) => {
        const { item } = rect;
        const style = {
          left: rect.x + 1,
          top: rect.y + 1,
          width: Math.max(0, rect.w - 2),
          height: Math.max(0, rect.h - 2),
        };
        if (item.kind === "others") {
          return (
            <div
              key="others"
              className={`map__tile map__tile--others${focused ? " is-dim" : ""}`}
              style={style}
              tabIndex={0}
              aria-label={`${item.companies.length} autres corporations, ${formatShare(item.weight)} des recettes`}
              onPointerEnter={() => enter(rect)}
              onPointerLeave={leave}
              onFocus={() => enter(rect)}
              onBlur={leave}
            >
              {fitsName(rect) ? (
                <span className="map__name">Autres · {item.companies.length}</span>
              ) : null}
              {fitsFigures(rect) ? (
                <span className="map__figures">{formatShare(item.weight)}</span>
              ) : null}
            </div>
          );
        }
        const { company } = item;
        const isFocused = focused === company.slug;
        const dim = focused !== null && !isFocused;
        return (
          <Link
            key={company.slug}
            to={`/corporations/${company.slug}`}
            className={`map__tile${isFocused ? " is-focused" : ""}${dim ? " is-dim" : ""}`}
            style={{ ...style, background: dynamicsColor(company.scores.dynamics) }}
            aria-label={`${company.name} : ${formatShare(item.weight)} des recettes, ${regimeLabel(item).toLowerCase()}`}
            onPointerEnter={() => enter(rect)}
            onPointerLeave={leave}
            onFocus={() => enter(rect)}
            onBlur={leave}
          >
            {company.consortium ? (
              <i className="map__band" style={{ background: groupColor(company.consortium) }} />
            ) : null}
            {fitsName(rect) ? <span className="map__name">{company.name}</span> : null}
            {fitsFigures(rect) ? (
              <span className="map__figures">
                {formatShare(item.weight)}
                {company.scores.dynamics !== null ? (
                  // Text inside a coloured fill stays ivory: the triangle and sign carry direction.
                  <span className="map__score">
                    {Math.round(company.scores.dynamics * 100) !== 0 ? (
                      <Trend up={company.scores.dynamics > 0} />
                    ) : null}
                    {formatScore(company.scores.dynamics)}
                  </span>
                ) : null}
              </span>
            ) : null}
          </Link>
        );
      })}
      {hover ? <MapTip rect={hover} width={width} height={height} /> : null}
    </div>
  );
}

function MapTip({ rect, width, height }: { rect: Rect<MapTile>; width: number; height: number }) {
  const { item } = rect;
  const below = rect.y + rect.h + 150 < height;
  const style = {
    left: Math.max(0, Math.min(rect.x + rect.w / 2 - 115, width - 240)),
    top: below ? rect.y + rect.h + 6 : rect.y - 6,
    transform: below ? undefined : "translateY(-100%)",
  };
  return (
    <div className="chart__tip map__tip" style={style} aria-hidden="true">
      <p className="chart__tip-date">{regimeLabel(item)}</p>
      {item.kind === "company" ? (
        <>
          <p className="map__tip-name">{item.company.name}</p>
          <p className="is-estimate">
            <i />
            <span>Poids économique</span>
            <b>{formatShare(item.weight)}</b>
          </p>
          <p>
            <i />
            <span>Dynamique</span>
            <b>
              <Score value={item.company.scores.dynamics} />
            </b>
          </p>
          <p>
            <i />
            <span>Activité</span>
            <b>
              <Score value={item.company.scores.activity} />
            </b>
          </p>
        </>
      ) : (
        <>
          <p className="is-estimate">
            <i />
            <span>Poids cumulé</span>
            <b>{formatShare(item.weight)}</b>
          </p>
          <p className="map__tip-list">
            {item.companies
              .slice(0, 10)
              .map((c) => c.name)
              .join(", ")}
            {item.companies.length > 10 ? ` et ${item.companies.length - 10} autres` : ""}
          </p>
        </>
      )}
    </div>
  );
}

/** Colour key of the map: dynamics from −100 to +100. */
export function DynamicsKey() {
  const steps = [-1, -0.5, 0, 0.5, 1];
  return (
    <span className="map-key">
      <span className="map-key__end">−100</span>
      {steps.map((s) => (
        <i key={s} style={{ background: dynamicsColor(s) }} aria-hidden="true" />
      ))}
      <span className="map-key__end">+100</span>
    </span>
  );
}
