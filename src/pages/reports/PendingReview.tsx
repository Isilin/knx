import { useState } from "react";
import { Amount, ImperialDate } from "../../components/figures.tsx";
import { useData } from "../../data/DataProvider.tsx";
import type { PendingSnapshot } from "../../data/source.ts";
import { formatImperialDate } from "../../domain/imperial.ts";
import { creationLookup, reviewReport, type IdentityChoices } from "../../domain/review.ts";
import type { Dataset } from "../../domain/types.ts";
import { parisClock, parisDay } from "./format.ts";
import { ReportChecks } from "./ReportChecks.tsx";

type Status = { tone: "ok" | "error"; text: string } | null;

function PendingCard({
  item,
  dataset,
  onSettled,
}: {
  item: PendingSnapshot;
  dataset: Dataset | null;
  /** Called once the report is published or rejected, with the confirmation to show. */
  onSettled: (text: string) => void;
}) {
  const { change, source, state } = useData();
  const market = state.status === "ready" ? state.market : null;
  const [busy, setBusy] = useState<"publish" | "reject" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [choices, setChoices] = useState<IdentityChoices>({});

  const review = reviewReport(
    dataset ?? { companies: [], snapshots: [], events: [] },
    creationLookup(market?.companies ?? []),
    item.date,
    item.rows,
    choices,
  );
  const day = formatImperialDate(item.date);

  const act = async (action: "publish" | "reject") => {
    setBusy(action);
    setStatus(null);
    try {
      // The card disappears with the next refresh; the section keeps the confirmation.
      if (action === "publish") {
        if (!dataset) throw new Error("données de la cote pas encore chargées.");
        await change((s) => s.publishPending(item.id, review.resolved));
        onSettled(`Relevé du ${day} publié : ${item.rows.length} corporations.`);
      } else {
        await source.rejectPending(item.id);
        onSettled(`Envoi du ${day} rejeté : rien n'a été publié.`);
      }
    } catch (error) {
      setStatus({
        tone: "error",
        text: `${action === "publish" ? "Publication refusée" : "Rejet refusé"} : ${error instanceof Error ? error.message : String(error)}`,
      });
      setBusy(null);
      setConfirming(false);
    }
  };

  return (
    <article className="pending__card" aria-labelledby={`pending-${item.id}`}>
      <header className="pending__head">
        <h3 id={`pending-${item.id}`}>
          Relevé du <ImperialDate date={item.date} />
        </h3>
        <p>
          {item.rows.length} corporations · reçu le{" "}
          <ImperialDate date={parisDay(item.receivedAt)} /> à {parisClock(item.receivedAt)}
          {item.key ? (
            <>
              {" "}
              · clé <strong>{item.key.name}</strong>
              {item.key.revoked ? <span className="pending__revoked"> (révoquée)</span> : null}
            </>
          ) : null}
        </p>
      </header>

      <p className="preview__summary">
        {review.previous
          ? `Comparé au relevé du ${formatImperialDate(review.previous.date)}`
          : "Premier relevé : rien à comparer"}
      </p>
      {review.diff ? (
        <ReportChecks
          review={review}
          choices={choices}
          onChoice={(key, value) => setChoices((current) => ({ ...current, [key]: value }))}
          showClean
        />
      ) : null}

      <details className="pending__rows">
        <summary>Voir les {item.rows.length} lignes reçues</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Class.</th>
              <th scope="col">Nom</th>
              <th scope="col">Chiffre</th>
              <th scope="col">Capital</th>
              <th scope="col">Employés</th>
            </tr>
          </thead>
          <tbody>
            {item.rows.map((r) => (
              <tr key={r.name}>
                <td>{r.rank ?? "—"}</td>
                <th scope="row">{r.name}</th>
                <td>
                  <Amount value={r.chiffre} unit={false} />
                </td>
                <td>
                  <Amount value={r.capital} unit={false} />
                </td>
                <td>{r.employees ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <div className="preview__actions">
        <button
          type="button"
          className="button"
          disabled={busy !== null}
          onClick={() => act("publish")}
        >
          {busy === "publish" ? "Publication…" : "Publier le relevé"}
        </button>
        {confirming ? (
          <>
            <button
              type="button"
              className="button button--quiet pending__danger"
              disabled={busy !== null}
              onClick={() => act("reject")}
            >
              {busy === "reject" ? "Rejet…" : "Confirmer le rejet"}
            </button>
            <button
              type="button"
              className="linklike"
              disabled={busy !== null}
              onClick={() => setConfirming(false)}
            >
              annuler
            </button>
          </>
        ) : (
          <button
            type="button"
            className="button button--quiet"
            disabled={busy !== null}
            onClick={() => setConfirming(true)}
          >
            Rejeter
          </button>
        )}
        {status ? (
          <p className={`note note--${status.tone}`} role="alert">
            {status.text}
          </p>
        ) : null}
      </div>
    </article>
  );
}

/** Reports sent by the in-game module: checked like a pasted report, published in one click. */
export function PendingReview({
  pending,
  error,
  dataset,
  onChanged,
}: {
  pending: PendingSnapshot[];
  error: string | null;
  dataset: Dataset | null;
  /** Refetch the pending list. */
  onChanged: () => void;
}) {
  const [notice, setNotice] = useState<string | null>(null);

  if (error) {
    return (
      <p className="note note--error" role="alert">
        Envois du jeu illisibles : {error}
      </p>
    );
  }
  if (pending.length === 0) {
    return notice ? <p className="note note--ok">{notice}</p> : null;
  }

  return (
    <section className="pending" aria-labelledby="pending">
      <div className="section-head">
        <h2 id="pending">Envois du jeu en attente</h2>
        <p>
          {pending.length} relevé{pending.length > 1 ? "s" : ""} envoyé
          {pending.length > 1 ? "s" : ""} par le module, à valider avant publication
        </p>
      </div>
      {notice ? <p className="note note--ok">{notice}</p> : null}
      {pending.map((item) => (
        <PendingCard
          key={`${item.id}-${item.receivedAt}`}
          item={item}
          dataset={dataset}
          onSettled={(text) => {
            setNotice(text);
            onChanged();
          }}
        />
      ))}
    </section>
  );
}
