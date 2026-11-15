import { describe, expect, it } from "vite-plus/test";
import { addDays, toDayNumber } from "./dates.ts";
import {
  consortiumEffect,
  consortiumPortfolios,
  earnedBetween,
  earnedByGroup,
  groupRace,
  growthContribution,
  sectorRegimes,
} from "./groupHistory.ts";
import { buildMarket } from "./market.ts";
import { datasetByName } from "./testing.ts";
import type { Dataset, ReportRow } from "./types.ts";

const CREATION = "2026-01-01";
const dates = Array.from({ length: 14 }, (_, k) => addDays("2026-06-01", 10 * k));
const latest = dates.at(-1)!;
const lastMonth = toDayNumber(latest) - toDayNumber(CREATION) - 30;

/** Published chiffre of a corporation earning `rate(day)` credits each day since CREATION. */
function chiffreOn(date: string, rate: (day: number) => number): number {
  const days = toDayNumber(date) - toDayNumber(CREATION);
  let cumulative = 0;
  for (let d = 0; d < days; d++) cumulative += rate(d);
  return Math.round(cumulative / days);
}

const earners: Record<string, { rate: (day: number) => number; sector?: string }> = {
  Steady: { rate: () => 1_000, sector: "banque" },
  Rising: { rate: (d) => (d >= lastMonth ? 1_500 : 500), sector: "banque" },
  Tech: { rate: () => 2_000, sector: "technopole" },
  Unfiled: { rate: () => 300 },
};

/** Steady leaves Maison 30 days before the latest report and joins Autre. */
const LEAVE = addDays(latest, -30);

function dataset(): Dataset {
  const data = datasetByName({
    generatedAt: "2026-11-13T00:00:00Z",
    companies: Object.entries(earners).map(([name, e]) => ({
      name,
      creationOverride: CREATION,
      sector: e.sector as never,
    })),
    snapshots: dates.map((date) => ({
      date,
      source: "paste",
      rows: Object.entries(earners).map(([name, e]): ReportRow => ({
        name,
        rank: null,
        chiffre: chiffreOn(date, e.rate),
        capital: 10_000,
        employees: 2,
      })),
    })),
  });
  data.consortiums = [
    { id: "m", name: "Maison", color: "cyan" },
    { id: "a", name: "Autre", color: "bleu" },
  ];
  data.memberships = [
    { id: "1", profileId: "Steady", consortiumId: "m", joinedOn: null, leftOn: LEAVE },
    { id: "2", profileId: "Steady", consortiumId: "a", joinedOn: LEAVE, leftOn: null },
    { id: "3", profileId: "Tech", consortiumId: "m", joinedOn: null, leftOn: null },
  ];
  return data;
}

const market = buildMarket(dataset());
const steady = market.bySlug.get("steady")!;
const latestDay = toDayNumber(latest);

describe("earnedBetween", () => {
  it("reads the revenue earned between two days at a constant rate", () => {
    expect(earnedBetween(steady, latestDay - 20, latestDay)).toBeCloseTo(20_000, -2);
    expect(earnedBetween(steady, latestDay, latestDay - 20)).toBe(0);
    // Before KNX saw it, from its creation day.
    expect(earnedBetween(steady, toDayNumber(CREATION), toDayNumber(dates[0]))).toBeCloseTo(
      1_000 * (toDayNumber(dates[0]) - toDayNumber(CREATION)),
      -2,
    );
  });

  it("cuts a corporation's revenue at the day it changes consortium", () => {
    const slices = earnedByGroup(steady, latestDay - 60, latestDay, "consortium");
    const byId = new Map(slices.map((s) => [s.group.id, s.earned]));
    expect(byId.get("m")).toBeCloseTo(30_000, -2);
    expect(byId.get("a")).toBeCloseTo(30_000, -2);
    const unfiled = market.bySlug.get("unfiled")!;
    expect(earnedByGroup(unfiled, latestDay - 10, latestDay, "consortium")[0].group.id).toBe(
      "independantes",
    );
    expect(earnedByGroup(unfiled, latestDay - 10, latestDay, "sector")[0].group.id).toBe(
      "non-classees",
    );
  });
});

describe("groupRace", () => {
  const start = addDays(latest, -60);

  it("adds up to the market's revenue and follows each move", () => {
    const races = groupRace(market, start, "consortium");
    const total = races.reduce((sum, r) => sum + r.total, 0);
    const market60 = market.allLives.reduce(
      (sum, life) => sum + earnedBetween(life, latestDay - 60, latestDay),
      0,
    );
    expect(total).toBeCloseTo(market60, -1);
    const autre = races.find((r) => r.group.id === "a")!;
    // Autre earns nothing before Steady joins it, 1 000 a day afterwards.
    expect(autre.points[0].value).toBe(0);
    expect(autre.total).toBeCloseTo(30_000, -2);
    expect(races[0].points[0]).toEqual({ date: start, value: 0 });
  });

  it("groups by sector, unfiled corporations apart", () => {
    const ids = groupRace(market, start, "sector").map((r) => r.group.id);
    expect(ids.at(-1)).toBe("non-classees");
    expect([...ids].sort()).toEqual(["banque", "non-classees", "technopole"]);
  });
});

describe("growthContribution", () => {
  it("splits the market's change between groups", () => {
    const growth = growthContribution(market, 30, "sector");
    const sum = growth.groups.reduce((s, g) => s + g.delta, 0);
    expect(sum).toBeCloseTo(growth.after - growth.before, 5);
    // Rising went from 500 to 1 500 a day: the banks carry the growth.
    expect(growth.groups[0].group.id).toBe("banque");
    expect(growth.groups[0].delta).toBeCloseTo(1_000, -1);
  });
});

describe("sectorRegimes", () => {
  it("ends on the figures of the latest report", () => {
    const trails = sectorRegimes(market, 60, 3);
    const bank = trails.find((t) => t.sector === "banque")!;
    const last = bank.points.at(-1)!;
    expect(last.date).toBe(latest);
    expect(last.dynamics).toBeCloseTo(market.sectors.get("banque")!.dynamics!, 5);
    expect(last.activity).toBeCloseTo(market.sectors.get("banque")!.activity!, 5);
    expect(bank.points.length).toBeGreaterThan(1);
  });
});

describe("consortiumPortfolios", () => {
  it("lists members, dependence, sectors and dated moves", () => {
    const portfolios = consortiumPortfolios(market);
    const maison = portfolios.find((p) => p.consortium.id === "m")!;
    expect(maison.members.map((c) => c.name)).toEqual(["Tech"]);
    expect(maison.dependency).toBeCloseTo(1);
    expect(maison.former.map((c) => c.name)).toEqual(["Steady"]);
    expect(maison.moves).toEqual([{ company: steady, kind: "leave", date: LEAVE }]);
    const autre = portfolios.find((p) => p.consortium.id === "a")!;
    expect(autre.bySector.map((s) => s.group.id)).toEqual(["banque"]);
  });
});

describe("consortiumEffect", () => {
  it("compares members and independents, and measures revenue around each move", () => {
    const effect = consortiumEffect(market);
    expect(effect.members).toBe(2);
    expect(effect.independents).toBe(1);
    expect(effect.rows.map((r) => r.id)).toEqual(["dynamics", "activity", "productivity", "risk"]);
    const join = effect.moves.find((m) => m.kind === "join")!;
    expect(join.consortium.id).toBe("a");
    expect(join.before).toBeCloseTo(1_000, -1);
    expect(join.after).toBeCloseTo(1_000, -1);
  });
});
