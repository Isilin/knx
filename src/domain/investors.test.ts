import { describe, expect, it } from "vite-plus/test";
import {
  cashBalance,
  investorEmail,
  isLogin,
  parseCredits,
  passwordProblem,
  temporaryPassword,
  type CashMovement,
} from "./investors.ts";

let seq = 0;
const move = (o: Pick<CashMovement, "kind" | "amount" | "status">): CashMovement => ({
  id: String(++seq),
  accountId: "a",
  note: null,
  requestedAt: "2026-11-15T10:00:00Z",
  settledAt: null,
  ...o,
});

describe("investor accounts", () => {
  it("knows a player by five digits", () => {
    expect(isLogin("04217")).toBe(true);
    expect(isLogin("4217")).toBe(false);
    expect(isLogin("042170")).toBe(false);
    expect(isLogin("0421a")).toBe(false);
    expect(investorEmail("04217")).toBe("knx-04217@example.com");
    expect(() => investorEmail("abc")).toThrow(/cinq chiffres/);
  });

  it("refuses short, login-bearing or repeated passwords", () => {
    expect(passwordProblem("court")).toMatch(/10 caractères/);
    expect(passwordProblem("monmotde04217passe", "04217")).toMatch(/identifiant/);
    expect(passwordProblem("aaaaaaaaaaaa")).toMatch(/répété/);
    expect(passwordProblem("Raffinerie-du-Secteur-9", "04217")).toBeNull();
  });

  it("counts settled credits and holds pending withdrawals", () => {
    const balance = cashBalance([
      move({ kind: "deposit", amount: 5_000_000, status: "done" }),
      move({ kind: "withdrawal", amount: 1_000_000, status: "done" }),
      move({ kind: "withdrawal", amount: 500_000, status: "requested" }),
      move({ kind: "withdrawal", amount: 9_000_000, status: "cancelled" }),
    ]);
    expect(balance).toEqual({ balance: 4_000_000, pending: 500_000, available: 3_500_000 });
  });

  it("reads amounts typed by hand", () => {
    expect(parseCredits("1 500 000")).toBe(1_500_000);
    expect(parseCredits("1.500.000 ¢")).toBe(1_500_000);
    expect(parseCredits("0")).toBeNull();
    expect(parseCredits("12,5")).toBeNull();
    expect(parseCredits("")).toBeNull();
  });

  it("draws temporary passwords from the readable alphabet only", () => {
    const password = temporaryPassword();
    expect(password).toHaveLength(14);
    expect(password).toMatch(/^[a-km-zA-HJ-NP-Z2-9]+$/);
    expect(passwordProblem(password)).toBeNull();
    // Bytes beyond the last whole alphabet cycle are skipped, never folded in.
    let calls = 0;
    const biased = (n: number) => {
      calls += 1;
      return new Uint8Array(n).fill(calls === 1 ? 255 : 0);
    };
    expect(temporaryPassword(biased)).toBe("a".repeat(14));
  });
});
