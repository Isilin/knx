import { CASH_KIND_LABELS, CASH_STATUS_LABELS, type CashMovement } from "../domain/investors.ts";
import { formatInteger } from "../domain/numbers.ts";
import { ImperialDate } from "./figures.tsx";
import "./MovementsTable.css";

/** Movements of an account, newest first; a pending withdrawal can be withdrawn by its owner. */
export function MovementsTable({
  account,
  movements,
  onCancel,
  cancelLabel = "annuler",
}: {
  /** Name of the account each line belongs to, shown in an extra column (operators). */
  account?: (movement: CashMovement) => string;
  movements: readonly CashMovement[];
  onCancel?: (movement: CashMovement) => void;
  cancelLabel?: string;
}) {
  if (movements.length === 0)
    return <p className="movements__muted">Aucun mouvement pour l'instant.</p>;
  return (
    <div className="movements">
      <table className="movements__table">
        <caption className="sr-only">Mouvements du compte</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            {account ? <th scope="col">Compte</th> : null}
            <th scope="col">Mouvement</th>
            <th scope="col" className="num">
              Montant
            </th>
            <th scope="col">État</th>
            <th scope="col" className="secondary">
              Note
            </th>
            {onCancel ? <th scope="col" aria-label="Action" /> : null}
          </tr>
        </thead>
        <tbody>
          {movements.map((m) => (
            <tr key={m.id} className={m.status === "cancelled" ? "is-cancelled" : undefined}>
              <td>
                <ImperialDate date={m.requestedAt.slice(0, 10)} />
              </td>
              {account ? <td>{account(m)}</td> : null}
              <td>{CASH_KIND_LABELS[m.kind]}</td>
              <td className="num">
                {m.kind === "deposit" ? "+" : "−"}
                {formatInteger(m.amount)} ¢
              </td>
              <td>
                <span className={`movements__status movements__status--${m.status}`}>
                  {CASH_STATUS_LABELS[m.status]}
                </span>
              </td>
              <td className="secondary movements__muted">{m.note ?? ""}</td>
              {onCancel ? (
                <td>
                  {m.kind === "withdrawal" && m.status === "requested" ? (
                    <button type="button" className="linklike" onClick={() => onCancel(m)}>
                      {cancelLabel}
                    </button>
                  ) : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
