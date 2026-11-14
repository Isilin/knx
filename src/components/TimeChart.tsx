import { scaleLinear, scaleTime } from "d3-scale";
import { curveLinear, curveStepAfter, curveStepBefore, line } from "d3-shape";
import { useMemo, useState, type PointerEvent } from "react";
import { formatImperialDate, formatPti, imperialTicks } from "../domain/imperial.ts";
import type { IsoDate } from "../domain/types.ts";
import { useElementWidth } from "../hooks/useElementWidth.ts";
import "./TimeChart.css";

export interface ChartPoint {
  date: IsoDate;
  value: number | null;
}

export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  points: ChartPoint[];
  /**
   * `estimate`: dashed violet step (value held over each period); `trend`: dotted violet;
   * `projection`: dashed violet line into the future; `step`: ranks.
   */
  kind?: "line" | "estimate" | "trend" | "projection" | "step";
}

/** A dated event of the whole market, drawn as a vertical rule across the plot. */
export interface ChartMarker {
  id: string;
  date: IsoDate;
  /** Short text printed at the top of the rule. */
  label: string;
  /** Full name, in the tooltip of the first report after it. */
  title: string;
}

interface TimeChartProps {
  series: ChartSeries[];
  label: string;
  formatValue: (value: number) => string;
  height?: number;
  invertY?: boolean;
  /** Series to draw in full ink; the others dim while one is focused. */
  focusId?: string | null;
  /** Called with the series nearest the pointer (multi-series cross-highlight). */
  onFocus?: (id: string | null) => void;
  /** Ids always drawn in full ink (followed companies). */
  pinned?: readonly string[];
  /** Start the y axis at zero (amounts) instead of fitting the data (ranks). */
  zeroBased?: boolean;
  /** Direct label drawn at the end of each line; `compact` on narrow charts (keep it short). */
  endLabel?: (series: ChartSeries, compact: boolean) => string;
  /** Muted note after the end label; left out on narrow charts. */
  endNote?: (series: ChartSeries) => string;
  /** Market events inside the plotted dates. */
  markers?: readonly ChartMarker[];
}

const MARGIN = { top: 14, right: 72, bottom: 30, left: 0 };
/** Room on the right for end-of-line labels; value ticks move to the left edge. */
const LABELLED_MARGIN = { ...MARGIN, right: 184 };
/** Narrow charts keep the plot wide: labels shrink to the rank. */
const COMPACT_LABELLED_MARGIN = { ...MARGIN, right: 44 };
const dateOf = (iso: IsoDate) => new Date(`${iso}T00:00:00Z`);
/** Series KNX computes rather than reads: drawn and labelled in violet. */
const isEstimate = (kind: ChartSeries["kind"]) =>
  kind === "estimate" || kind === "trend" || kind === "projection";
const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });

