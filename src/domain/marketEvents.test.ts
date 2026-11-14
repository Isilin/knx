import { describe, expect, it } from "vite-plus/test";
import { buildMarket } from "./market.ts";
import { listedOn, marketEventLabel, marketEventsBetween } from "./marketEvents.ts";
import { applyOp, normalizeDataset } from "./mutations.ts";
import { datasetByName } from "./testing.ts";
import { buildTimeline } from "./timeline.ts";
import type { MarketEvent } from "./types.ts";

const breach: MarketEvent = {
  id: "m1",
  date: "2026-03-23",
  label: "ZD-385",
  title: "Faille ZD-385",
  description: "Les capitaux au-delà de 30 M¢ peuvent être piratés.",
  span: 7,
};

describe("market events", () => {
  it("print the short label, or the title", () => {
    expect(marketEventLabel(breach)).toBe("ZD-385");
    expect(marketEventLabel({ ...breach, label: null })).toBe("Faille ZD-385");
  });

  it("meet the intervals between reports that overlap their span", () => {
    const between = (from: string, to: string) =>
      marketEventsBetween([breach], from, to).map((e) => e.id);
    expect(between("2026-03-19", "2026-03-24")).toEqual(["m1"]);
    // The span runs from the 23rd to the 29th.
    expect(between("2026-03-24", "2026-03-28")).toEqual(["m1"]);
    expect(between("2026-03-28", "2026-04-06")).toEqual(["m1"]);
    expect(between("2026-03-29", "2026-04-06")).toEqual([]);
    expect(between("2026-03-10", "2026-03-22")).toEqual([]);
    expect(between("2026-03-10", "2026-03-23")).toEqual(["m1"]);
  });

  it("concern the corporations listed on their date", () => {
    const company = {
      firstSeen: "2026-01-01",
      closedOn: null,
      status: "active" as const,
      latest: { date: "2026-03-20" },
    };
    expect(listedOn(company, "2026-03-23")).toBe(true);
    expect(listedOn({ ...company, firstSeen: "2026-04-01" }, "2026-03-23")).toBe(false);
    expect(listedOn({ ...company, closedOn: "2026-03-23" }, "2026-03-23")).toBe(false);
    expect(listedOn({ ...company, closedOn: "2026-03-24" }, "2026-03-23")).toBe(true);
    expect(listedOn({ ...company, status: "delisted" }, "2026-03-23")).toBe(false);
  });
});

describe("market events in a corporation's history", () => {
  const row = (name: string, chiffre: number, capital: number) => ({
    name,
    rank: null,
    chiffre,
    capital,
    employees: 3,
  });
  const dataset = {
    ...datasetByName({
      generatedAt: "2026-04-01T00:00:00Z",
      companies: [
        { name: "Coffre", creationOverride: "2026-01-01" },
        { name: "Tardive", creationOverride: "2026-03-25" },
      ],
      snapshots: [
        { date: "2026-03-19", source: "paste", rows: [row("Coffre", 1_000, 60_000_000)] },
        { date: "2026-03-24", source: "paste", rows: [row("Coffre", 1_000, 29_000_000)] },
        {
          date: "2026-03-30",
          source: "paste",
          rows: [row("Coffre", 1_000, 29_005_000), row("Tardive", 500, 100_000)],
        },
      ],
    }),
    marketEvents: [breach],
  };
  const market = buildMarket(dataset);
  const timeline = (slug: string) =>
    buildTimeline(market.bySlug.get(slug)!, [], market.marketEvents);

  it("show the event to corporations listed that day only", () => {
    expect(timeline("coffre").find((e) => e.origin === "market")).toMatchObject({
      date: "2026-03-23",
      title: "Faille ZD-385",
      note: breach.description,
      market: breach,
    });
    expect(timeline("tardive").some((e) => e.origin === "market")).toBe(false);
  });

  it("tie the outflow measured across the event to it", () => {
    const flow = timeline("coffre").find((e) => e.key.startsWith("flow-"));
    expect(flow?.title).toMatch(/^Sortie hors CA/);
    expect(flow?.note).toBe("Coïncide avec « Faille ZD-385 ».");
  });
});

describe("market event mutations", () => {
  const base = normalizeDataset({
    generatedAt: "2026-04-01T00:00:00Z",
    companies: [],
    snapshots: [],
  });

  it("default to no market event", () => {
    expect(base.marketEvents).toEqual([]);
  });

  it("add, edit and remove an event, trimmed", () => {
    const added = applyOp(base, {
      type: "saveMarketEvent",
      event: { ...breach, title: "  Faille ZD-385 ", label: " ", description: "" },
    });
    expect(added.marketEvents).toEqual([
      { ...breach, title: "Faille ZD-385", label: null, description: null },
    ]);
    const edited = applyOp(added, { type: "saveMarketEvent", event: { ...breach, span: 10 } });
    expect(edited.marketEvents).toEqual([{ ...breach, span: 10 }]);
    expect(applyOp(edited, { type: "deleteMarketEvent", id: "m1" }).marketEvents).toEqual([]);
  });

  it("refuse an empty title or a span out of range", () => {
    expect(() =>
      applyOp(base, { type: "saveMarketEvent", event: { ...breach, title: " " } }),
    ).toThrow("titre d'évènement vide");
    expect(() => applyOp(base, { type: "saveMarketEvent", event: { ...breach, span: 0 } })).toThrow(
      "durée entre 1 et 90 jours",
    );
  });
});
