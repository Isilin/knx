import { addImperialYears } from "../domain/imperial.ts";
import type { IsoDate } from "../domain/types.ts";

/** Periods in imperial years: one year is one real month. */
export const PERIODS = [
  { id: "1", label: "1 an", years: 1 },
  { id: "3", label: "3 ans", years: 3 },
  { id: "12", label: "12 ans", years: 12 },
  { id: "all", label: "Tout", years: null },
] as const;

export type PeriodId = (typeof PERIODS)[number]["id"];

/** First date included by a period ending on `latest`. */
export function periodStart(period: PeriodId, latest: IsoDate): IsoDate | null {
  const years = PERIODS.find((p) => p.id === period)?.years ?? null;
  return years === null ? null : addImperialYears(latest, -years);
}

export function PeriodPicker({
  value,
  onChange,
  label = "Période",
}: {
  value: PeriodId;
  onChange: (id: PeriodId) => void;
  label?: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {PERIODS.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-pressed={value === p.id}
          onClick={() => onChange(p.id)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
