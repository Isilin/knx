import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { formatShortDate } from "../domain/dates.ts";
import type { CompanySeries } from "../domain/market.ts";
import { formatPercent } from "../domain/numbers.ts";
import { useFocus } from "../hooks/focus.tsx";
import { useFollowed } from "../hooks/useFollowed.ts";
import { Amount, Change, Estimated, GroupTag, groupColor, RankChange } from "./figures.tsx";
import { FollowButton } from "./FollowButton.tsx";
import { Seal } from "./Seal.tsx";
import "./CoteTable.css";

type SortKey =
  | "rank"
  | "name"
  | "chiffre"
  | "change"
  | "real"
  | "capital"
  | "employees"
  | "creation"
  | "dynamics"
  | "activity"
  | "weight";

interface Column {
  key: SortKey;
  label: string;
  title?: string;
  numeric: boolean;
  secondary?: boolean;
  value: (c: CompanySeries) => number | string | null;
  render: (c: CompanySeries) => ReactNode;
}

const score = (v: number | null) =>
  v === null ? (
    <span className="amount--none">—</span>
  ) : (
    <span
      className={`score ${v > 0.15 ? "score--up" : v < -0.15 ? "score--down" : ""}`}
      title="Indicateur estimé par KNX"
    >
      {formatPercent(v).replace("%", "").trim()}
    </span>
  );

const COLUMNS: Record<SortKey, Column> = {
  rank: {
    key: "rank",
    label: "Rang",
    numeric: false,
    value: (c) => (c.status === "delisted" ? 999 : c.latest.rank),
    render: () => null,
  },
  name: {
    key: "name",
    label: "Corporation",
    numeric: false,
    value: (c) => c.name,
    render: () => null,
  },
  chiffre: {
    key: "chiffre",
    label: "CA publié",
    title: "Chiffre d'affaires quotidien moyen depuis la création, tel que publié par le jeu",
    numeric: true,
    value: (c) => c.latest.chiffre,
    render: (c) => <Amount value={c.latest.chiffre} unit={false} />,
  },
  change: {
    key: "change",
    label: "Var.",
    title: "Variation du CA publié depuis le relevé précédent",
    numeric: true,
    value: (c) => c.chiffreChange,
    render: (c) => <Change ratio={c.status === "delisted" ? null : c.chiffreChange} />,
  },
  real: {
    key: "real",
    label: "CA réel est.",
    title: "Recette moyenne par jour depuis le relevé précédent, estimée par KNX",
    numeric: true,
    secondary: true,
    value: (c) => c.latest.realDaily,
    render: (c) => (
      <Estimated
        value={c.status === "delisted" ? null : c.latest.realDaily}
        noise={c.latest.realDailyNoise}
        unit={false}
      />
    ),
  },
  capital: {
    key: "capital",
    label: "Capital",
    numeric: true,
    secondary: true,
    value: (c) => c.latest.capital,
    render: (c) => <Amount value={c.latest.capital} unit={false} />,
  },
  employees: {
    key: "employees",
    label: "Empl.",
    title: "Employés",
    numeric: true,
    secondary: true,
    value: (c) => c.latest.employees,
    render: (c) =>
      c.latest.employees === null ? <span className="amount--none">—</span> : c.latest.employees,
  },
  creation: {
    key: "creation",
    label: "Création est.",
    title: "Date de création estimée par KNX",
    numeric: true,
    secondary: true,
    value: (c) => c.creation?.creation ?? null,
    render: (c) =>
      !c.creation || c.creation.method === "first-seen" ? (
        <span className="amount--none">—</span>
      ) : c.creation.method === "manual" ? (
        <span title="Date saisie">{c.creation.creation.slice(0, 4)}</span>
      ) : (
        <span
          className="estimated"
          title={`Estimation KNX : ${formatShortDate(c.creation.creation)}/${c.creation.creation.slice(0, 4)}`}
        >
          {c.creation.creation.slice(0, 4)}
        </span>
      ),
  },
  dynamics: {
    key: "dynamics",
    label: "Dyn.",
    title: "Dynamique : recettes des 30 derniers jours face aux 90 jours précédents (−100 à +100)",
    numeric: true,
    secondary: true,
    value: (c) => c.scores.dynamics,
    render: (c) => score(c.scores.dynamics),
  },
  activity: {
    key: "activity",
    label: "Act.",
    title: "Activité : recettes des 30 derniers jours face à la moyenne historique (−100 à +100)",
    numeric: true,
    secondary: true,
    value: (c) => c.scores.activity,
    render: (c) => score(c.scores.activity),
  },
  weight: {
    key: "weight",
    label: "Poids",
    title: "Part des recettes du marché sur 30 jours",
    numeric: true,
    secondary: true,
    value: (c) => c.scores.weight,
    render: (c) =>
      c.scores.weight === null ? (
        <span className="amount--none">—</span>
      ) : (
        <span className="estimated">{formatPercent(c.scores.weight).replace("+", "")}</span>
      ),
  },
};

