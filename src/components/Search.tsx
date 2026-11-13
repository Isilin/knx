import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import type { CompanySeries } from "../domain/market.ts";
import { Seal } from "./Seal.tsx";
import "./Search.css";

const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function Search({ companies }: { companies: CompanySeries[] }) {
  const navigate = useNavigate();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const q = fold(query.trim());
    if (q === "") return [];
    return companies
      .filter((c) => fold(c.name).includes(q))
      .sort((a, b) => Number(!fold(a.name).startsWith(q)) - Number(!fold(b.name).startsWith(q)))
      .slice(0, 8);
  }, [companies, query]);

  const go = (company: CompanySeries) => {
    void navigate(`/corporations/${company.slug}`);
    setQuery("");
    setOpen(false);
    input.current?.blur();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter" && results[active]) {
      event.preventDefault();
      go(results[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const expanded = open && query.trim() !== "";
  return (
    <div className="search">
      <label htmlFor={`${id}-input`} className="sr-only">
        Chercher une corporation
      </label>
      <svg className="search__icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <circle cx="7" cy="7" r="5" />
        <path d="m11 11 3.5 3.5" />
      </svg>
      <input
        ref={input}
        id={`${id}-input`}
        type="search"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={`${id}-list`}
        aria-activedescendant={expanded && results[active] ? `${id}-${active}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        placeholder="Rechercher"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      {expanded ? (
        <ul id={`${id}-list`} role="listbox" className="search__list" aria-label="Corporations">
          {results.length === 0 ? (
            <li className="search__empty">Aucune corporation ne porte ce nom.</li>
          ) : (
            results.map((company, index) => (
              <li
                key={company.slug}
                id={`${id}-${index}`}
                role="option"
                aria-selected={index === active}
                className={index === active ? "is-active" : undefined}
                onMouseDown={(event) => {
                  event.preventDefault();
                  go(company);
                }}
                onMouseEnter={() => setActive(index)}
              >
                <Seal name={company.name} size={18} />
                <span>{company.name}</span>
                <small>
                  {company.status === "delisted" ? "radiée" : `rang ${company.latest.rank}`}
                </small>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
