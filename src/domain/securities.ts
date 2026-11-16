import type { IsoDate } from "./types.ts";

/**
 * Operations on a corporation's securities, as KNX records them: the introduction that gives it a
 * share price, the divisions and consolidations that change the number of shares, the suspensions
 * and the exit from the cote. Shares belong to one life: a refounded corporation is a new company
 * and must be introduced again.
 */

export type OperationKind =
  | "introduction"
  | "split"
  | "reverse_split"
  | "suspension"
  | "resumption"
  | "withdrawal"
  | "capital_increase";

export interface SecurityOperation {
  id: string;
  /** The life whose shares the operation concerns. */
  companyId: string;
  date: IsoDate;
  kind: OperationKind;
  /** `introduction`: number of shares issued; `capital_increase`: new shares created. */
  shares: number | null;
  /** `split`: each share becomes `ratio` shares; `reverse_split`: `ratio` shares become one. */
  ratio: number | null;
  /** Why (a suspension, an exit) or what the direction announced. */
  note: string | null;
}

export const OPERATION_INFO: Record<OperationKind, { label: string; help: string }> = {
  introduction: {
    label: "Introduction en bourse",
    help: "La direction ouvre son capital : KNX publie dès ce jour un cours par titre, sa valeur divisée par le nombre de titres. La corporation vend ensuite une partie de ses titres par une offre, depuis la page Séance.",
  },
  split: {
    label: "Division",
    help: "Chaque titre devient plusieurs titres : le cours baisse d'autant, la valeur ne bouge pas.",
  },
  reverse_split: {
    label: "Regroupement",
    help: "Plusieurs titres n'en font plus qu'un : le cours monte d'autant, la valeur ne bouge pas.",
  },
  suspension: {
    label: "Suspension de cotation",
    help: "KNX cesse de publier le cours : le dernier cours reste affiché, marqué comme suspendu.",
  },
  resumption: {
    label: "Reprise de cotation",
    help: "Le cours est de nouveau publié chaque jour.",
  },
  withdrawal: {
    label: "Sortie de cote",
    help: "La corporation quitte la cote : plus de cours par titre ; KNX continue d'estimer sa valeur.",
  },
  capital_increase: {
    label: "Augmentation de capital",
    help: "Des titres nouveaux, vendus par une offre d'émission : le cours baisse d'autant tant que les fonds levés ne sont pas versés à la corporation en jeu. Inscrite par la clôture de la séance.",
  },
};

export const OPERATION_KINDS = Object.keys(OPERATION_INFO) as OperationKind[];

/**
 * Kinds an operator records by hand. A capital increase creates shares that investors hold: only
 * the close of an issue offer records it.
 */
export const MANUAL_KINDS = OPERATION_KINDS.filter((k) => k !== "capital_increase");

/** Kinds that carry a number of shares. */
export function carriesShares(kind: OperationKind): boolean {
  return kind === "introduction" || kind === "capital_increase";
}

export function isOperationKind(value: unknown): value is OperationKind {
  return typeof value === "string" && value in OPERATION_INFO;
}

export type ListingState = "listed" | "suspended" | "withdrawn";

/** Where a corporation's shares stand after an operation. */
export interface ListingStep {
  date: IsoDate;
  state: ListingState;
  /** Shares outstanding. */
  shares: number;
  /** Introduction that opened this listing. */
  introducedOn: IsoDate;
  operation: SecurityOperation;
}

/** Largest number of shares KNX records. */
export const MAX_SHARES = 1_000_000_000_000;
export const MAX_RATIO = 1000;

/** Operations of one life in the order they apply: by date, then as recorded. */
export function inOrder(operations: readonly SecurityOperation[]): SecurityOperation[] {
  return [...operations].sort((a, b) => a.date.localeCompare(b.date));
}

