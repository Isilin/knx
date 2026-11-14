import { describe, expect, it } from "vite-plus/test";
import { buildMarket, inferGroups, slugify, smoothedRealDaily } from "./market.ts";
import type { CompanyMeta, Dataset, ReportRow, Snapshot } from "./types.ts";

const meta = (id: string, name: string, extra: Partial<CompanyMeta> = {}): CompanyMeta => ({
  id,
  name,
  formerNames: [],
  consortiumId: null,
  sector: null,
  creationOverride: null,
  closedOn: null,
  logoUrl: null,
  hidden: false,
  ...extra,
});

const companies = [
  meta("1", "Alpha Corp", { consortiumId: "k1" }),
  meta("2", "Alpha Bank", { consortiumId: "k1" }),
  meta("3", "Gamma", { creationOverride: "2026-10-01" }),
  meta("4", "Delta", { closedOn: "2026-11-12" }),
  meta("5", "Epsilon"),
];
const ids = new Map(companies.map((c) => [c.name, c.id]));

function snapshot(date: string, source: Snapshot["source"], rows: ReportRow[]): Snapshot {
  return {
    date,
    source,
    rows: rows.map(({ name, ...figures }) => ({ companyId: ids.get(name)!, ...figures })),
  };
}

const dataset: Dataset = {
  generatedAt: "2026-11-13T00:00:00Z",
  companies,
  consortiums: [{ id: "k1", name: "Alpha", color: "cyan" }],
  events: [],
  marketEvents: [],
  snapshots: [
    snapshot("2026-11-10", "sheet", [
      { name: "Alpha Corp", rank: null, chiffre: 1_000, capital: null, employees: null },
      { name: "Alpha Bank", rank: null, chiffre: 800, capital: null, employees: null },
      { name: "Gamma", rank: null, chiffre: 500, capital: null, employees: null },
      { name: "Delta", rank: null, chiffre: 10, capital: null, employees: null },
    ]),
    snapshot("2026-11-12", "paste", [
      { name: "Alpha Corp", rank: 2, chiffre: 990, capital: 5, employees: 1 },
      { name: "Alpha Bank", rank: 3, chiffre: 790, capital: 5, employees: 1 },
      { name: "Gamma", rank: 1, chiffre: 1_200, capital: 5, employees: 3 },
      { name: "Epsilon", rank: 4, chiffre: 0, capital: 3, employees: 0 },
    ]),
  ],
};

describe("buildMarket", () => {
  const market = buildMarket(dataset);

  it("summarises the latest report", () => {
    expect(market.facts).toMatchObject({
      date: "2026-11-12",
      previousDate: "2026-11-10",
      gap: 2,
      listed: 4,
      active: 3,
      idle: 1,
      newcomers: ["Epsilon"],
      delisted: ["Delta"],
    });
  });

  it("tracks ranks, statuses and published changes", () => {
    const gamma = market.bySlug.get("gamma")!;
    expect(gamma.latest.rank).toBe(1);
    expect(gamma.rankChange).toBe(2);
    expect(gamma.chiffreChange).toBeCloseTo(1.4);
    expect(market.bySlug.get("delta")?.status).toBe("delisted");
    expect(market.bySlug.get("epsilon")?.status).toBe("idle");
  });

  it("derives real revenue from the published averages and the creation date", () => {
    const gamma = market.bySlug.get("gamma")!;
    // Day 40 → 42: cumulative 500×40 = 20 000 → 1 200×42 = 50 400, i.e. 15 200 per day.
    expect(gamma.latest.days).toBe(42);
    expect(gamma.latest.realDaily).toBe(15_200);
    expect(gamma.latest.performance).toBeCloseTo(15_200 / 500 - 1);
  });

  it("reads consortiums from the registry", () => {
    expect(market.bySlug.get("alpha-corp")?.consortium?.name).toBe("Alpha");
    expect(market.bySlug.get("gamma")?.consortium).toBeNull();
  });
});

