import { formatFactor, formatInteger, formatShare } from "../domain/numbers.ts";
import { CATEGORY_INFO, CONFIDENCE_INFO, RATING_METHOD } from "../domain/rating.ts";
import { OPERATION_INFO, type SecurityOperation } from "../domain/securities.ts";
import type { CompanyValuation, ValuationParams } from "../domain/valuation.ts";
import type { ChartMarker } from "./TimeChart.tsx";

/** What an operation did, in a few words. */
export function operationDetail(op: SecurityOperation): string {
  switch (op.kind) {
    case "introduction":
      return `${formatInteger(op.shares ?? 0)} titres émis`;
    case "split":
      return `1 titre devient ${op.ratio}`;
    case "reverse_split":
      return `${op.ratio} titres n'en font plus qu'un`;
    default:
      return "";
  }
}

const SHORT: Record<SecurityOperation["kind"], string> = {
  introduction: "Introduction",
  split: "Division",
  reverse_split: "Regroupement",
  suspension: "Suspension",
  resumption: "Reprise",
  withdrawal: "Sortie de cote",
};

/** Chart rules at each operation on the corporation's securities. */
export function operationMarkers(operations: readonly SecurityOperation[]): ChartMarker[] {
  return operations.map((op) => ({
    id: `op-${op.id}`,
    date: op.date,
    label: SHORT[op.kind],
    title: `${OPERATION_INFO[op.kind].label}${operationDetail(op) ? ` : ${operationDetail(op)}` : ""}`,
  }));
}

/** Where a corporation's shares stand, in a few words. */
export function listingLabel(valuation: CompanyValuation | null): string {
  const listing = valuation?.listing;
  if (!listing) return "non introduite";
  if (listing.state === "suspended") return "cotation suspendue";
  if (listing.state === "withdrawn") return "sortie de cote";
  return "cotée";
}

