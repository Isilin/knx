import { describe, expect, it } from "vite-plus/test";
import { buildMarket } from "./market.ts";
import { testDataset, type TestCompany } from "./testing.ts";
import { buildTimeline, lifeAt } from "./timeline.ts";
import type { CompanyEvent, Dataset } from "./types.ts";

const meta = (id: string, name: string, extra: Partial<TestCompany> = {}): TestCompany => ({
  id,
  name,
  ...extra,
});

const row = (companyId: string, rank: number, chiffre: number) => ({
  companyId,
  rank,
  chiffre,
  capital: 10_000,
  employees: 1,
});

const events: CompanyEvent[] = [
  {
    id: "e1",
    companyId: "2",
    date: "2026-11-12",
    kind: "renamed",
    details: { from: "Old", to: "Paradox" },
    note: null,
    origin: "auto",
  },
  {
    id: "e2",
    companyId: "2",
    date: "2026-11-12",
    kind: "ceo_change",
    details: { person: "Ada" },
    note: "Nommée par le conseil.",
    origin: "manual",
  },
];

const dataset: Dataset = testDataset({
  generatedAt: "2026-11-13T00:00:00Z",
  consortiums: [],
  events,
  marketEvents: [],
  ratings: [],
  companies: [
    meta("1", "Paradox", { closedOn: "2026-11-11" }),
    meta("2", "Paradox", { creationOverride: "2026-11-09", formerNames: ["Old"] }),
  ],
  snapshots: [
    { date: "2026-11-01", source: "paste", rows: [row("1", 5, 50_000)] },
    { date: "2026-11-10", source: "paste", rows: [row("1", 12, 49_000)] },
    { date: "2026-11-11", source: "paste", rows: [row("2", 30, 0)] },
    { date: "2026-11-12", source: "paste", rows: [row("2", 30, 100)] },
  ],
});

describe("buildTimeline", () => {
  const market = buildMarket(dataset);

  it("merges what KNX reads, estimates and what the operator typed, newest first", () => {
    const current = market.bySlug.get("paradox")!;
    const timeline = buildTimeline(current, market.events.get("2") ?? []);
    expect(timeline.map((e) => [e.date, e.title, e.origin])).toEqual([
      ["2026-11-12", "Record de CA publié : 100 ¢", "auto"],
      ["2026-11-12", "Changement de nom : Old devient Paradox", "auto"],
      ["2026-11-12", "Changement de DG : Ada", "manual"],
      ["2026-11-11", "Premier relevé KNX", "auto"],
      ["2026-11-11", "Meilleur rang : 30", "auto"],
      ["2026-11-11", "Une corporation du même nom a fermé (an 393)", "auto"],
      ["2026-11-09", "Fondation", "manual"],
    ]);
    expect(timeline.find((e) => e.founding)?.title).toBe("Fondation");
    expect(timeline.find((e) => e.link)?.link?.slug).toBe("paradox-2026");
  });

  it("records the closure and the top 10 exit of the former namesake", () => {
    const former = market.bySlug.get("paradox-2026")!;
    const titles = buildTimeline(former, []).map((e) => e.title);
    expect(titles).toContain("Fermeture");
    expect(titles).toContain("Sort du top 10 (rang 12)");
    expect(titles).toContain("Une nouvelle corporation reprend le nom");
  });

  it("lets a typed closure replace the automatic one", () => {
    const former = market.bySlug.get("paradox-2026")!;
    const typed: CompanyEvent = {
      id: "e3",
      companyId: "1",
      date: "2026-11-05",
      kind: "closed",
      details: {},
      note: "Liquidée par l'Impérium.",
      origin: "manual",
    };
    const closures = buildTimeline(former, [typed]).filter((e) => e.title === "Fermeture");
    expect(closures).toHaveLength(1);
    expect(closures[0]).toMatchObject({ date: "2026-11-05", origin: "manual" });
  });
});

describe("buildTimeline across lives", () => {
  // The same story, but the operator kept one page: Paradox destroyed, then refounded.
  const market = buildMarket({
    ...dataset,
    companies: dataset.companies.map((c) => ({ ...c, profileId: "1" })),
  });
  const lives = market.lives.get("1")!;

  it("tells the destruction and the refounding instead of a namesake", () => {
    const titles = buildTimeline(lives, events).map((e) => [e.date, e.title]);
    expect(titles).toContainEqual(["2026-11-11", "Destruction"]);
    expect(titles).toContainEqual(["2026-11-09", "Refondation"]);
    expect(titles).toContainEqual(["2026-11-11", "Premier relevé après la refondation"]);
    expect(titles).toContainEqual(["2026-11-01", "Premier relevé KNX"]);
    expect(titles.filter(([, t]) => t.startsWith("Meilleur rang"))).toEqual([
      ["2026-11-01", "Meilleur rang : 5"],
    ]);
    expect(titles.some(([, t]) => t.includes("même nom"))).toBe(false);
  });

  it("keeps each entry with its life", () => {
    const timeline = buildTimeline(lives, events);
    expect(timeline.find((e) => e.founding)?.companyId).toBe("2");
    expect(timeline.find((e) => e.title === "Destruction")?.companyId).toBe("1");
  });

  it("files an event under the life of its date", () => {
    expect(lifeAt(lives, "2026-11-05").id).toBe("1");
    expect(lifeAt(lives, "2026-11-12").id).toBe("2");
    expect(lifeAt(lives, "2025-01-01").id).toBe("1");
    expect(lifeAt(lives, "2026-11-09", true).id).toBe("2");
  });
});