const VARIANTS = {
  compact: ["rank", "name", "chiffre", "change", "real", "capital", "employees"],
  full: [
    "rank",
    "name",
    "chiffre",
    "change",
    "real",
    "capital",
    "employees",
    "creation",
    "dynamics",
    "activity",
    "weight",
  ],
} as const satisfies Record<string, readonly SortKey[]>;

type StatusFilter = "listed" | "active" | "idle" | "delisted" | "followed";

interface CoteTableProps {
  companies: CompanySeries[];
  variant: keyof typeof VARIANTS;
  caption: string;
}

export function CoteTable({ companies, variant, caption }: CoteTableProps) {
  const navigate = useNavigate();
  const { focused, setFocused } = useFocus();
  const { followed } = useFollowed();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "rank", dir: 1 });
  const [status, setStatus] = useState<StatusFilter>("listed");
  const [group, setGroup] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of companies)
      if (c.group && c.status !== "delisted") counts.set(c.group, (counts.get(c.group) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [companies]);

  const counts = useMemo(
    () => ({
      listed: companies.filter((c) => c.status !== "delisted").length,
      active: companies.filter((c) => c.status === "active").length,
      idle: companies.filter((c) => c.status === "idle").length,
      delisted: companies.filter((c) => c.status === "delisted").length,
      followed: companies.filter((c) => followed.includes(c.slug)).length,
    }),
    [companies, followed],
  );

  const rows = useMemo(() => {
    const q = query.trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const column = COLUMNS[sort.key];
    return companies
      .filter((c) => {
        if (status === "listed" && c.status === "delisted") return false;
        if (status === "active" && c.status !== "active") return false;
        if (status === "idle" && c.status !== "idle") return false;
        if (status === "delisted" && c.status !== "delisted") return false;
        if (status === "followed" && !followed.includes(c.slug)) return false;
        if (group && c.group !== group) return false;
        if (q && !c.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(q))
          return false;
        return true;
      })
      .sort((a, b) => {
        const va = column.value(a);
        const vb = column.value(b);
        if (va === null && vb === null) return a.latest.rank - b.latest.rank;
        if (va === null) return 1;
        if (vb === null) return -1;
        const cmp = typeof va === "string" ? va.localeCompare(String(vb), "fr") : va - Number(vb);
        return cmp * sort.dir || a.latest.rank - b.latest.rank;
      });
  }, [companies, sort, status, group, query, followed]);

  const columns = VARIANTS[variant].map((key) => COLUMNS[key]);

  const toggleSort = (key: SortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 1 ? -1 : 1 }
        : { key, dir: COLUMNS[key].numeric ? -1 : 1 },
    );
  };

  const statusChips: { id: StatusFilter; label: string; count: number }[] = [
    { id: "listed", label: "Cotées", count: counts.listed },
    { id: "active", label: "Actives", count: counts.active },
    { id: "idle", label: "À l'arrêt", count: counts.idle },
    ...(variant === "full"
      ? [{ id: "delisted" as const, label: "Radiées", count: counts.delisted }]
      : []),
    { id: "followed", label: "Suivies", count: counts.followed },
  ];

  return (
    <div className="cote">
      <div className="cote__filters">
        <div className="chips" role="group" aria-label="Statut">
          {statusChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className="chip"
              aria-pressed={status === chip.id}
              onClick={() => setStatus(chip.id)}
            >
              {chip.label} <small>{chip.count}</small>
            </button>
          ))}
        </div>
        {groups.length > 0 ? (
          <div className="chips" role="group" aria-label="Groupe">
            {groups.map(([name, count]) => (
              <button
                key={name}
                type="button"
                className="chip"
                aria-pressed={group === name}
                onClick={() => setGroup(group === name ? null : name)}
              >
                <i style={{ background: groupColor(name) }} aria-hidden="true" />
                {name} <small>{count}</small>
              </button>
            ))}
          </div>
        ) : null}
        <label className="cote__query">
          <span className="sr-only">Filtrer par nom</span>
          <input
            className="input"
            type="search"
            placeholder="Filtrer par nom"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      <div className="cote__scroll">
        <table className={`cote__table cote__table--${variant}`}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`${col.numeric ? "num" : ""} ${col.secondary ? "secondary" : ""} col-${col.key}`}
                  aria-sort={
                    sort.key === col.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined
                  }
                >
                  <button type="button" onClick={() => toggleSort(col.key)} title={col.title}>
                    {col.label}
                    <svg
                      viewBox="0 0 8 10"
                      width="7"
                      height="9"
                      aria-hidden="true"
                      className={sort.key === col.key ? "is-on" : undefined}
                    >
                      <path
                        d={
                          sort.key === col.key && sort.dir === -1
                            ? "M4 9 .5 4h7z"
                            : "M4 1 7.5 6h-7z"
                        }
                      />
                    </svg>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="cote__empty">
                  {status === "followed" && counts.followed === 0
                    ? "Vous ne suivez aucune corporation. Suivez-en depuis leur fiche ou l'étoile de la cote."
                    : "Aucune corporation ne correspond à ces filtres."}
                </td>
              </tr>
            ) : (
              rows.map((c) => {
                const isFollowed = followed.includes(c.slug);
                return (
                  <tr
                    key={c.slug}
                    className={`${focused === c.slug ? "is-focused" : ""} ${isFollowed ? "is-followed" : ""} is-${c.status}`}
                    onMouseEnter={() => setFocused(c.slug)}
                    onMouseLeave={() => setFocused(null)}
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest("a, button")) return;
                      void navigate(`/corporations/${c.slug}`);
                    }}
                  >
                    {columns.map((col) => {
                      if (col.key === "rank") {
                        return (
                          <td key="rank" className="col-rank">
                            {c.status === "delisted" ? (
                              <span className="cote__rank cote__rank--off">—</span>
                            ) : (
                              <>
                                <span className="cote__rank">{c.latest.rank}</span>
                                <RankChange value={c.rankChange} />
                              </>
                            )}
                          </td>
                        );
                      }
                      if (col.key === "name") {
                        return (
                          <th key="name" scope="row" className="col-name">
                            <span className="cote__name">
                              <Seal name={c.name} size={26} />
                              <span className="cote__name-text">
                                <Link to={`/corporations/${c.slug}`}>{c.name}</Link>
                                <span className="cote__sub">
                                  <GroupTag group={c.group} />
                                  {c.status === "idle" ? (
                                    <span className="tag">à l'arrêt</span>
                                  ) : null}
                                  {c.status === "delisted" ? (
                                    <span className="tag">radiée</span>
                                  ) : null}
                                </span>
                              </span>
                              <FollowButton slug={c.slug} name={c.name} compact />
                            </span>
                          </th>
                        );
                      }
                      return (
                        <td
                          key={col.key}
                          className={`num ${col.secondary ? "secondary" : ""} col-${col.key}`}
                        >
                          {col.render(c)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="cote__count">
        {rows.length} corporation{rows.length > 1 ? "s" : ""} · montants en crédits impériaux (¢)
      </p>
    </div>
  );
}
