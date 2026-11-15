/**
 * Fixed list of business sectors a corporation can be filed under. The keys are stored as is in
 * `company_profiles.sector`; the SQL check constraint lists the same keys.
 */
export const SECTORS = [
  {
    id: "agence-immobiliere",
    label: "Agence immobilière",
    short: "Immobilier",
    plural: "agences immobilières",
  },
  { id: "banque", label: "Banque", short: "Banque", plural: "banques" },
  { id: "bar-restaurant", label: "Bar / restaurant", short: "Bar", plural: "bars et restaurants" },
  { id: "boutique-armes", label: "Boutique d'armes", short: "Armes", plural: "boutiques d'armes" },
  {
    id: "boutique-equipement",
    label: "Boutique d'équipement",
    short: "Équipement",
    plural: "boutiques d'équipement",
  },
  {
    id: "boutique-specialisee",
    label: "Boutique spécialisée",
    short: "Spécialisée",
    plural: "boutiques spécialisées",
  },
  { id: "usine-production", label: "Usine de production", short: "Usine", plural: "usines" },
  { id: "technopole", label: "Technopôle", short: "Technopôle", plural: "technopôles" },
  {
    id: "atelier-personnalisation",
    label: "Atelier de personnalisation",
    short: "Atelier",
    plural: "ateliers",
  },
] as const;

export type SectorId = (typeof SECTORS)[number]["id"];

const BY_ID = new Map<string, (typeof SECTORS)[number]>(SECTORS.map((s) => [s.id, s]));

export function isSectorId(value: unknown): value is SectorId {
  return typeof value === "string" && BY_ID.has(value);
}

export function sectorLabel(id: SectorId | null): string | null {
  return id ? (BY_ID.get(id)?.label ?? null) : null;
}

/** Short label for chips and dense lines: `Immobilier`, `Armes`. */
export function sectorShort(id: SectorId): string {
  return BY_ID.get(id)?.short ?? id;
}

/** Plural, lower case, for running text: `2ᵉ des 5 banques`. */
export function sectorPlural(id: SectorId): string {
  return BY_ID.get(id)?.plural ?? id;
}