/** The step an operation leads to from `before`, or the reason it cannot apply. */
function nextStep(
  before: ListingStep | null,
  op: SecurityOperation,
): { step: ListingStep } | { error: string } {
  const listedOrSuspended = before !== null && before.state !== "withdrawn";
  const step = (state: ListingState, shares: number, introducedOn: IsoDate) => ({
    step: { date: op.date, state, shares, introducedOn, operation: op },
  });
  switch (op.kind) {
    case "introduction": {
      if (listedOrSuspended) return { error: "la corporation est déjà cotée" };
      const shares = op.shares ?? 0;
      if (!Number.isInteger(shares) || shares < 1 || shares > MAX_SHARES)
        return { error: "nombre de titres entier, d'au moins 1" };
      return step("listed", shares, op.date);
    }
    case "split":
    case "reverse_split": {
      if (!listedOrSuspended) return { error: "la corporation n'est pas cotée" };
      const ratio = op.ratio ?? 0;
      if (!Number.isInteger(ratio) || ratio < 2 || ratio > MAX_RATIO)
        return { error: `rapport entier entre 2 et ${MAX_RATIO}` };
      if (op.kind === "split") {
        const shares = before.shares * ratio;
        if (shares > MAX_SHARES) return { error: "trop de titres après la division" };
        return step(before.state, shares, before.introducedOn);
      }
      if (before.shares % ratio !== 0)
        return {
          error: `${before.shares} titres ne se regroupent pas par ${ratio} : choisir un rapport qui les divise`,
        };
      return step(before.state, before.shares / ratio, before.introducedOn);
    }
    case "suspension":
      if (before?.state !== "listed") return { error: "seule une cotation en cours se suspend" };
      return step("suspended", before.shares, before.introducedOn);
    case "resumption":
      if (before?.state !== "suspended") return { error: "la cotation n'est pas suspendue" };
      return step("listed", before.shares, before.introducedOn);
    case "withdrawal":
      if (!listedOrSuspended) return { error: "la corporation n'est pas cotée" };
      return step("withdrawn", before.shares, before.introducedOn);
    case "capital_increase": {
      if (!listedOrSuspended) return { error: "la corporation n'est pas cotée" };
      const added = op.shares ?? 0;
      if (!Number.isInteger(added) || added < 1)
        return { error: "nombre de titres entier, d'au moins 1" };
      if (before.shares + added > MAX_SHARES) return { error: "trop de titres après l'émission" };
      return step(before.state, before.shares + added, before.introducedOn);
    }
  }
}

/**
 * Replays a life's operations. Strict: throws on the first operation that cannot apply, in the
 * operator's words. Used before recording a change.
 */
export function checkOperations(operations: readonly SecurityOperation[]): ListingStep[] {
  const steps: ListingStep[] = [];
  for (const op of inOrder(operations)) {
    const next = nextStep(steps.at(-1) ?? null, op);
    if ("error" in next)
      throw new Error(`${OPERATION_INFO[op.kind].label} du ${op.date} : ${next.error}`);
    steps.push(next.step);
  }
  return steps;
}

/**
 * Replays a life's operations, skipping any that cannot apply (a base edited by hand): the cote
 * never breaks over one bad line.
 */
export function listingSteps(operations: readonly SecurityOperation[]): ListingStep[] {
  const steps: ListingStep[] = [];
  for (const op of inOrder(operations)) {
    const next = nextStep(steps.at(-1) ?? null, op);
    if ("step" in next) steps.push(next.step);
  }
  return steps;
}

/** Listing on `date`, after that day's operations; null before any introduction. */
export function stepOn(steps: readonly ListingStep[], date: IsoDate): ListingStep | null {
  let found: ListingStep | null = null;
  for (const step of steps) {
    if (step.date > date) break;
    found = step;
  }
  return found;
}

/**
 * Share count proposed at an introduction: a round number (1, 2, 2,5 or 5 × 10ⁿ) that puts the
 * first price near `target`.
 */
export function proposeShares(value: number, target: number): number {
  if (!(value > 0) || !(target > 0)) return 1;
  const raw = value / target;
  if (raw <= 1) return 1;
  const exponent = Math.floor(Math.log10(raw));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * 10 ** exponent);
  let best = candidates[0];
  for (const c of candidates)
    if (Math.abs(Math.log(c / raw)) < Math.abs(Math.log(best / raw))) best = c;
  return Math.max(1, Math.round(best));
}
