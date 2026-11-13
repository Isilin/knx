import type { ReactNode } from "react";
import { formatImperialDate, formatPti } from "../domain/imperial.ts";
import { formatInteger, formatPercent, formatSigned } from "../domain/numbers.ts";
import type { IsoDate } from "../domain/types.ts";
import "./figures.css";

/**
 * A date as the game writes it, `6/393.2`. Its PTI form (`PTI 13112026`) shows on hover, or after
 * it with `pti`.
 */
export function ImperialDate({ date, pti = false }: { date: IsoDate; pti?: boolean }) {
  const ptiText = formatPti(date);
  return (
    <time className="idate" dateTime={date} title={pti ? undefined : ptiText}>
      {formatImperialDate(date)}
      {pti ? <span className="idate__pti"> · {ptiText}</span> : null}
    </time>
  );
}

/** An amount in imperial credits. */
export function Amount({ value, unit = true }: { value: number | null; unit?: boolean }) {
  if (value === null) return <span className="amount amount--none">—</span>;
  return (
    <span className="amount">
      {formatInteger(value)}
      {unit ? <span className="amount__unit"> ¢</span> : null}
    </span>
  );
}

/**
 * A value KNX computed rather than read from the game: violet, dotted, and explained on hover.
 * `noise` is the ± rounding uncertainty; values inside it read « ≈ 0 ».
 */
export function Estimated({
  value,
  noise,
  unit = true,
  suffix,
  signed = false,
}: {
  value: number | null;
  noise?: number | null;
  unit?: boolean;
  suffix?: ReactNode;
  /** Print `+` or `−` before the amount (flows). */
  signed?: boolean;
}) {
  if (value === null) return <span className="amount amount--none">—</span>;
  const lost = noise != null && Math.abs(value) < noise;
  const title =
    noise != null ? `Estimation KNX, à ± ${formatInteger(noise)} ¢ près` : "Estimation KNX";
  return (
    <span className="estimated" title={title}>
      {lost ? "≈ 0" : signed ? formatSigned(Math.round(value)) : formatInteger(value)}
      {unit ? <span className="amount__unit"> ¢</span> : null}
      {suffix}
    </span>
  );
}

/** Small drawn triangle: the direction mark that doubles every coloured change. */
export function Trend({ up }: { up: boolean }) {
  return (
    <svg
      className="trend"
      viewBox="0 0 8 8"
      width="8"
      height="8"
      aria-hidden="true"
      focusable="false"
    >
      <path d={up ? "M4 1 7.5 7h-7z" : "M4 7 .5 1h7z"} />
    </svg>
  );
}

/** Signed ratio with a direction mark, so colour is never the only carrier. */
export function Change({
  ratio,
  estimated = false,
}: {
  ratio: number | null;
  estimated?: boolean;
}) {
  if (ratio === null) return <span className="change change--none">—</span>;
  const direction = ratio > 0.00005 ? "up" : ratio < -0.00005 ? "down" : "flat";
  return (
    <span className={`change change--${direction}${estimated ? " change--estimated" : ""}`}>
      {direction !== "flat" ? <Trend up={direction === "up"} /> : null}
      {direction === "flat" ? "0,0 %" : formatPercent(ratio)}
    </span>
  );
}

/** Rank movement: places gained (positive) or lost. */
export function RankChange({ value }: { value: number | null }) {
  if (value === null || value === 0) {
    return (
      <span className="change change--flat" aria-label="Rang inchangé">
        =
      </span>
    );
  }
  const up = value > 0;
  return (
    <span
      className={`change change--${up ? "up" : "down"}`}
      aria-label={`${up ? "Gagne" : "Perd"} ${Math.abs(value)} place${Math.abs(value) > 1 ? "s" : ""}`}
    >
      <Trend up={up} />
      {formatSigned(value).replace(/^[+−]/, "")}
    </span>
  );
}

const GROUP_COLORS: Record<string, string> = {
  Armacham: "var(--g-cyan)",
  Sovereign: "var(--g-magenta)",
  Donnellys: "var(--g-ambre)",
};
const SPARE = ["var(--g-bleu)"];

/** Brand colour of a group: the three known houses are pinned, others take a stable spare. */
export function groupColor(group: string | null): string {
  if (!group) return "var(--ivoire)";
  if (GROUP_COLORS[group]) return GROUP_COLORS[group];
  let h = 0;
  for (const char of group) h = (h * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return SPARE[h % SPARE.length];
}

export function GroupTag({ group }: { group: string | null }) {
  if (!group) return <span className="group-tag group-tag--none">Indépendante</span>;
  return (
    <span className="group-tag">
      <i style={{ background: groupColor(group) }} aria-hidden="true" />
      {group}
    </span>
  );
}
