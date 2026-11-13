import { describe, expect, it } from "vite-plus/test";
import { parseReport } from "./report.ts";

const GAME_COPY = [
  "Corporations",
  "Class. \tNom \tChiffre \tCapital \tEmployés",
  "1 \tArmacham Technology \t677.085 \t27.120.847 \t4\r",
  "10 \tKessler Industries™ \t194.112 \t27.436.614 \t4\r",
  "25 \tL'Impact \t83.857 \t1.906.940 \t2\r",
  "52 \tParadox \t0 \t3.340 \t0",
].join("\n");

describe("parseReport", () => {
  it("reads the report exactly as the game copies it", () => {
    const { rows, errors } = parseReport(GAME_COPY);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual({
      name: "Armacham Technology",
      rank: 1,
      chiffre: 677_085,
      capital: 27_120_847,
      employees: 4,
    });
    expect(rows[1].name).toBe("Kessler Industries™");
    expect(rows[2].name).toBe("L'Impact");
    expect(rows[3]).toMatchObject({ chiffre: 0, capital: 3_340, employees: 0 });
  });

  it("accepts a report pasted with spaces instead of tabs", () => {
    const { rows, errors } = parseReport("3   Le Bar à Mine   54.211   12 130 308   5");
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      rank: 3,
      name: "Le Bar à Mine",
      chiffre: 54_211,
      capital: 12_130_308,
    });
  });

  it("reports unreadable lines and duplicates without dropping the rest", () => {
    const { rows, errors } = parseReport(
      [
        "1 \tRevestio \t552.286 \t22.143.988 \t2",
        "2 \tRevestio \t1 \t2 \t3",
        "deux \tMetropolis \tx \t1 \t2",
      ].join("\n"),
    );
    expect(rows).toHaveLength(1);
    expect(errors.map((e) => e.line)).toEqual([2, 3]);
    expect(errors[0].reason).toContain("deux fois");
  });
});
