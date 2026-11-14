import { useState, type FormEvent } from "react";
import { useData } from "../data/DataProvider.tsx";
import type { Market } from "../domain/market.ts";
import type { CompanyMeta, Dataset } from "../domain/types.ts";
import "./HiddenCompanies.css";

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "fr");

/** The life that names a page: its open one, else the last closed. */
function latestLife(lives: readonly CompanyMeta[]): CompanyMeta {
  return lives.reduce((a, b) =>
    a.closedOn === null ? a : b.closedOn === null || b.closedOn > a.closedOn ? b : a,
  );
}

/**
 * Corporations kept out of every display (MJ Immo, run by the game masters): show one again, or
 * hide a listed one. The flag belongs to the page, so it covers every life. Hidden corporations
 * are absent from the market, so they come from the registry.
 */
export function HiddenCompanies({
  registry,
  market,
}: {
  registry: Pick<Dataset, "profiles" | "companies">;
  market: Market;
}) {
  const { change } = useData();
  const [choice, setChoice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const hidden = registry.profiles
    .filter((p) => p.hidden)
    .flatMap((p) => {
      const lives = registry.companies.filter((c) => c.profileId === p.id);
      return lives.length === 0 ? [] : [{ ...latestLife(lives), profileId: p.id }];
    })
    .sort(byName);
  const listed = market.companies.filter((c) => c.status !== "delisted").sort(byName);

  const run = async (write: Parameters<typeof change>[0]) => {
    setError(null);
    try {
      await change(write);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  };

  const hide = async (event: FormEvent) => {
    event.preventDefault();
    if (choice && (await run((s) => s.updateProfile(choice, { hidden: true })))) setChoice("");
  };

  return (
    <section className="hidden-companies" aria-labelledby="hidden-companies-title">
      <div className="section-head">
        <h2 id="hidden-companies-title">Corporations masquées</h2>
        <p>Hors de la cote et des graphiques ; toujours lues dans les relevés</p>
      </div>
      {hidden.length === 0 ? (
        <p className="hidden-companies__empty">Aucune corporation masquée.</p>
      ) : (
        <ul>
          {hidden.map((c) => (
            <li key={c.profileId} className="hidden-company">
              <span className="hidden-company__name">
                {c.name}
                {c.closedOn ? <small> · fermée</small> : null}
              </span>
              <button
                type="button"
                className="linklike"
                onClick={() => void run((s) => s.updateProfile(c.profileId, { hidden: false }))}
              >
                réafficher
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="hidden-companies__add" onSubmit={hide}>
        <label className="field">
          <span className="label">Masquer une corporation</span>
          <select value={choice} required onChange={(e) => setChoice(e.target.value)}>
            <option value="">Choisir…</option>
            {listed.map((c) => (
              <option key={c.profileId} value={c.profileId}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <small className="hidden-companies__hint">
          Pour une corporation qui n'est pas une entreprise de joueurs, comme celles des MJ. Elle
          sort des décomptes et des parts de marché ; les rangs restent ceux du jeu.
        </small>
        <button type="submit" className="button button--quiet" disabled={!choice}>
          Masquer
        </button>
      </form>
      {error ? <p className="note note--error">{error}</p> : null}
    </section>
  );
}
