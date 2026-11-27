import { formatFactor, formatInteger, formatShare } from "../domain/numbers.ts";
import { CATEGORY_INFO, CONFIDENCE_INFO, RATING_METHOD } from "../domain/rating.ts";
import { SECTORS } from "../domain/sectors.ts";
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
    case "capital_increase":
      return `${formatInteger(op.shares ?? 0)} titres nouveaux`;
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
  capital_increase: "Émission",
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
    label: "Commission",
    read: (p) => `${formatShare(p.commission)} de chaque exécution`,
    help: "Prélevée sur l'acheteur comme sur le vendeur, et sur le produit d'une offre : c'est la seule recette de la Bourse, qui n'est jamais contrepartie.",
  },
  {
    key: "auction",
    label: "Enchère de séance",
    read: () => "le prix qui fait se rencontrer le plus de titres",
    help: "À chaque clôture, entre les ordres des investisseurs : à égalité, le prix qui laisse le moins de titres sans contrepartie, puis le plus proche du cours KNX.",
  },
  {
    key: "offers",
    label: "Offres des corporations",
    read: (p) =>
      `au plus ${formatShare(p.maxOffer)} des titres · prix à ± ${formatShare(p.offerBand)} du cours KNX`,
    help: "Une corporation vend une partie de ses titres, ou en émet de nouveaux (augmentation de capital), pendant une séance ; chacun est servi, au prorata si l'offre est dépassée, et le produit va à la corporation.",
  },
  {
    key: "dividends",
    label: "Dividendes",
    read: () => "annoncés pendant la séance, versés à sa clôture",
    help: "Une corporation qui distribue annonce un montant par titre, couvert par ses crédits KNX ; à la clôture, avant l'enchère, chaque détenteur reçoit sa part, arrondie au crédit inférieur. Qui achète à cette séance achète sans le dividende.",
  },
  {
    key: "carryFee",
    label: "Report des ordres",
    read: (p) => `jusqu'à 4 séances · frais de ${formatShare(p.carryFee)} du montant par report`,
    help: "Un ordre non servi faute d'atteindre sa limite passe à la séance suivante tant qu'il lui en reste, contre ces frais ; sans crédits pour les couvrir, il expire.",
  },
  {
    key: "freeze",
    label: "Gel des comptes",
    read: () => "succession ou saisie de la DAI",
    help: "À la mort d'un personnage ou sur saisie de la DAI, KNX gèle son compte : ordres et retraits annulés, les dividendes continuent d'arriver. Le compte se dénoue au cas par cas : transmission aux héritiers ou à l'Empire, vente au marché, rachat par la corporation.",
  },
  {
    key: "wages",
    label: "Salaires de référence",
    read: (p) =>
      [
        ...SECTORS.map((s) => `${s.short} ${formatInteger(p.sectorWages[s.id])} ¢`),
        `tous secteurs ${formatInteger(p.defaultWage)} ¢`,
      ].join(" · "),
    help: "Salaire supposé d'un salarié payé, par jour, quand l'Agence n'a pas audité celui de la corporation ; le DG n'est pas payé. Ils séparent, dans la trésorerie, les salaires des autres flux.",
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
