import { scaleLinear } from "d3-scale";
import { useState, type PointerEvent } from "react";
import type { CompanySeries } from "../domain/market.ts";
import { formatShare } from "../domain/numbers.ts";
import { REGIMES, regimeOf } from "../domain/regimes.ts";
import { useElementWidth } from "../hooks/useElementWidth.ts";
import { useFocus } from "../hooks/focus.tsx";
import { groupColor, Score } from "./figures.tsx";
import "./TimeChart.css";
import "./RegimeChart.css";

const MARGIN = { top: 28, right: 12, bottom: 34, left: 40 };
/**
 * Scores live in −1…1; the padding keeps a bubble at the edge whole. Dynamics often saturates at
 * ±1, so the vertical padding is wider: the quadrant names sit in the corners, clear of bubbles.
 */
const X_DOMAIN: [number, number] = [-1.14, 1.14];
const Y_DOMAIN: [number, number] = [-1.32, 1.32];
const TICKS = [-1, -0.5, 0, 0.5, 1];
const LABEL_CHAR = 6.4;

interface Dot {
  company: CompanySeries;
  x: number;
  y: number;
  r: number;
}

interface Label {
  slug: string;
  text: string;
  x: number;
  y: number;
  anchor: "start" | "end";
}

const tick = (t: number) => (t === 0 ? "0" : t > 0 ? `+${t * 100}` : `−${-t * 100}`);

/**
 * Activity (x) against dynamics (y), one bubble per company sized by its economic weight. The
 * four quadrants are the four regimes.
 */
