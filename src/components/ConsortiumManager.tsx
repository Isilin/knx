import { useEffect, useRef, useState, type FormEvent } from "react";
import { useData } from "../data/DataProvider.tsx";
import type { Market } from "../domain/market.ts";
import { CONSORTIUM_COLORS, type Consortium, type ConsortiumColor } from "../domain/types.ts";
import { groupColor } from "./figures.tsx";
import "./ConsortiumManager.css";

const COLOR_LABELS: Record<ConsortiumColor, string> = {
  cyan: "Cyan",
  magenta: "Magenta",
  ambre: "Ambre",
  bleu: "Bleu",
};

function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: ConsortiumColor;
  onChange: (color: ConsortiumColor) => void;
  label: string;
}) {
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      {CONSORTIUM_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          className="swatches__item"
          title={COLOR_LABELS[color]}
          onClick={() => onChange(color)}
        >
          <i style={{ background: `var(--g-${color})` }} aria-hidden="true" />
          <span className="sr-only">{COLOR_LABELS[color]}</span>
        </button>
      ))}
    </div>
  );
}

function Row({ consortium, members }: { consortium: Consortium; members: number }) {
  const { change } = useData();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(consortium.name);
  const [color, setColor] = useState(consortium.color);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (write: Parameters<typeof change>[0]) => {
    setError(null);
    try {
      await change(write);
      setEditing(false);
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (editing) {
    return (
      <li className="consortium consortium--editing">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run((s) => s.saveConsortium({ id: consortium.id, name, color }));
          }}
        >
          <input
            className="input"
            aria-label="Nom du consortium"
            value={name}
            required
            onChange={(e) => setName(e.target.value)}
          />
          <ColorPicker value={color} onChange={setColor} label="Couleur" />
          <span className="consortium__buttons">
            <button type="submit" className="button">
              Enregistrer
            </button>
            <button type="button" className="linklike" onClick={() => setEditing(false)}>
              annuler
            </button>
          </span>
          {error ? <p className="note note--error">{error}</p> : null}
        </form>
      </li>
    );
  }

  return (
    <li className="consortium">
      <i style={{ background: groupColor(consortium) }} aria-hidden="true" />
      <span className="consortium__name">{consortium.name}</span>
      <span className="consortium__count">
        {members} cotée{members > 1 ? "s" : ""}
      </span>
      <span className="consortium__buttons">
        <button type="button" className="linklike" onClick={() => setEditing(true)}>
          modifier
        </button>
        {confirming ? (
          <button
            type="button"
            className="linklike consortium__danger"
            onClick={() => void run((s) => s.deleteConsortium(consortium.id))}
          >
            confirmer la suppression
          </button>
        ) : (
          <button type="button" className="linklike" onClick={() => setConfirming(true)}>
            supprimer
          </button>
        )}
      </span>
      {confirming ? (
        <small className="consortium__warning">
          Ses membres deviendront indépendants.{" "}
          <button type="button" className="linklike" onClick={() => setConfirming(false)}>
            garder
          </button>
        </small>
      ) : null}
      {error ? <p className="note note--error">{error}</p> : null}
    </li>
  );
}

/** The managed list of consortiums: add, rename, recolour, remove. */
export function ConsortiumManager({ market }: { market: Market }) {
  const { change } = useData();
  const [name, setName] = useState("");
  const [color, setColor] = useState<ConsortiumColor>("bleu");
  const [error, setError] = useState<string | null>(null);
  const section = useRef<HTMLElement>(null);

  // Reached from a company page through « Gérer la liste des consortiums ».
  useEffect(() => {
    if (window.location.hash === "#consortiums") section.current?.scrollIntoView();
  }, []);

  const members = (id: string) =>
    market.companies.filter((c) => c.consortium?.id === id && c.status !== "delisted").length;

  const add = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await change((s) => s.saveConsortium({ id: null, name, color }));
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section
      ref={section}
      className="consortiums"
      id="consortiums"
      aria-labelledby="consortiums-title"
    >
      <div className="section-head">
        <h2 id="consortiums-title">Consortiums</h2>
        <p>
          {market.consortiums.length} consortium{market.consortiums.length > 1 ? "s" : ""} ·
          rattachement depuis chaque fiche
        </p>
      </div>
      <ul>
        {market.consortiums.map((k) => (
          <Row key={`${k.id}-${k.name}-${k.color}`} consortium={k} members={members(k.id)} />
        ))}
      </ul>
      <form className="consortiums__add" onSubmit={add}>
        <label className="field">
          <span className="label">Nouveau consortium</span>
          <input
            className="input"
            value={name}
            required
            placeholder="Nom"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <ColorPicker value={color} onChange={setColor} label="Couleur du nouveau consortium" />
        <button type="submit" className="button button--quiet">
          Ajouter
        </button>
        {error ? <p className="note note--error">{error}</p> : null}
      </form>
    </section>
  );
}
