const GROUPING = /[.\s  ']/g;

/**
 * Parses an amount as the game prints it: `27.120.847`, `677 085`, `36`, `0`.
 * Dots and every kind of space are thousands separators; the game never prints decimals.
 * Returns `null` when the text is not a whole amount.
 */
export function parseAmount(text: string): number | null {
  const cleaned = text
    .replace(/[¢]|Cr\b/g, "")
    .replace(GROUPING, "")
    .trim();
  if (!/^-?\d+$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isSafeInteger(value) ? value : null;
}

const integerFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const compactFormat = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const percentFormats = [1, 2, 3].map(
  (digits) =>
    new Intl.NumberFormat("fr-FR", {
      style: "percent",
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
      signDisplay: "exceptZero",
    }),
);
const decimalFormat = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

/**
 * Intl groups French thousands with U+202F; Hanken Grotesk draws it under 2 px wide, which
 * vanishes in tables. A no-break space keeps the grouping visible and unbreakable.
 */
const visibleGrouping = (text: string) => text.replace(/ /g, " ");

/** `677 085`, French grouping with a no-break space. */
export function formatInteger(value: number): string {
  return visibleGrouping(integerFormat.format(Math.round(value)));
}

/** `27,1 M` for large amounts in dense places. */
export function formatCompact(value: number): string {
  return visibleGrouping(compactFormat.format(value));
}

/**
 * `+1,8 %` / `−0,04 %`, using a true minus sign. Small ratios get more digits so a real move
 * never reads as `0,0 %`.
 */
export function formatPercent(ratio: number): string {
  const magnitude = Math.abs(ratio);
  const format =
    magnitude === 0 || magnitude >= 0.01
      ? percentFormats[0]
      : magnitude >= 0.001
        ? percentFormats[1]
        : percentFormats[2];
  return visibleGrouping(format.format(ratio)).replace("-", "−");
}

const scoreFormat = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

/** `3,99`: a rating score, never rounded across a category threshold. */
export function formatScore2(value: number): string {
  return scoreFormat.format(value);
}

export function formatDecimal(value: number): string {
  return visibleGrouping(decimalFormat.format(value));
}

/** A −1…1 score as signed points out of 100: `+62`, `−8`, `0`. */
export function formatScore(value: number): string {
  const points = Math.round(value * 100);
  if (points === 0) return "0";
  return points > 0 ? `+${points}` : `−${-points}`;
}

/** Signed integer with a true minus sign: `+3`, `−12`, `0`. */
export function formatSigned(value: number): string {
  if (value === 0) return "0";
  return value > 0 ? `+${formatInteger(value)}` : `−${formatInteger(-value)}`;
}

/** A share of a whole, unsigned: `15,4 %`. */
export function formatShare(ratio: number): string {
  return formatPercent(ratio).replace("+", "");
}
