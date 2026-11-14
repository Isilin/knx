import { describe, expect, it } from "vite-plus/test";
import type { CompanyScores, CompanySeries, CompanyStatus, Market } from "./market.ts";
import { groupByRegime, marketMap, regimeOf, squarify } from "./regimes.ts";

const scores = (
  activity: number | null,
  dynamics: number | null,
  weight: number | null = null,
): CompanyScores => ({ activity, dynamics, weight });

function company(name: string, s: CompanyScores, status: CompanyStatus = "active"): CompanySeries {
  return { name, slug: name.toLowerCase(), status, scores: s } as CompanySeries;
}

const market = {
  companies: [
    company("Up", scores(0.4, 0.6, 0.5)),
    company("Fading", scores(0.2, -0.3, 0.3)),
    company("Back", scores(-0.5, 0.1, 0.194)),
    company("Down", scores(-0.6, -0.9, 0.004)),
    company("Small", scores(-0.1, -0.2, 0.002)),
    company("Silent", scores(-0.8, -1, 0)),
    company("New", scores(null, null, null)),
    company("Gone", scores(0.9, 0.9, null), "delisted"),
  ],
} as Market;

describe("regimeOf", () => {
  it("reads the quadrant from activity and dynamics", () => {
    expect(regimeOf(scores(0.3, 0.2))).toBe("essor");
    expect(regimeOf(scores(0.3, -0.2))).toBe("essoufflement");
    expect(regimeOf(scores(-0.3, 0.2))).toBe("reprise");
    expect(regimeOf(scores(-0.3, -0.2))).toBe("declin");
  });

  it("counts a score at zero on the upper side", () => {
    expect(regimeOf(scores(0, 0))).toBe("essor");
  });

  it("cannot place a company without both scores", () => {
    expect(regimeOf(scores(0.3, null))).toBeNull();
  });
});

describe("groupByRegime", () => {
  const { groups, unplaced } = groupByRegime(market);
  const names = (id: string) => groups.find((g) => g.id === id)?.companies.map((c) => c.name);

  it("sorts listed companies into regimes, heaviest first", () => {
    expect(names("essor")).toEqual(["Up"]);
    expect(names("essoufflement")).toEqual(["Fading"]);
    expect(names("reprise")).toEqual(["Back"]);
    expect(names("declin")).toEqual(["Down", "Small", "Silent"]);
  });

  it("keeps aside those without scores and ignores delisted companies", () => {
    expect(unplaced.map((c) => c.name)).toEqual(["New"]);
  });
});

describe("marketMap", () => {
  const { tiles, silent } = marketMap(market, 0.005);

  it("gives one tile per earning company and folds the smallest into others", () => {
    expect(tiles.map((t) => (t.kind === "company" ? t.company.name : "others"))).toEqual([
      "Up",
      "Fading",
      "Back",
      "others",
    ]);
    const others = tiles[3];
    expect(others.kind === "others" && others.companies.map((c) => c.name)).toEqual([
      "Down",
      "Small",
    ]);
    expect(others.weight).toBeCloseTo(0.006);
  });

  it("lists active companies with nothing earned over 30 days apart", () => {
    expect(silent.map((c) => c.name)).toEqual(["Silent", "New"]);
  });
});

describe("squarify", () => {
  // The example of Bruls, Huizing and van Wijk (2000).
  const values = [6, 6, 4, 3, 2, 2, 1];
  const rects = squarify(values, (v) => v, 6, 4);

  it("gives each item an area proportional to its value", () => {
    expect(rects).toHaveLength(values.length);
    rects.forEach((r, i) => expect(r.w * r.h).toBeCloseTo(values[i]));
  });

  it("tiles the whole rectangle without overlap", () => {
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(-1e-9);
      expect(r.y).toBeGreaterThanOrEqual(-1e-9);
      expect(r.x + r.w).toBeLessThanOrEqual(6 + 1e-9);
      expect(r.y + r.h).toBeLessThanOrEqual(4 + 1e-9);
    }
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        expect(overlapX <= 1e-9 || overlapY <= 1e-9).toBe(true);
      }
    }
  });

  it("keeps the tiles close to squares", () => {
    const worst = Math.max(...rects.map((r) => Math.max(r.w / r.h, r.h / r.w)));
    expect(worst).toBeLessThan(3);
  });

  it("draws nothing without a positive total or room", () => {
    expect(squarify([0, 0], (v) => v, 6, 4)).toEqual([]);
    expect(squarify([1], (v) => v, 0, 4)).toEqual([]);
  });
});