describe("hidden corporations", () => {
  // Alpha Bank and Epsilon are game-master companies: printed by the game, kept off KNX.
  const market = buildMarket({
    ...dataset,
    companies: companies.map((c) =>
      c.name === "Alpha Bank" || c.name === "Epsilon" ? { ...c, hidden: true } : c,
    ),
  });

  it("get no series and no address", () => {
    expect(market.companies.map((c) => c.name)).toEqual(["Gamma", "Alpha Corp", "Delta"]);
    expect(market.bySlug.has("alpha-bank")).toBe(false);
    expect(market.byId.has("5")).toBe(false);
  });

  it("count in no fact of the report", () => {
    expect(market.facts).toMatchObject({
      listed: 2,
      active: 2,
      idle: 0,
      newcomers: [],
      delisted: ["Delta"],
    });
  });

  it("leave the ranks printed by the game", () => {
    // 10 Nov, no printed rank: Alpha Corp, Alpha Bank, Gamma, Delta by chiffre.
    expect(market.bySlug.get("delta")?.latest.rank).toBe(4);
    expect(market.bySlug.get("alpha-corp")?.latest.rank).toBe(2);
  });

  it("take no share of the market", () => {
    // Twelve days of reports, every creation date known: each open company earns a share.
    const later = buildMarket({
      ...dataset,
      companies: companies.map((c) => ({
        ...c,
        creationOverride: "2026-10-01",
        hidden: c.name === "Alpha Bank",
      })),
      snapshots: [
        ...dataset.snapshots,
        snapshot("2026-11-22", "paste", [
          { name: "Gamma", rank: 1, chiffre: 1_150, capital: 5, employees: 3 },
          { name: "Alpha Corp", rank: 2, chiffre: 1_000, capital: 5, employees: 1 },
          { name: "Alpha Bank", rank: 3, chiffre: 800, capital: 5, employees: 1 },
        ]),
      ],
    });
    const weights = later.companies.flatMap((c) =>
      c.scores.weight === null ? [] : [c.scores.weight],
    );
    expect(weights).toHaveLength(2);
    expect(weights.reduce((sum, w) => sum + w, 0)).toBeCloseTo(1);
  });
});

describe("identity", () => {
  // Paradox closed on the 12th; a new Paradox opened the same day. Beta was renamed Bêta Prime.
  const market = buildMarket({
    generatedAt: "2026-11-13T00:00:00Z",
    consortiums: [],
    events: [],
    marketEvents: [],
    companies: [
      meta("10", "Paradox", { closedOn: "2026-11-12" }),
      meta("11", "Paradox"),
      meta("12", "Bêta Prime", { formerNames: ["Beta"] }),
    ],
    snapshots: [
      {
        date: "2026-11-10",
        source: "paste",
        rows: [
          { companyId: "10", rank: 1, chiffre: 57_894, capital: 785_352, employees: 2 },
          { companyId: "12", rank: 2, chiffre: 4_000, capital: 50_000, employees: 1 },
        ],
      },
      {
        date: "2026-11-12",
        source: "paste",
        rows: [
          { companyId: "12", rank: 1, chiffre: 4_010, capital: 50_100, employees: 1 },
          { companyId: "11", rank: 2, chiffre: 0, capital: 3_340, employees: 0 },
        ],
      },
    ],
  });

  it("keeps namesakes apart, the open one under the plain address", () => {
    const current = market.bySlug.get("paradox")!;
    const former = market.bySlug.get("paradox-2026")!;
    expect(current.id).toBe("11");
    expect(current.points.map((p) => p.date)).toEqual(["2026-11-12"]);
    expect(former.id).toBe("10");
    expect(former.status).toBe("delisted");
    expect(current.namesakes.map((n) => n.slug)).toEqual(["paradox-2026"]);
    expect(current.sealSeed).not.toBe(former.sealSeed);
  });

  it("keeps one history, one seal and old links across a rename", () => {
    const beta = market.bySlug.get("beta-prime")!;
    expect(beta.points).toHaveLength(2);
    expect(beta.sealSeed).toBe("Beta");
    expect(market.slugAliases.get("beta")).toBe("beta-prime");
  });
});

describe("helpers", () => {
  it("slugifies names with marks and symbols", () => {
    expect(slugify("Kessler Industries™")).toBe("kessler-industries");
    expect(slugify("La Trame Fukyû")).toBe("la-trame-fukyu");
    expect(slugify("L'Impact")).toBe("l-impact");
  });

  it("ignores articles when inferring groups", () => {
    const groups = inferGroups([
      "La Tech'",
      "La Trame Fukyû",
      "Sovereign Muse",
      "Sovereign Factory",
    ]);
    expect(groups.get("La Tech'")).toBeUndefined();
    expect(groups.get("Sovereign Muse")).toBe("Sovereign");
  });
});

describe("smoothedRealDaily", () => {
  it("averages real revenue over the trailing window", () => {
    const gamma = buildMarket({
      ...dataset,
      snapshots: [
        ...dataset.snapshots,
        snapshot("2026-11-22", "paste", [
          { name: "Gamma", rank: 1, chiffre: 1_150, capital: 5, employees: 3 },
        ]),
      ],
    }).bySlug.get("gamma")!;
    const trend = smoothedRealDaily(gamma.points);
    // 10 → 22 Nov: 500×40 = 20 000 → 1 150×52 = 59 800 over 12 days.
    expect(trend.at(-1)?.value).toBeCloseTo((59_800 - 20_000) / 12);
    expect(trend[0].value).toBeNull();
  });
});
