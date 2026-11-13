import type { ReactNode } from "react";
import type { TreasuryBridge as Bridge } from "../domain/treasury.ts";
import { Amount, Estimated, ImperialDate } from "./figures.tsx";
import "./TreasuryBridge.css";

interface Step {
  key: string;
  label: ReactNode;
  /** Bar span on the value axis. */
  from: number;
  to: number;
  value: ReactNode;
  estimated: boolean;
}

/**
 * Horizontal bridge of a company's capital over a period: published capital at both ends, and in
 * between the estimated revenue and the remainder that revenue does not explain.
 */
export function TreasuryBridge({ bridge }: { bridge: Bridge }) {
  const afterRevenue = bridge.start.capital + bridge.earned;
  const steps: Step[] = [
    {
      key: "start",
      label: (
        <>
          Capital au <ImperialDate date={bridge.start.date} />
        </>
      ),
      from: 0,
      to: bridge.start.capital,
      value: <Amount value={bridge.start.capital} />,
      estimated: false,
    },
    {
      key: "earned",
      label: "CA généré",
      from: bridge.start.capital,
      to: afterRevenue,
      value: <Estimated value={bridge.earned} noise={bridge.noise} signed />,
      estimated: true,
    },
    {
      key: "other",
      label: "Flux hors CA",
      from: afterRevenue,
      to: bridge.end.capital,
      value: <Estimated value={bridge.otherFlow} noise={bridge.noise} signed />,
      estimated: true,
    },
    {
      key: "end",
      label: (
        <>
          Capital au <ImperialDate date={bridge.end.date} />
        </>
      ),
      from: 0,
      to: bridge.end.capital,
      value: <Amount value={bridge.end.capital} />,
      estimated: false,
    },
  ];
  const bounds = steps.flatMap((s) => [s.from, s.to]);
  const lo = Math.min(0, ...bounds);
  const hi = Math.max(...bounds);
  const span = hi - lo || 1;
  const at = (v: number) => ((v - lo) / span) * 100;

  return (
    <ol className="bridge">
      {steps.map((s, i) => {
        const left = at(Math.min(s.from, s.to));
        const width = Math.abs(at(s.to) - at(s.from));
        // Each bar hands its end to the next one with a hairline, as on a printed statement.
        const link = i < steps.length - 1 ? at(s.to) : null;
        return (
          <li key={s.key} className="bridge__step">
            <span className="bridge__label">{s.label}</span>
            <span className="bridge__track" aria-hidden="true">
              <span
                className={`bridge__bar${s.estimated ? " bridge__bar--estimated" : ""}`}
                style={{ left: `${left}%`, width: `max(${width}%, 1px)` }}
              />
              {link !== null ? (
                <span className="bridge__link" style={{ left: `${link}%` }} />
              ) : null}
            </span>
            <span className="bridge__value">{s.value}</span>
          </li>
        );
      })}
    </ol>
  );
}