export function RegimeChart({
  companies,
  pinned = [],
  height = 440,
}: {
  companies: CompanySeries[];
  pinned?: readonly string[];
  height?: number;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const { focused, setFocused } = useFocus();
  const [hover, setHover] = useState<Dot | null>(null);

  const placed = companies.filter((c) => c.scores.activity !== null && c.scores.dynamics !== null);
  const innerWidth = Math.max(120, width - MARGIN.left - MARGIN.right);
  const x = scaleLinear()
    .domain(X_DOMAIN)
    .range([MARGIN.left, MARGIN.left + innerWidth]);
  const y = scaleLinear()
    .domain(Y_DOMAIN)
    .range([height - MARGIN.bottom, MARGIN.top]);
  const maxWeight = Math.max(0.0001, ...placed.map((c) => c.scores.weight ?? 0));
  const dots: Dot[] = placed
    .map((company) => ({
      company,
      x: x(company.scores.activity ?? 0),
      y: y(company.scores.dynamics ?? 0),
      // Area follows the weight; 4 px keeps the smallest bubble visible and hoverable.
      r: 4 + 16 * Math.sqrt((company.scores.weight ?? 0) / maxWeight),
    }))
    .sort((a, b) => b.r - a.r);

  /** Whether a label box would cover a bubble other than its own. */
  const coversDot = (box: { x0: number; x1: number; y0: number; y1: number }, self: Dot) =>
    dots.some((o) => {
      if (o === self) return false;
      const cx = Math.min(Math.max(o.x, box.x0), box.x1);
      const cy = Math.min(Math.max(o.y, box.y0), box.y1);
      return Math.hypot(o.x - cx, o.y - cy) < o.r;
    });

  // Direct labels: the heaviest few, plus whatever is focused or followed, covering nothing.
  // The focused one always shows (its halo keeps it legible over the bubbles).
  const wanted = new Set([
    ...dots.slice(0, 6).map((d) => d.company.slug),
    ...pinned,
    ...(focused ? [focused] : []),
  ]);
  const labels: Label[] = [];
  const boxes: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const order = [...dots].sort((a, b) => {
    const rank = (d: Dot) =>
      d.company.slug === focused ? 0 : pinned.includes(d.company.slug) ? 1 : 2;
    return rank(a) - rank(b) || b.r - a.r;
  });
  for (const d of order) {
    if (!wanted.has(d.company.slug)) continue;
    const text = d.company.name.length > 18 ? `${d.company.name.slice(0, 17)}…` : d.company.name;
    const w = text.length * LABEL_CHAR;
    for (const anchor of ["start", "end"] as const) {
      const lx = anchor === "start" ? d.x + d.r + 4 : d.x - d.r - 4;
      const box = {
        x0: anchor === "start" ? lx : lx - w,
        x1: anchor === "start" ? lx + w : lx,
        y0: d.y - 7,
        y1: d.y + 7,
      };
      const inside = box.x0 >= MARGIN.left && box.x1 <= MARGIN.left + innerWidth;
      const free =
        boxes.every((b) => box.x1 < b.x0 || box.x0 > b.x1 || box.y1 < b.y0 || box.y0 > b.y1) &&
        !coversDot(box, d);
      if (inside && (free || d.company.slug === focused)) {
        boxes.push(box);
        labels.push({ slug: d.company.slug, text, x: lx, y: d.y, anchor });
        break;
      }
    }
  }

  const onMove = (event: PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - box.left + MARGIN.left;
    const py = event.clientY - box.top + MARGIN.top;
    let best: Dot | null = null;
    let gap = Infinity;
    for (const d of dots) {
      // Distance to the bubble's edge, so a large bubble is easy to hit and a small one still is.
      const distance = Math.max(0, Math.hypot(d.x - px, d.y - py) - d.r);
      if (distance < gap) {
        gap = distance;
        best = d;
      }
    }
    const hit = best && gap <= 12 ? best : null;
    setHover(hit);
    setFocused(hit ? hit.company.slug : null);
  };
  const onLeave = () => {
    setHover(null);
    setFocused(null);
  };

  const counts = REGIMES.map(
    (r) => `${placed.filter((c) => regimeOf(c.scores) === r.id).length} ${r.label.toLowerCase()}`,
  ).join(", ");
  const left = x(X_DOMAIN[0]);
  const right = x(X_DOMAIN[1]);
  const top = y(Y_DOMAIN[1]);
  const bottom = y(Y_DOMAIN[0]);

  return (
    <div ref={ref} className="chart regime" style={{ height }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Régimes des corporations, activité face à dynamique : ${counts}.`}
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
            Dynamique ↑
          </text>
          <text x={right} y={height - 4} textAnchor="end">
            Activité →
          </text>
        </g>
        <g>
          {dots.map((d) => {
            const isFocused = d.company.slug === focused;
            const dim = focused !== null && !isFocused;
            return (
              <circle
                key={d.company.slug}
                cx={d.x}
                cy={d.y}
                r={d.r}
                className={`regime__dot${isFocused ? " is-focused" : ""}${dim ? " is-dim" : ""}`}
                style={{ fill: groupColor(d.company.consortium) }}
              />
            );
          })}
        </g>
        <g className="regime__labels" aria-hidden="true">
          {labels.map((l) => (
            <text
              key={l.slug}
              x={l.x}
              y={l.y}
              dy="0.32em"
              textAnchor={l.anchor}
              className={l.slug === focused ? "is-strong" : focused !== null ? "is-dim" : undefined}
            >
              {l.text}
            </text>
          ))}
        </g>
        <rect
          className="chart__overlay"
          x={MARGIN.left}
          y={MARGIN.top}
          width={innerWidth}
          height={height - MARGIN.top - MARGIN.bottom}
          onPointerMove={onMove}
          onPointerLeave={onLeave}
        />
      </svg>
      {hover ? (
        <div
          className="chart__tip map__tip"
          style={{
            left: Math.max(0, Math.min(hover.x + hover.r + 10, width - 240)),
            top: Math.max(0, Math.min(hover.y - 20, height - 150)),
          }}
          aria-hidden="true"
        >
          <p className="chart__tip-date">
            {REGIMES.find((r) => r.id === regimeOf(hover.company.scores))?.label}
          </p>
          <p className="map__tip-name">{hover.company.name}</p>
          <p>
            <i style={{ background: groupColor(hover.company.consortium) }} />
            <span>Activité</span>
            <b>
              <Score value={hover.company.scores.activity} />
            </b>
          </p>
          <p>
            <i />
            <span>Dynamique</span>
            <b>
              <Score value={hover.company.scores.dynamics} />
            </b>
          </p>
          <p className="is-estimate">
            <i />
            <span>Poids économique</span>
            <b>
              {hover.company.scores.weight === null
                ? "—"
                : formatShare(hover.company.scores.weight)}
            </b>
          </p>
        </div>
      ) : null}
    </div>
  );
}
