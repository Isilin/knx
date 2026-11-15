import { scaleLinear } from "d3-scale";
import { useState } from "react";
import type { SectorTrail } from "../domain/groupHistory.ts";
import { formatImperialDate } from "../domain/imperial.ts";
import { formatShare } from "../domain/numbers.ts";
import { sectorShort, type SectorId } from "../domain/sectors.ts";
import { useElementWidth } from "../hooks/useElementWidth.ts";
import { Score } from "./figures.tsx";
import "./TimeChart.css";
import "./RegimeChart.css";
import "./SectorRegimeChart.css";

const MARGIN = { top: 28, right: 12, bottom: 34, left: 40 };
const X_DOMAIN: [number, number] = [-1.14, 1.14];
const Y_DOMAIN: [number, number] = [-1.32, 1.32];
const TICKS = [-1, -0.5, 0, 0.5, 1];
const tick = (t: number) => (t === 0 ? "0" : t > 0 ? `+${t * 100}` : `−${-t * 100}`);

/**
 * The sectors on the regime plane (median activity across, median dynamics up), each with the
 * path it took over the sampled reports: the bubble is where it stands today, sized by its share
 * of the market. No colour per sector: the names are written on the plane.
 */
export function SectorRegimeChart({
  trails,
  height = 460,
}: {
  trails: readonly SectorTrail[];
  height?: number;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [focus, setFocus] = useState<SectorId | null>(null);
  const innerWidth = Math.max(120, width - MARGIN.left - MARGIN.right);
  const x = scaleLinear()
    .domain(X_DOMAIN)
    .range([MARGIN.left, MARGIN.left + innerWidth]);
  const y = scaleLinear()
    .domain(Y_DOMAIN)
    .range([height - MARGIN.bottom, MARGIN.top]);
  const left = x(X_DOMAIN[0]);
  const right = x(X_DOMAIN[1]);
  const top = y(Y_DOMAIN[1]);
  const bottom = y(Y_DOMAIN[0]);

  const placed = trails
    .map((trail) => ({
      trail,
      path: trail.points.filter((p) => p.activity !== null && p.dynamics !== null),
    }))
    .filter((t) => t.path.length > 0 && t.path.at(-1)?.date === t.trail.points.at(-1)?.date);
  const maxShare = Math.max(0.0001, ...placed.map((t) => t.path.at(-1)?.share ?? 0));
  const hovered = placed.find((t) => t.trail.sector === focus) ?? null;

  return (
    <div ref={ref} className="chart regime sector-regime">
      <svg
        width={width}
        height={height}
        style={{ display: "block" }}
        role="img"
        aria-label={`Régimes des secteurs, activité médiane face à dynamique médiane : ${placed
          .map((t) => {
            const last = t.path.at(-1)!;
            return `${t.trail.label} ${tick(Math.round((last.activity ?? 0) * 100) / 100)} / ${tick(Math.round((last.dynamics ?? 0) * 100) / 100)}`;
          })
          .join(", ")}.`}
      >
        <g className="chart__grid">
          {TICKS.map((t) => (
            <g key={t}>
              <line
                x1={x(t)}
                x2={x(t)}
                y1={top}
                y2={bottom}
                className={t === 0 ? "regime__axis" : undefined}
              />
              <line
                x1={left}
                x2={right}
                y1={y(t)}
                y2={y(t)}
                className={t === 0 ? "regime__axis" : undefined}
              />
              <text x={x(t)} y={height - MARGIN.bottom + 16} textAnchor="middle">
                {tick(t)}
              </text>
              <text x={MARGIN.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                {tick(t)}
              </text>
            </g>
          ))}
        </g>
        <g className="regime__quadrants" aria-hidden="true">
          <text x={right - 8} y={top + 16} textAnchor="end">
            En essor
          </text>
          <text x={left + 8} y={top + 16}>
            En reprise
          </text>
          <text x={right - 8} y={bottom - 10} textAnchor="end">
            En essoufflement
          </text>
          <text x={left + 8} y={bottom - 10}>
            En déclin
          </text>
        </g>
        <g className="regime__titles" aria-hidden="true">
          <text x={MARGIN.left} y={14}>
            Dynamique médiane ↑
          </text>
          <text x={right} y={height - 4} textAnchor="end">
            Activité médiane →
          </text>
        </g>
        {placed.map(({ trail, path }) => {
          const last = path[path.length - 1];
          const cx = x(last.activity ?? 0);
          const cy = y(last.dynamics ?? 0);
          const r = 5 + 15 * Math.sqrt((last.share ?? 0) / maxShare);
          const dim = focus !== null && focus !== trail.sector;
          const strong = focus === trail.sector;
          return (
            <g
              key={trail.sector}
              className={`sector-regime__trail${dim ? " is-dim" : ""}${strong ? " is-strong" : ""}`}
              onPointerEnter={() => setFocus(trail.sector)}
              onPointerLeave={() => setFocus(null)}
            >
              <polyline
                className="sector-regime__path"
                points={path.map((p) => `${x(p.activity ?? 0)},${y(p.dynamics ?? 0)}`).join(" ")}
              />
              {path.length > 1 ? (
                <polyline
                  className="sector-regime__tail"
                  points={path
                    .slice(-2)
                    .map((p) => `${x(p.activity ?? 0)},${y(p.dynamics ?? 0)}`)
                    .join(" ")}
                />
              ) : null}
              {path.slice(0, -1).map((p, index) => (
                <circle
                  key={p.date}
                  className="sector-regime__step"
                  cx={x(p.activity ?? 0)}
                  cy={y(p.dynamics ?? 0)}
                  r={1.5 + (2 * index) / Math.max(1, path.length - 1)}
                />
              ))}
              <circle className="sector-regime__dot" cx={cx} cy={cy} r={r} />
              <text
                className="sector-regime__label"
                x={cx + (cx > right - 90 ? -(r + 4) : r + 4)}
                y={cy}
                dy="0.32em"
                textAnchor={cx > right - 90 ? "end" : "start"}
              >
                {sectorShort(trail.sector)}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="sector-regime__legend" aria-label="Montrer le chemin d'un secteur">
        {placed.map(({ trail }) => (
          <li key={trail.sector}>
            <button
              type="button"
              aria-pressed={focus === trail.sector}
              onPointerEnter={() => setFocus(trail.sector)}
              onPointerLeave={() => setFocus(null)}
              onFocus={() => setFocus(trail.sector)}
              onBlur={() => setFocus(null)}
            >
              {trail.label}
            </button>
          </li>
        ))}
      </ul>
      {hovered ? (
        <div
          className="chart__tip map__tip"
          style={{
            left: Math.max(0, Math.min(x(hovered.path.at(-1)?.activity ?? 0) + 24, width - 250)),
            top: Math.max(0, Math.min(y(hovered.path.at(-1)?.dynamics ?? 0) - 20, height - 170)),
          }}
          aria-hidden="true"
        >
          <p className="chart__tip-date">depuis le {formatImperialDate(hovered.path[0].date)}</p>
          <p className="map__tip-name">{hovered.trail.label}</p>
          <p>
            <i />
            <span>Activité médiane</span>
            <b>
              <Score value={hovered.path[0].activity} /> →{" "}
              <Score value={hovered.path.at(-1)!.activity} />
            </b>
          </p>
          <p>
            <i />
            <span>Dynamique médiane</span>
            <b>
              <Score value={hovered.path[0].dynamics} /> →{" "}
              <Score value={hovered.path.at(-1)!.dynamics} />
            </b>
          </p>
          <p className="is-estimate">
            <i />
            <span>Part du marché</span>
            <b>
              {hovered.path.at(-1)?.share == null ? "—" : formatShare(hovered.path.at(-1)!.share!)}
            </b>
          </p>
        </div>
      ) : null}
    </div>
  );
}
