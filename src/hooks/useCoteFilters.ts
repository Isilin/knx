import { useCallback, useState } from "react";
import { useSearchParams } from "react-router";
import { RATING_METHOD, type RatingCategory } from "../domain/rating.ts";
import { isSectorId, type SectorId } from "../domain/sectors.ts";

export type StatusFilter = "listed" | "active" | "idle" | "delisted" | "followed";

/** What the cote is narrowed to. */
export interface CoteFilters {
  status: StatusFilter;
  /** Consortium, by the slug of its name (`armacham`). */
  group: string | null;
  sector: SectorId | null;
  grade: RatingCategory | "unrated" | null;
  query: string;
}

const DEFAULTS: CoteFilters = {
  status: "listed",
  group: null,
  sector: null,
  grade: null,
  query: "",
};

/** Status words of the address, in the cote's language; « cotées » is the default, left out. */
const STATUS_WORDS: Record<Exclude<StatusFilter, "listed">, string> = {
  active: "actives",
  idle: "arret",
  delisted: "fermees",
  followed: "suivies",
};

const CATEGORIES = new Set<string>(RATING_METHOD.categories.map(([category]) => category));

/** Reads the filters of an address: `?secteur=banque&groupe=armacham&statut=actives`. */
export function parseCoteFilters(params: URLSearchParams): CoteFilters {
  const statusWord = params.get("statut");
  const status =
    (Object.entries(STATUS_WORDS) as [StatusFilter, string][]).find(
      ([, word]) => word === statusWord,
    )?.[0] ?? "listed";
  const sector = params.get("secteur");
  const grade = params.get("note");
  return {
    status,
    group: params.get("groupe") || null,
    sector: isSectorId(sector) ? sector : null,
    grade:
      grade === "non-notees"
        ? "unrated"
        : grade && CATEGORIES.has(grade)
          ? (grade as RatingCategory)
          : null,
    query: params.get("q") ?? "",
  };
}

/** Writes filters as an address query, leaving the defaults out. */
export function coteSearch(filters: CoteFilters): string {
  const params = new URLSearchParams();
  if (filters.sector) params.set("secteur", filters.sector);
  if (filters.group) params.set("groupe", filters.group);
  if (filters.status !== "listed") params.set("statut", STATUS_WORDS[filters.status]);
  if (filters.grade) params.set("note", filters.grade === "unrated" ? "non-notees" : filters.grade);
  if (filters.query.trim()) params.set("q", filters.query);
  return params.toString();
}

/**
 * Filters of the cote. With `inAddress`, they live in the page's address, so a filtered cote can
 * be shared and a sector link elsewhere opens it filtered; otherwise they stay in the component
 * (the short cote of the market page).
 */
export function useCoteFilters(
  inAddress: boolean,
): [CoteFilters, (patch: Partial<CoteFilters>) => void] {
  const [params, setParams] = useSearchParams();
  const [local, setLocal] = useState<CoteFilters>(DEFAULTS);
  const filters = inAddress ? parseCoteFilters(params) : local;
  const update = useCallback(
    (patch: Partial<CoteFilters>) => {
      if (!inAddress) {
        setLocal((current) => ({ ...current, ...patch }));
        return;
      }
      setParams((current) => coteSearch({ ...parseCoteFilters(current), ...patch }), {
        replace: true,
      });
    },
    [inAddress, setParams],
  );
  return [filters, update];
}
