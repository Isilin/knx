import { useEffect, useRef, useState } from "react";

/** Interpolates a figure towards `target` (exponential ease-out); instant under reduced motion. */
export function useTween(target: number | null, duration = 520): number | null {
  const [value, setValue] = useState(target);
  const from = useRef(target);

  useEffect(() => {
    if (target === null || from.current === null) {
      from.current = target;
      setValue(target);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = from.current;
    if (reduce || start === target) {
      from.current = target;
      setValue(target);
      return;
    }
    const began = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / duration);
      const eased = 1 - Math.pow(2, -10 * t);
      const next = start + (target - start) * (t === 1 ? 1 : eased);
      from.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