export function TimeChart({
  series,
  label,
  formatValue,
  height = 300,
  invertY = false,
  focusId = null,
  onFocus,
  pinned = [],
  zeroBased = true,
  endLabel,
  endNote,
  markers = [],
}: TimeChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const compactLabels = width < 640;
  const margin = endLabel ? (compactLabels ? COMPACT_LABELLED_MARGIN : LABELLED_MARGIN) : MARGIN;
  const [hover, setHover] = useState<{ index: number; x: number } | null>(null);

  const geometry = useMemo(() => {
    const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
    const values = series.flatMap((s) =>
      s.points.flatMap((p) => (p.value === null ? [] : [p.value])),
    );
    if (dates.length === 0 || values.length === 0) return null;
    const innerWidth = Math.max(80, width - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;
    const x = scaleTime()
      .domain([dateOf(dates[0]), dateOf(dates[dates.length - 1])])
      .range([margin.left, margin.left + innerWidth]);
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    if (zeroBased) lo = Math.min(0, lo);
    if (invertY) {
      lo = Math.max(1, Math.floor(lo) - 1);
      hi = Math.ceil(hi) + 1;
    }
    if (lo === hi) hi = lo + 1;
    // Amounts start at zero and round to clean ticks; fitted scales pad instead, so the slope
    // of a slow-moving average stays visible.
    if (!zeroBased && !invertY) {
      const pad = (hi - lo) * 0.08;
      lo -= pad;
      hi += pad;
    }
    const y = scaleLinear()
      .domain(invertY ? [hi, lo] : [lo, hi])
      .range([margin.top + innerHeight, margin.top]);
    if (zeroBased || invertY) y.nice(4);
    const paths = series.map((s) => {
      const curve =
        s.kind === "estimate" ? curveStepBefore : s.kind === "step" ? curveStepAfter : curveLinear;
      const d =
        line<ChartPoint>()
          .defined((p) => p.value !== null)
          .x((p) => x(dateOf(p.date)))
          .y((p) => y(p.value ?? 0))
          .curve(curve)(s.points) ?? "";
      return { ...s, d };
    });
    return {
      dates,
      x,
      y,
      paths,
      innerWidth,
      innerHeight,
    };
  }, [series, width, height, invertY, zeroBased, margin]);

  if (!geometry) {
    return (
      <div ref={ref} className="chart chart--empty" style={{ height }}>
        <p>Pas encore assez de relevés pour tracer une courbe.</p>
      </div>
    );
  }

  const { dates, x, y, paths } = geometry;
  const xTicks = imperialTicks(
    dates[0],
    dates[dates.length - 1],
    Math.max(2, Math.floor(geometry.innerWidth / 130)),
  );
  const yTicks = invertY ? y.ticks(4).filter((t) => Number.isInteger(t)) : y.ticks(4);
  const hasFocus = focusId !== null;

  const onMove = (event: PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - box.left + margin.left;
    const target = x.invert(px).getTime();
    let index = 0;
    let best = Infinity;
    dates.forEach((d, i) => {
      const distance = Math.abs(dateOf(d).getTime() - target);
      if (distance < best) {
        best = distance;
        index = i;
      }
    });
    setHover({ index, x: x(dateOf(dates[index])) });
    if (onFocus && series.length > 1) {
      const py = event.clientY - box.top + margin.top;
      let nearest: string | null = null;
      let gap = 28;
      for (const s of series) {
        const point = s.points.find((p) => p.date === dates[index]);
        if (point?.value == null) continue;
        const distance = Math.abs(y(point.value) - py);
        if (distance < gap) {
          gap = distance;
          nearest = s.id;
        }
      }
      onFocus(nearest);
    }
  };

  const onLeave = () => {
    setHover(null);
    onFocus?.(null);
  };

  const hoverDate = hover ? dates[hover.index] : null;
  const first = dates[0];
  const last = dates[dates.length - 1];
  const plotRight = margin.left + geometry.innerWidth;
  const rules = markers
    .filter((m) => m.date >= first && m.date <= last)
    .map((m) => {
      const at = x(dateOf(m.date));
      // Labels near the right edge read leftwards, off the end of the plot.
      const flip = at + 8 + m.label.length * 7 > plotRight;
      return { ...m, at, flip };
    });
  // A marker falls in the tooltip of the first report on or after it.
  const previousDate = hover && hover.index > 0 ? dates[hover.index - 1] : null;
  const tipMarkers = hoverDate
    ? markers.filter((m) => m.date <= hoverDate && (previousDate === null || m.date > previousDate))
    : [];
  const rows = hoverDate
    ? series
        .map((s) => ({ s, value: s.points.find((p) => p.date === hoverDate)?.value ?? null }))
        .filter((r) => r.value !== null && (!hasFocus || series.length <= 3 || r.s.id === focusId))
        .sort((a, b) =>
          invertY ? (a.value ?? 0) - (b.value ?? 0) : (b.value ?? 0) - (a.value ?? 0),
        )
        .slice(0, 6)
    : [];

  const labels = endLabel
    ? placeLabels(
        paths.flatMap((p) => {
          const last = [...p.points].reverse().find((pt) => pt.value !== null);
          if (!last || last.value === null) return [];
          const anchor = y(last.value);
          return [
            {
              id: p.id,
              color: p.color,
              text: endLabel(p, compactLabels),
              note: endNote && !compactLabels ? endNote(p) : "",
              x: x(dateOf(last.date)),
              anchor,
              y: anchor,
            },
          ];
        }),
        margin.top,
        height - margin.bottom,
      )
    : [];

  const ordered = [...paths].sort((a, b) => {
    const rank = (id: string) => (id === focusId ? 2 : pinned.includes(id) ? 1 : 0);
    return rank(a.id) - rank(b.id);
  });

  return (
    <div ref={ref} className="chart" style={{ height }}>
      <svg width={width} height={height} role="img" aria-label={label}>
        <g className="chart__grid">
          {yTicks.map((t) => (
            <g key={t} transform={`translate(0 ${y(t)})`}>
              <line x1={margin.left} x2={margin.left + geometry.innerWidth} />
              {endLabel ? null : (
                <text x={margin.left + geometry.innerWidth + 10} dy="0.32em">
                  {invertY ? t : compact.format(t)}
                </text>
              )}
            </g>
          ))}
        </g>
        <g className="chart__axis">
          {xTicks.map((t) => (
            <text key={t.date} x={x(dateOf(t.date))} y={height - 8} textAnchor="middle">
              {t.label}
            </text>
          ))}
        </g>
        {rules.length > 0 ? (
          <g className="chart__markers" aria-hidden="true">
            {rules.map((m) => (
              <g key={m.id}>
                <line x1={m.at} x2={m.at} y1={margin.top} y2={height - margin.bottom} />
                <text
                  x={m.flip ? m.at - 5 : m.at + 5}
                  y={margin.top + 9}
                  textAnchor={m.flip ? "end" : "start"}
                >
                  {m.label}
                </text>
              </g>
            ))}
          </g>
        ) : null}
        {ordered.map((p) => {
          const strong =
            p.id === focusId || (!hasFocus && (pinned.length === 0 || pinned.includes(p.id)));
          const dim = hasFocus && p.id !== focusId && !pinned.includes(p.id);
          return (
            <path
              key={p.id}
              d={p.d}
              className={`chart__line chart__line--${p.kind ?? "line"}${strong ? " is-strong" : ""}${dim ? " is-dim" : ""}`}
              style={{ stroke: isEstimate(p.kind) ? undefined : p.color }}
            />
          );
        })}
        {endLabel ? (
          <g className="chart__grid chart__grid--over" aria-hidden="true">
            {yTicks.map((t) => (
              <text key={t} x={margin.left} y={y(t)} dy="-0.45em">
                {invertY ? t : compact.format(t)}
              </text>
            ))}
          </g>
        ) : null}
        {labels.length > 0 ? (
          <g className="chart__labels">
            {labels.map((l) => {
              const dim = hasFocus && l.id !== focusId && !pinned.includes(l.id);
              return (
                <g
                  key={l.id}
                  className={dim ? "is-dim" : l.id === focusId ? "is-strong" : undefined}
                  onPointerEnter={() => onFocus?.(l.id)}
                  onPointerLeave={() => onFocus?.(null)}
                >
                  <path
                    d={`M${l.x + 3} ${l.anchor}H${margin.left + geometry.innerWidth + 6}L${margin.left + geometry.innerWidth + 12} ${l.y}`}
                  />
                  <text
                    x={margin.left + geometry.innerWidth + 16}
                    y={l.y}
                    dy="0.32em"
                    style={{ fill: l.color }}
                  >
                    {l.text}
                    {l.note ? <tspan className="chart__label-note"> {l.note}</tspan> : null}
                  </text>
                </g>
              );
            })}
          </g>
        ) : null}
        {hover ? (
          <g className="chart__hover">
            <line x1={hover.x} x2={hover.x} y1={margin.top} y2={height - margin.bottom} />
            {rows.map(({ s, value }) => (
              <circle
                key={s.id}
                cx={hover.x}
                cy={y(value ?? 0)}
                r={3.5}
                style={{
                  fill: isEstimate(s.kind) ? "var(--estime)" : s.color,
                }}
              />
            ))}
          </g>
        ) : null}
        <rect
          className="chart__overlay"
          x={margin.left}
          y={margin.top}
          width={geometry.innerWidth}
          height={geometry.innerHeight}
          onPointerMove={onMove}
          onPointerLeave={onLeave}
        />
      </svg>
      {hover && hoverDate ? (
        <div
          className="chart__tip"
          style={{ left: Math.min(hover.x + 14, width - 230), top: margin.top }}
          aria-hidden="true"
        >
          <p className="chart__tip-date">
            {formatImperialDate(hoverDate)} · {formatPti(hoverDate)}
          </p>
          {rows.map(({ s, value }) => (
            <p key={s.id} className={isEstimate(s.kind) ? "is-estimate" : undefined}>
              <i
                style={{
                  background: isEstimate(s.kind) ? "var(--estime)" : s.color,
                }}
              />
              <span>{s.label}</span>
              <b>{formatValue(value ?? 0)}</b>
            </p>
          ))}
          {tipMarkers.map((m) => (
            <p key={m.id} className="chart__tip-event">
              {m.title}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface EndLabel {
  id: string;
  color: string;
  text: string;
  note: string;
  x: number;
  /** y of the line end. */
  anchor: number;
  /** y of the label, after collision avoidance. */
  y: number;
}

/** Spreads end-of-line labels so none overlap (13 px apart), keeping them inside the plot. */
function placeLabels(labels: EndLabel[], top: number, bottom: number): EndLabel[] {
  const gap = 13;
  const sorted = [...labels].sort((a, b) => a.anchor - b.anchor);
  for (let i = 0; i < sorted.length; i++) {
    const floor = i === 0 ? top + 4 : sorted[i - 1].y + gap;
    sorted[i].y = Math.max(sorted[i].anchor, floor);
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    const ceiling = i === sorted.length - 1 ? bottom - 4 : sorted[i + 1].y - gap;
    sorted[i].y = Math.min(sorted[i].y, ceiling);
  }
  return sorted;
}
