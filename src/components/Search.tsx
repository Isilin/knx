import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import { imperialYear } from "../domain/imperial.ts";
import type { CompanySeries } from "../domain/market.ts";
import { Seal } from "./Seal.tsx";
import "./Search.css";

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

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
    // Former names count too: an old name still leads to the corporation.
    const score = (c: CompanySeries) => {
      if (fold(c.name).startsWith(q)) return 0;
      if (fold(c.name).includes(q)) return 1;
      return c.formerNames.some((n) => fold(n).includes(q)) ? 2 : -1;
    };
    return companies
      .map((c) => ({ c, s: score(c) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => a.s - b.s)
      .slice(0, 8)
      .map((x) => x.c);
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
                <Seal seed={company.sealSeed} size={18} />
                <span>
                  {company.name}
                  {company.formerNames.length > 0 &&
                  !fold(company.name).includes(fold(query.trim())) ? (
                    <small> ex-{company.formerNames.at(-1)}</small>
                  ) : null}
                </span>
                <small>
                  {company.status === "delisted"
                    ? `fermée${company.namesakes.length > 0 ? ` · an ${imperialYear(company.firstSeen)}` : ""}`
                    : `rang ${company.latest.rank}`}
                </small>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
