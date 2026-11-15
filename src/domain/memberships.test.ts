import { describe, expect, it } from "vite-plus/test";
import { buildMarket, consortiumOn } from "./market.ts";
import { cleanMemberships, covers, membershipOn } from "./memberships.ts";
import { testDataset } from "./testing.ts";
import { buildTimeline } from "./timeline.ts";

const known = new Set(["a", "b"]);

describe("cleanMemberships", () => {
  it("orders periods, open start first", () => {
    const periods = cleanMemberships(
      [
        { consortiumId: "b", joinedOn: "2026-06-01", leftOn: null },
        { consortiumId: "a", joinedOn: null, leftOn: "2026-06-01" },
      ],
      known,
    );
    expect(periods.map((p) => p.consortiumId)).toEqual(["a", "b"]);
  });

  it("refuses overlaps, two open periods and reversed dates", () => {
    expect(() =>
      cleanMemberships(
        [
          { consortiumId: "a", joinedOn: null, leftOn: "2026-06-02" },
          { consortiumId: "b", joinedOn: "2026-06-01", leftOn: null },
        ],
        known,
      ),
    ).toThrow("se chevauchent");
    expect(() =>
      cleanMemberships(
        [
          { consortiumId: "a", joinedOn: null, leftOn: null },
          { consortiumId: "b", joinedOn: "2026-06-01", leftOn: null },
        ],
        known,
      ),
    ).toThrow("se chevauchent");
    expect(() =>
      cleanMemberships(
        [{ consortiumId: "a", joinedOn: "2026-06-01", leftOn: "2026-05-01" }],
        known,
      ),
    ).toThrow("doit suivre");
    expect(() =>
      cleanMemberships([{ consortiumId: "", joinedOn: null, leftOn: null }], known),
    ).toThrow("sans consortium");
  });

  it("merges touching periods of the same consortium", () => {
    const periods = cleanMemberships(
      [
        { consortiumId: "a", joinedOn: "2026-01-01", leftOn: "2026-03-01" },
        { consortiumId: "a", joinedOn: "2026-03-01", leftOn: null },
      ],
      known,
    );
    expect(periods).toEqual([{ consortiumId: "a", joinedOn: "2026-01-01", leftOn: null }]);
  });
});

describe("membershipOn", () => {
  const periods = [
    { consortiumId: "a", joinedOn: null, leftOn: "2026-06-01" },
    { consortiumId: "b", joinedOn: "2026-06-01", leftOn: "2026-09-01" },
  ];

  it("covers the joining day and not the leaving day", () => {
    expect(covers(periods[1], "2026-06-01")).toBe(true);
    expect(covers(periods[1], "2026-09-01")).toBe(false);
    expect(membershipOn(periods, "2020-01-01")?.consortiumId).toBe("a");
    expect(membershipOn(periods, "2026-06-01")?.consortiumId).toBe("b");
    expect(membershipOn(periods, "2026-10-01")).toBeNull();
  });
});

describe("dated memberships in the market", () => {
  const row = (companyId: string, chiffre: number) => ({
    companyId,
    rank: null,
    chiffre,
    capital: 1_000,
    employees: 1,
  });
  const dataset = testDataset({
    generatedAt: "2026-11-13T00:00:00Z",
    companies: [
      { id: "1", name: "Mobile" },
      { id: "2", name: "Fermée", closedOn: "2026-11-12" },
    ],
    consortiums: [
      { id: "a", name: "Armacham", color: "cyan" },
      { id: "b", name: "Triaxis", color: "bleu" },
    ],
    memberships: [
      { id: "m1", profileId: "1", consortiumId: "a", joinedOn: null, leftOn: "2026-11-11" },
      { id: "m2", profileId: "1", consortiumId: "b", joinedOn: "2026-11-11", leftOn: null },
      { id: "m3", profileId: "2", consortiumId: "a", joinedOn: "2026-11-01", leftOn: "2026-11-12" },
    ],
    events: [],
    marketEvents: [],
    snapshots: [
      { date: "2026-11-10", source: "paste", rows: [row("1", 100), row("2", 50)] },
      { date: "2026-11-11", source: "paste", rows: [row("1", 110), row("2", 50)] },
      { date: "2026-11-12", source: "paste", rows: [row("1", 120)] },
    ],
  });
  const market = buildMarket(dataset);
  const mobile = market.bySlug.get("mobile")!;

  it("shows the consortium of the latest report, and keeps the dated history", () => {
    expect(mobile.consortium?.name).toBe("Triaxis");
    expect(consortiumOn(mobile, "2026-11-10")?.name).toBe("Armacham");
    expect(consortiumOn(mobile, "2026-11-11")?.name).toBe("Triaxis");
    expect(mobile.memberships.map((m) => m.consortium.name)).toEqual(["Armacham", "Triaxis"]);
  });

  it("gives a closed corporation the consortium of its last report", () => {
    expect(market.bySlug.get("fermee")?.consortium?.name).toBe("Armacham");
  });

  it("writes the moves in the history", () => {
    const titles = buildTimeline(market.lives.get(mobile.profileId)!, []).map((e) => e.title);
    expect(titles).toContain("Quitte le consortium Armacham pour Triaxis");
    expect(titles.filter((t) => t.includes("consortium"))).toHaveLength(1);
    const closed = market.bySlug.get("fermee")!;
    const closedTitles = buildTimeline([closed], []).map((e) => e.title);
    expect(closedTitles).toEqual(
      expect.arrayContaining(["Rejoint le consortium Armacham", "Quitte le consortium Armacham"]),
    );
  });
});
