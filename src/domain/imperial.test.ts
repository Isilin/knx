import { describe, expect, it } from "vite-plus/test";
import {
  addImperialYears,
  formatImperialAge,
  formatImperialDate,
  formatImperialYear,
  formatPti,
  imperialAge,
  imperialTicks,
  imperialYear,
  toImperial,
} from "./imperial.ts";

describe("imperial dates", () => {
  it("counts one imperial year per real month, 393 in November 2026", () => {
    expect(imperialYear("2026-11-13")).toBe(393);
    expect(imperialYear("2026-12-01")).toBe(394);
    expect(imperialYear("2027-01-01")).toBe(395);
    expect(imperialYear("2026-10-31")).toBe(392);
    expect(imperialYear("2007-01-01")).toBe(155);
  });

  it("cuts the month into heptades starting on the 1st", () => {
    expect(toImperial("2026-11-01")).toEqual({ day: 1, heptade: 1, year: 393 });
    expect(toImperial("2026-11-07")).toEqual({ day: 7, heptade: 1, year: 393 });
    expect(toImperial("2026-11-08")).toEqual({ day: 1, heptade: 2, year: 393 });
    expect(toImperial("2026-11-28")).toEqual({ day: 7, heptade: 4, year: 393 });
    expect(toImperial("2026-11-30")).toEqual({ day: 2, heptade: 5, year: 393 });
    expect(toImperial("2026-12-31")).toEqual({ day: 3, heptade: 5, year: 394 });
  });

  it("formats both imperial notations", () => {
    expect(formatImperialDate("2026-11-13")).toBe("6/393.2");
    expect(formatImperialDate("2026-11-29")).toBe("1/393.5");
    expect(formatImperialDate("2002-01-05")).toBe("5/095.1");
    expect(formatPti("2026-11-13")).toBe("PTI 13112026");
    expect(formatPti("2019-04-02")).toBe("PTI 02042019");
    expect(formatImperialYear("2026-11-13")).toBe("an 393");
  });

  it("moves by imperial years, clamping to a shorter year", () => {
    expect(addImperialYears("2026-11-13", -1)).toBe("2026-10-13");
    expect(addImperialYears("2026-11-13", -12)).toBe("2025-11-13");
    expect(addImperialYears("2026-03-31", -1)).toBe("2026-02-28");
    expect(addImperialYears("2026-12-15", 1)).toBe("2027-01-15");
  });
});

describe("imperialTicks", () => {
  it("marks every day on a very short span", () => {
    expect(imperialTicks("2026-11-11", "2026-11-13", 6).map((t) => t.label)).toEqual([
      "4/393.2",
      "5/393.2",
      "6/393.2",
    ]);
  });

  it("marks heptade starts on a year or so, skipping fifth heptades", () => {
    expect(imperialTicks("2026-10-14", "2026-11-13", 6).map((t) => t.date)).toEqual([
      "2026-10-15",
      "2026-10-22",
      "2026-11-01",
      "2026-11-08",
    ]);
  });

  it("falls back to round imperial years on long spans", () => {
    const ticks = imperialTicks("2007-01-01", "2026-11-13", 6);
    expect(ticks.length).toBeLessThanOrEqual(6);
    expect(ticks.map((t) => t.label)).toEqual(["an 200", "an 250", "an 300", "an 350"]);
    expect(ticks[0].date).toBe("2010-10-01");
  });

  it("never exceeds the requested count", () => {
    for (const [start, end] of [
      ["2026-01-01", "2026-11-13"],
      ["2025-11-13", "2026-11-13"],
      ["2026-08-13", "2026-11-13"],
    ]) {
      for (const max of [2, 3, 5, 8]) {
        expect(imperialTicks(start, end, max).length).toBeLessThanOrEqual(max);
      }
    }
  });
});

describe("imperialAge", () => {
  it("turns whole real months into years and the rest into heptades and days", () => {
    expect(imperialAge("2026-10-10", "2026-11-13")).toEqual({ years: 1, heptades: 0, days: 3 });
    expect(imperialAge("2019-04-02", "2026-11-13")).toEqual({ years: 91, heptades: 1, days: 4 });
    expect(imperialAge("2026-11-01", "2026-11-13")).toEqual({ years: 0, heptades: 1, days: 5 });
  });

  it("borrows a month when the day of the month is not reached yet", () => {
    expect(imperialAge("2026-09-20", "2026-11-13")).toEqual({ years: 1, heptades: 3, days: 3 });
  });

  it("clamps the anniversary to the end of a shorter month", () => {
    expect(imperialAge("2026-01-31", "2026-02-28")).toEqual({ years: 1, heptades: 0, days: 0 });
    expect(imperialAge("2026-01-31", "2026-03-30")).toEqual({ years: 1, heptades: 4, days: 2 });
    expect(imperialAge("2026-01-31", "2026-03-31")).toEqual({ years: 2, heptades: 0, days: 0 });
  });

  it("is zero on the creation day and before it", () => {
    expect(imperialAge("2026-11-13", "2026-11-13")).toEqual({ years: 0, heptades: 0, days: 0 });
    expect(imperialAge("2026-11-14", "2026-11-13")).toEqual({ years: 0, heptades: 0, days: 0 });
  });
});

describe("formatImperialAge", () => {
  it("lists the non-zero parts in French", () => {
    expect(formatImperialAge({ years: 235, heptades: 2, days: 3 })).toBe(
      "235 ans, 2 heptades et 3 jours",
    );
    expect(formatImperialAge({ years: 1, heptades: 0, days: 1 })).toBe("1 an et 1 jour");
    expect(formatImperialAge({ years: 0, heptades: 1, days: 0 })).toBe("1 heptade");
    expect(formatImperialAge({ years: 0, heptades: 0, days: 0 })).toBe("0 jour");
  });
});