/** Every lever, in the order the method reads them, with what it does in words. */
export const LEVERS: {
  key: string;
  label: string;
  read: (p: ValuationParams) => string;
  help: string;
}[] = [
  {
    key: "revenueDays",
    label: "Jours de recettes",
    read: (p) => `${formatInteger(p.revenueDays)} jours`,
    help: "Ce que vaut le fonds de commerce : autant de jours de CA réel.",
  },
  {
    key: "revenueWindow",
    label: "Fenêtre du CA",
    read: (p) => `${p.revenueWindow} jours`,
    help: "Jours de CA réel lus avant chaque relevé.",
  },
  {
    key: "spikeCap",
    label: "Écrêtement des pics",
    read: (p) => `${formatFactor(p.spikeCap)} jours ordinaires`,
    help: "Un jour ne compte jamais plus que ce nombre de jours ordinaires de la corporation : une vente à soi-même à prix exorbitant ne gonfle pas la valeur.",
  },
  {
    key: "spikeLookback",
    label: "Jour ordinaire",
    read: (p) => `médiane des jours actifs sur ${p.spikeLookback} jours`,
    help: "La référence de l'écrêtement : une hausse qui dure devient l'ordinaire.",
  },
  {
    key: "maturityHalf",
    label: "Demi-maturité",
    read: (p) => `${formatInteger(p.maturityHalf)} jours`,
    help: "Âge auquel une corporation compte pour moitié : maturité = âge ÷ (âge + demi-maturité).",
  },
  {
    key: "capitalWeight",
    label: "Poids du capital",
    read: (p) => formatShare(p.capitalWeight),
    help: "Part du capital retenu comptée dans la valeur : la direction peut retirer sa trésorerie demain.",
  },
  {
    key: "capitalWindow",
    label: "Fenêtre du capital",
    read: (p) => `${p.capitalWindow} jours`,
    help: "Le capital retenu est le plus bas du capital du jour et de sa moyenne sur cette fenêtre : une injection compte quand elle dure, un retrait tout de suite.",
  },
  {
    key: "categoryMultipliers",
    label: "Multiplicateurs de l'Agence",
    read: (p) =>
      RATING_METHOD.categories
        .map(([c]) => `${CATEGORY_INFO[c].symbol} ${formatFactor(p.categoryMultipliers[c])}`)
        .join(" · "),
    help: "La catégorie de la notation en vigueur multiplie la valeur.",
  },
  {
    key: "unratedMultiplier",
    label: "Sans notation",
    read: (p) => `× ${formatFactor(p.unratedMultiplier)}`,
    help: "Décote d'opacité d'une corporation que l'Agence n'a pas notée, ou dont la notation a expiré.",
  },
  {
    key: "confidenceBands",
    label: "Fourchettes",
    read: (p) =>
      (["high", "standard", "low"] as const)
        .map((c) => `${CONFIDENCE_INFO[c].label} ± ${formatShare(p.confidenceBands[c])}`)
        .join(" · ") + ` · sans notation ± ${formatShare(p.unratedBand)}`,
    help: "Largeur de la fourchette publiée autour de la valeur, selon la confiance de la notation.",
  },
  {
    key: "ratingValidity",
    label: "Validité d'une notation",
    read: (p) => `${p.ratingValidity} jours`,
    help: "Au-delà, la notation ne compte plus : la corporation est lue comme non notée.",
  },
  {
    key: "minHistory",
    label: "Observation",
    read: (p) => `${p.minHistory} jours de recettes connues`,
    help: "Avant, KNX ne publie pas de valeur : une corporation nouvelle reste en observation.",
  },
  {
    key: "premisesWeights",
    label: "Poids du local",
    read: (p) =>
      `terrain ${formatShare(p.landWeight)} · bâtiment ${formatShare(p.buildingWeight)} · aménagement ${formatShare(p.fittingsWeight)}`,
    help: "Part du prix comptée selon ce qui se revend : le terrain seul, le bâtiment avec son terrain, l'aménagement seulement avec la boutique installée.",
  },
  {
    key: "stockWeight",
    label: "Poids du stock",
    read: (p) => `${formatShare(p.stockWeight)} du prix d'achat, éteint en ${p.stockLife} jours`,
    help: "Le stock compte à son prix d'achat, puis s'efface faute de nouveau chiffre : il se vend.",
  },
  {
    key: "declaredWeight",
    label: "Chiffre déclaré",
    read: (p) => `compté à ${formatShare(p.declaredWeight)}`,
    help: "Un montant déclaré par la direction compte moins qu'un montant audité par l'Agence, compté en entier.",
  },
  {
    key: "listedDeclaredWeight",
    label: "Chiffre déclaré, corporation cotée",
    read: (p) => `compté à ${formatShare(p.listedDeclaredWeight)}`,
    help: "Une fois des crédits réels engagés sur le cours, seul ce qui a été audité devrait compter.",
  },
  {
    key: "commission",
    label: "Commission et écart",
    read: (p) =>
      `commission ${formatShare(p.commission)} · écart achat-vente ${formatShare(p.spread)}`,
    help: "À chaque séance, l'acheteur paie le fixing plus la moitié de l'écart, le vendeur reçoit le fixing moins l'autre moitié ; la commission s'ajoute de part et d'autre.",
  },
  {
    key: "premium",
    label: "Prime de marché",
    read: (p) =>
      `sensibilité ${formatFactor(p.premiumSensitivity)} · demi-vie ${formatFactor(p.premiumHalfLife)} séance${p.premiumHalfLife > 1 ? "s" : ""} · bornée à ± ${formatShare(p.premiumBand)}`,
    help: "Le fixing s'écarte du cours KNX selon le solde des ordres : plus d'achats que de ventes, il monte ; la prime s'efface ensuite de séance en séance.",
  },
  {
    key: "caps",
    label: "Plafonds de détention",
    read: (p) =>
      `joueurs réunis ${formatShare(p.holdCap)} · par joueur ${formatShare(p.playerCap)}`,
    help: "Part des titres d'une corporation que les joueurs peuvent détenir face à la Banque impériale, teneur de marché.",
  },
  {
    key: "carryFee",
    label: "Report des ordres",
    read: (p) => `jusqu'à 4 séances · frais de ${formatShare(p.carryFee)} du montant par report`,
    help: "Un ordre non servi faute d'atteindre sa limite passe à la séance suivante tant qu'il lui en reste, contre ces frais ; sans crédits pour les couvrir, il expire.",
  },
  {
    key: "introductionPrice",
    label: "Cours d'introduction proposé",
    read: (p) => `${formatInteger(p.introductionPrice)} ¢`,
    help: "À l'introduction, KNX propose un nombre rond de titres qui met le premier cours près de ce montant ; la direction choisit.",
  },
];

/** Levers whose reading changed from one version to the next. */
export function changedLevers(before: ValuationParams, after: ValuationParams): string[] {
  return LEVERS.filter((l) => l.read(before) !== l.read(after)).map(
    (l) => `${l.label} : ${l.read(before)} → ${l.read(after)}`,
  );
}
