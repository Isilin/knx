import { useId } from "react";
import type { Consortium, IsoDate } from "../domain/types.ts";
import { ImperialDate } from "./figures.tsx";
import { checkRows, newRow, type MembershipRow } from "./membershipRows.ts";

/**
 * The dated consortiums of a page: one period per membership, from the joining day to the
 * leaving day. The quick actions date a move on the latest report; every date stays editable.
 */
export function MembershipEditor({
  rows,
  onChange,
  consortiums,
  latestDate,
}: {
  rows: readonly MembershipRow[];
  onChange: (rows: MembershipRow[]) => void;
  consortiums: readonly Consortium[];
  /** Date of the latest report: the default date of a move. */
  latestDate: IsoDate;
}) {
  const id = useId();
  const open = rows.find((r) => r.leftOn === "");
  const { error } = checkRows(rows, consortiums);
  const update = (key: string, fields: Partial<MembershipRow>) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, ...fields } : r)));
  const closeOpen = (list: readonly MembershipRow[]) =>
    list.map((r) => (r === open ? { ...r, leftOn: latestDate } : r));

  return (
    <fieldset className="memberships" aria-describedby={`${id}-help`}>
      <legend className="label">Consortiums</legend>
      <p className="profile-editor__hint" id={`${id}-help`}>
        Une corporation n'appartient qu'à un consortium à la fois. « Depuis » vide : membre avant le
        premier relevé ; « jusqu'au » vide : toujours membre. Le jour du départ n'est plus couvert.
        Les actions rapides datent le mouvement au dernier relevé (
        <ImperialDate date={latestDate} />
        ).
      </p>

      {rows.length === 0 ? (
        <p className="memberships__empty">Indépendante sur tout l'historique.</p>
      ) : (
        <ol className="memberships__list">
          {rows.map((row, index) => (
            <li key={row.key} className="memberships__row">
              <label className="field">
                <span className="label">Période {index + 1}</span>
                <select
                  value={row.consortiumId}
                  onChange={(e) => update(row.key, { consortiumId: e.target.value })}
                >
                  <option value="">Choisir un consortium</option>
                  {consortiums.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Depuis</span>
                <input
                  type="date"
                  value={row.joinedOn}
                  onChange={(e) => update(row.key, { joinedOn: e.target.value })}
                />
                <small className="profile-editor__hint">
                  {row.joinedOn ? <ImperialDate date={row.joinedOn} /> : "avant le premier relevé"}
                </small>
              </label>
              <label className="field">
                <span className="label">Jusqu'au</span>
                <input
                  type="date"
                  value={row.leftOn}
                  min={row.joinedOn || undefined}
                  onChange={(e) => update(row.key, { leftOn: e.target.value })}
                />
                <small className="profile-editor__hint">
                  {row.leftOn ? <ImperialDate date={row.leftOn} /> : "toujours membre"}
                </small>
              </label>
              <button
                type="button"
                className="linklike memberships__remove"
                onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
              >
                retirer
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className="memberships__actions">
        {open ? (
          <>
            <button
              type="button"
              className="button button--quiet"
              onClick={() => onChange(closeOpen(rows))}
            >
              Quitter le consortium
            </button>
            <button
              type="button"
              className="button button--quiet"
              onClick={() => onChange([...closeOpen(rows), newRow({ joinedOn: latestDate })])}
            >
              Changer de consortium
            </button>
          </>
        ) : (
          <button
            type="button"
            className="button button--quiet"
            onClick={() => onChange([...rows, newRow({ joinedOn: latestDate })])}
          >
            Rejoindre un consortium
          </button>
        )}
        <button type="button" className="linklike" onClick={() => onChange([...rows, newRow()])}>
          Ajouter une période passée
        </button>
      </div>

      {error ? (
        <p className="note note--error" role="alert">
          {error.replace(/^./, (c) => c.toUpperCase())}.
        </p>
      ) : null}
    </fieldset>
  );
}
