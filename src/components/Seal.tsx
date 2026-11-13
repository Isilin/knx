import { memo, useMemo } from "react";
import "./Seal.css";

interface SealGeometry {
  rings: number[];
  paths: string[];
}

/** FNV-1a: a stable 32-bit hash of the company name. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (const char of text) {
    h ^= char.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32 pseudo-random generator seeded by the hash. */
function random(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rosette(
  base: number,
  amplitude: number,
  lobes: number,
  phase: number,
  steps: number,
): string {
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    const r = base + amplitude * Math.sin(lobes * theta + phase);
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return `${d}Z`;
}

const cache = new Map<string, SealGeometry>();

/** A guilloché band: `layers` copies of one rosette, phase-shifted across a single lobe. */
function band(
  base: number,
  amplitude: number,
  lobes: number,
  layers: number,
  steps: number,
): string[] {
  return Array.from({ length: layers }, (_, i) =>
    rosette(base, amplitude, lobes, ((Math.PI * 2) / lobes) * (i / layers), steps),
  );
}

/**
 * Guilloché seal geometry, derived only from the name so a company keeps its seal for life.
 * Large seals carry two woven bands and a core rosette, like the security engraving of a bond;
 * small seals keep one open band and the core so they stay legible at table size.
 */
export function sealGeometry(name: string, detail: "small" | "large"): SealGeometry {
  const key = `${detail}:${name}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const next = random(hash(name));
  const outer = next();
  const middle = next();
  const core = next();
  const shape = next();

  let geometry: SealGeometry;
  if (detail === "large") {
    const outerLobes = 16 + Math.floor(outer * 16); // 16…31
    const middleLobes = 8 + Math.floor(middle * 10); // 8…17
    const coreLobes = 3 + Math.floor(core * 5); // 3…7
    geometry = {
      rings: [47.5, 45.6, 28.4, 26.8],
      paths: [
        ...band(36.5, 4.5 + shape * 2, outerLobes, 9, 900),
        ...band(19.5, 3 + shape * 1.5, middleLobes, 6, 600),
        ...band(7.5, 4.5, coreLobes, 3, 240),
      ],
    };
  } else {
    const outerLobes = 6 + Math.floor(outer * 6); // 6…11
    const coreLobes = 3 + Math.floor(core * 4); // 3…6
    geometry = {
      rings: [46],
      paths: [...band(31, 7 + shape * 3, outerLobes, 2, 220), ...band(12, 5, coreLobes, 1, 120)],
    };
  }
  cache.set(key, geometry);
  return geometry;
}

interface SealProps {
  /** Stable seed, normally `CompanySeries.sealSeed`. */
  seed: string;
  size?: number;
  /** Trace the strokes once on mount (company page). */
  draw?: boolean;
  className?: string;
}

export const Seal = memo(function Seal({ seed, size = 24, draw = false, className }: SealProps) {
  const detail = size >= 64 ? "large" : "small";
  const geometry = useMemo(() => sealGeometry(seed, detail), [seed, detail]);
  return (
    <svg
      className={`seal${draw ? " seal--draw" : ""}${className ? ` ${className}` : ""}`}
      viewBox="-50 -50 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      {geometry.rings.map((r, i) => (
        <circle key={`r${i}`} r={r} pathLength={1} style={{ animationDelay: `${i * 80}ms` }} />
      ))}
      {geometry.paths.map((d, i) => (
        <path key={`p${i}`} d={d} pathLength={1} style={{ animationDelay: `${160 + i * 45}ms` }} />
      ))}
    </svg>
  );
});
