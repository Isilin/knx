import { useState } from "react";
import { Link } from "react-router";
import type { CompanySeries } from "../domain/market.ts";
import { formatShare } from "../domain/numbers.ts";
import type { RegimeGroup } from "../domain/regimes.ts";
import { useFocus } from "../hooks/focus.tsx";
import { groupColor } from "./figures.tsx";
import "./RegimeList.css";

const SHOWN = 5;

/** The regimes as text: the table twin of the quadrant, heaviest companies first. */
export function RegimeList({
  groups,
  unplaced,
}: {
  groups: RegimeGroup[];
  unplaced: CompanySeries[];
}) {
  const { focused, setFocused } = useFocus();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="regimes">
      {groups.map((g) => {
        const expanded = open.has(g.id);
        const shown = expanded ? g.companies : g.companies.slice(0, SHOWN);
        const hidden = g.companies.length - shown.length;
        return (
          <section key={g.id} className="regimes__group" aria-labelledby={`regime-${g.id}`}>
            <h3 id={`regime-${g.id}`} className="regimes__head">
              <span className="label">{g.label}</span>
              <span className="regimes__count">{g.companies.length}</span>
            </h3>
            <p className="regimes__help">{g.help}</p>
            {g.companies.length > 0 ? (
              <ul className="regimes__list">
                {shown.map((c) => (
                  <li
                    key={c.slug}
                    className={focused === c.slug ? "is-focused" : undefined}
                    onMouseEnter={() => setFocused(c.slug)}
                    onMouseLeave={() => setFocused(null)}
                  >
                    <i style={{ background: groupColor(c.group) }} aria-hidden="true" />
                    <Link to={`/corporations/${c.slug}`}>{c.name}</Link>
                    <span className="estimated" title="Poids économique estimé par KNX">
                      {c.scores.weight === null ? "—" : formatShare(c.scores.weight)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {hidden > 0 || expanded ? (
              <button
                type="button"
                className="regimes__more"
                aria-expanded={expanded}
                onClick={() => toggle(g.id)}
              >
                {expanded ? "Réduire" : `et ${hidden} autre${hidden > 1 ? "s" : ""}`}
              </button>
            ) : null}
          </section>
        );
      })}
      {unplaced.length > 0 ? (
        <p className="regimes__unplaced">
          Hors régime, faute d'historique suffisant : {unplaced.map((c) => c.name).join(", ")}.
        </p>
      ) : null}
    </div>
  );
}
