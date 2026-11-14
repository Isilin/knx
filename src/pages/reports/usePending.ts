import { useCallback, useEffect, useState } from "react";
import { useData } from "../../data/DataProvider.tsx";
import type { PendingSnapshot } from "../../data/source.ts";

/**
 * Reports sent by the in-game module and awaiting review. Refetched whenever the market reloads
 * (after any publication) and on demand (after a rejection).
 */
export function usePending(enabled: boolean): {
  /** Null until the first fetch answers. */
  pending: PendingSnapshot[] | null;
  error: string | null;
  refresh: () => void;
} {
  const { source, state } = useData();
  const dataset = state.status === "ready" ? state.dataset : null;
  const [pending, setPending] = useState<PendingSnapshot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    source.pending().then(
      (items) => {
        if (cancelled) return;
        setPending(items);
        setError(null);
      },
      (reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, source, dataset, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { pending: enabled ? pending : null, error: enabled ? error : null, refresh };
}
