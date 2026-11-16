/**
 * Investor accounts of the KNX market: a player's account, known by a five-digit login, and the
 * real Dreadcast credits it holds. The player pays the operator in the game, the operator records
 * the deposit; a withdrawal is requested on the site, paid in the game, then settled.
 */

export interface InvestorAccount {
  /** Supabase Auth user. */
  id: string;
  /** Five digits, typed to sign in. */
  login: string;
  /** The character's name. */
  displayName: string;
  /** Still on the temporary password the operator handed over. */
  mustChangePassword: boolean;
  note: string | null;
  closedAt: string | null;
  createdAt: string;
  /** Pages (company profiles) the player is declared an insider of: no trading their shares. */
  insiderOf: string[];
  /** The player chose to appear in the public ranking. */
  publicRanking: boolean;
  /** Set for a corporation's own account: the page it belongs to. */
  companyProfileId: string | null;
}

export type CashKind = "deposit" | "withdrawal";
export type CashStatus = "requested" | "done" | "cancelled";

export interface CashMovement {
  id: string;
  accountId: string;
  kind: CashKind;
  /** Credits, always positive: the kind says which way. */
  amount: number;
  status: CashStatus;
  note: string | null;
  requestedAt: string;
  settledAt: string | null;
}

export const CASH_KIND_LABELS: Record<CashKind, string> = {
  deposit: "Dépôt",
  withdrawal: "Retrait",
};

export const CASH_STATUS_LABELS: Record<CashStatus, string> = {
  requested: "en attente",
  done: "réglé",
  cancelled: "annulé",
};

/** Largest amount of one movement, as the database checks it. */
export const MAX_MOVEMENT = 1_000_000_000_000;
/** Shortest password a player may choose. */
export const MIN_PASSWORD = 10;

export function isLogin(text: string): boolean {
  return /^\d{5}$/.test(text);
}

/**
 * The address the auth service knows a player by. Players never see it: they sign in with their
 * five digits. `example.com` never receives mail, and none is ever sent to these accounts.
 */
export function investorEmail(login: string): string {
  if (!isLogin(login)) throw new Error("identifiant de cinq chiffres attendu");
  return `knx-${login}@example.com`;
}

/** Why a password is refused, in the player's words; null when it is fine. */
export function passwordProblem(password: string, login: string | null = null): string | null {
  if (password.length < MIN_PASSWORD) return `au moins ${MIN_PASSWORD} caractères`;
  if (login !== null && password.includes(login)) return "sans votre identifiant";
  if (/^(.)\1+$/.test(password)) return "pas un seul caractère répété";
  return null;
}

/** Balance of an account: settled credits, withdrawals awaiting payment, and what is free. */
export function cashBalance(movements: readonly CashMovement[]): {
  balance: number;
  pending: number;
  available: number;
} {
  let balance = 0;
  let pending = 0;
  for (const m of movements) {
    if (m.status === "done") balance += m.kind === "deposit" ? m.amount : -m.amount;
    else if (m.status === "requested" && m.kind === "withdrawal") pending += m.amount;
  }
  return { balance, pending, available: balance - pending };
}

/** An amount typed by hand: `1 500 000`, `1.500.000`, `1500000`. Null when not a whole amount. */
export function parseCredits(text: string): number | null {
  const cleaned = text.replace(/[\s.  '¢]/g, "");
  if (!/^\d+$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isSafeInteger(value) && value >= 1 && value <= MAX_MOVEMENT ? value : null;
}

/** Letters and digits that read without doubt (no 0/O, 1/l/I). */
const READABLE = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A temporary password to hand over: 14 readable characters from a secure source. */
export function temporaryPassword(random: (n: number) => Uint8Array = randomBytes): string {
  const out: string[] = [];
  // Rejection sampling keeps every character equally likely.
  const limit = 256 - (256 % READABLE.length);
  while (out.length < 14) {
    for (const byte of random(32)) {
      if (byte < limit) out.push(READABLE[byte % READABLE.length]);
      if (out.length === 14) break;
    }
  }
  return out.join("");
}

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}
