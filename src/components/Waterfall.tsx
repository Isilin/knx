import type { Contribution } from "../domain/groupHistory.ts";
import { formatInteger, formatSigned } from "../domain/numbers.ts";
import { Change, groupColor, Trend } from "./figures.tsx";
import "./Waterfall.css";

/**
 * How the market's daily revenue went from one window to the next, group by group: the earlier
 * total, each group's gain or loss stacked on the running total, then the latest total. Gains and
 * losses carry a triangle and a sign, never colour alone.
 */
export function Waterfall({
  before,
  after,
  groups,
  days,
}: {
  before: number;
  after: number;
  groups: readonly Contribution[];
  days: number;
}) {
  // Each group starts where the previous one ended.
  const steps = groups.reduce<(Contribution & { from: number; to: number })[]>((list, g) => {
    const from = list.at(-1)?.to ?? before;
    return [...list, { ...g, from, to: from + g.delta }];
  }, []);
  const highest = Math.max(1, before, after, ...steps.map((s) => Math.max(s.from, s.to)));
  const pct = (v: number) => `${(Math.max(0, v) / highest) * 100}%`;
  const change = before > 0 ? after / before - 1 : null;

  return (
    <div className="waterfall">
      <ol className="waterfall__rows">
        <li className="waterfall__total">
          <span className="waterfall__label">{days} jours précédents</span>
          <span className="waterfall__track" aria-hidden="true">
            <span className="waterfall__bar" style={{ left: 0, width: pct(before) }} />
          </span>
          <span className="waterfall__value estimated">{formatInteger(before)} ¢/j</span>
        </li>
        {steps.map((s) => {
          const up = s.delta >= 0;
          const low = Math.min(s.from, s.to);
          return (
            <li key={s.group.id}>
              <span className="waterfall__label">
                {s.group.consortium ? (
                  <i style={{ background: groupColor(s.group.consortium) }} aria-hidden="true" />
                ) : null}
                {s.group.label}
              </span>
              <span className="waterfall__track" aria-hidden="true">
                <span
                  className={`waterfall__bar waterfall__bar--${up ? "up" : "down"}`}
                  style={{ left: pct(low), width: pct(Math.abs(s.delta)) }}
                />
              </span>
              <span
                className={`waterfall__value change change--${up ? "up" : "down"} change--estimated`}
              >
                {Math.round(s.delta) !== 0 ? <Trend up={up} /> : null}
                {formatSigned(Math.round(s.delta))} ¢/j
              </span>
            </li>
          );
        })}
        <li className="waterfall__total waterfall__total--end">
          <span className="waterfall__label">{days} derniers jours</span>
          <span className="waterfall__track" aria-hidden="true">
            <span className="waterfall__bar" style={{ left: 0, width: pct(after) }} />
          </span>
          <span className="waterfall__value estimated">{formatInteger(after)} ¢/j</span>
        </li>
      </ol>
      {change !== null ? (
        <p className="waterfall__summary">
          Recette du marché <Change ratio={change} estimated /> d'une fenêtre à l'autre.
        </p>
      ) : null}
    </div>
  );
}
