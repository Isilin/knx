import { addDays } from "../domain/dates.ts";
import type { IsoDate } from "../domain/types.ts";

export const PERIODS = [
  { id: "30", label: "30 j", days: 30 },
  { id: "90", label: "90 j", days: 90 },
  { id: "365", label: "1 an", days: 365 },
  { id: "all", label: "Tout", days: null },
] as const;

export type PeriodId = (typeof PERIODS)[number]["id"];

/** First date included by a period ending on `latest`. */
export function periodStart(period: PeriodId, latest: IsoDate): IsoDate | null {
  const days = PERIODS.find((p) => p.id === period)?.days ?? null;
  return days === null ? null : addDays(latest, -days);
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
