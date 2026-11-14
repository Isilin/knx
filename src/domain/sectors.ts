/**
 * Fixed list of business sectors a corporation can be filed under. The keys are stored as is in
 * `companies.sector`; the SQL check constraint lists the same keys.
 */
export const SECTORS = [
  { id: "agence-immobiliere", label: "Agence immobilière" },
  { id: "banque", label: "Banque" },
  { id: "bar-restaurant", label: "Bar / restaurant" },
  { id: "boutique-armes", label: "Boutique d'armes" },
  { id: "boutique-equipement", label: "Boutique d'équipement" },
  { id: "boutique-specialisee", label: "Boutique spécialisée" },
  { id: "usine-production", label: "Usine de production" },
  { id: "technopole", label: "Technopôle" },
  { id: "atelier-personnalisation", label: "Atelier de personnalisation" },
] as const;

export type SectorId = (typeof SECTORS)[number]["id"];

const LABELS = new Map<string, string>(SECTORS.map((s) => [s.id, s.label]));

export function isSectorId(value: unknown): value is SectorId {
  return typeof value === "string" && LABELS.has(value);
}

export function sectorLabel(id: SectorId | null): string | null {
  return id ? (LABELS.get(id) ?? null) : null;
}
