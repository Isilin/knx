import { useState } from "react";
import { ImperialDate } from "../../components/figures.tsx";
import { useData } from "../../data/DataProvider.tsx";
import { formatImperialDate } from "../../domain/imperial.ts";
import { planWithdrawal } from "../../domain/mutations.ts";
import type { Dataset, IsoDate, SnapshotSource } from "../../domain/types.ts";
import { list } from "./format.ts";

const SOURCE_LABELS: Record<SnapshotSource, string> = {
  sheet: "tableur",
  form: "formulaire",
  paste: "rapport collé",
  userscript: "module du jeu",
};

/** How many reports the journal shows before « show all ». */
const PREVIEW = 15;

type Status = { tone: "ok" | "error"; text: string } | null;

/** What withdrawing the latest report undoes, spelled out before the operator confirms. */
function WithdrawConfirm({
  dataset,
  date,
  busy,
  onConfirm,
  onCancel,
}: {
  dataset: Dataset;
  date: IsoDate;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const plan = planWithdrawal(dataset, date);
  const names = new Map(dataset.companies.map((c) => [c.id, c.name]));
  const nameOf = (id: string) => names.get(id) ?? id;

  return (
    <div className="note note--warn journal__confirm" role="group" aria-label="Retrait du relevé">
      <p>
        <strong>
          Retirer le relevé du <ImperialDate date={date} /> ?
        </strong>{" "}
        Sa publication est défaite :
      </p>
      <ul>
        <li>
          {plan.rows} ligne{plan.rows > 1 ? "s" : ""} retirée{plan.rows > 1 ? "s" : ""} de la cote
        </li>
        {plan.created.length > 0 ? (
          <li>
            apparue{plan.created.length > 1 ? "s" : ""} ce jour-là, supprimée
            {plan.created.length > 1 ? "s" : ""} : {list(plan.created.map(nameOf))}
          </li>
        ) : null}
        {plan.reopened.length > 0 ? (
          <li>
            fermeture{plan.reopened.length > 1 ? "s" : ""} annulée
            {plan.reopened.length > 1 ? "s" : ""} : {list(plan.reopened.map(nameOf))}
          </li>
        ) : null}
        {plan.renamed.length > 0 ? (
          <li>
            renommage{plan.renamed.length > 1 ? "s" : ""} annulé
            {plan.renamed.length > 1 ? "s" : ""} :{" "}
            {list(plan.renamed.map((e) => `${e.details.to} redevient ${e.details.from}`))}
          </li>
        ) : null}
      </ul>
      <p>Le module du jeu pourra ensuite renvoyer le rapport de ce jour.</p>
      <div className="preview__actions">
        <button
          type="button"
          className="button button--quiet journal__danger"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? "Retrait…" : "Confirmer le retrait"}
        </button>
        <button type="button" className="linklike" disabled={busy} onClick={onCancel}>
          annuler
        </button>
      </div>
    </div>
  );
}

/**
 * Published reports, latest first. The latest can be withdrawn: nothing has followed it, so its
 * publication can be undone and the in-game module can send that day again.
 */
export function Journal({ dataset }: { dataset: Dataset }) {
  const { change } = useData();
  const [all, setAll] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const sorted = [...dataset.snapshots].sort((a, b) => b.date.localeCompare(a.date));
  const shown = all ? sorted : sorted.slice(0, PREVIEW);
  const latest = sorted[0]?.date ?? null;

  const withdraw = async (date: IsoDate) => {
    setBusy(true);
    setStatus(null);
    try {
      await change((s) => s.withdrawSnapshot(date));
      setConfirming(false);
      setStatus({
        tone: "ok",
        text: `Relevé du ${formatImperialDate(date)} retiré : le module du jeu peut renvoyer le rapport de ce jour.`,
      });
    } catch (error) {
      setStatus({
        tone: "error",
        text: `Retrait refusé : ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="journal" aria-labelledby="journal">
      <div className="section-head">
        <h2 id="journal">Journal des relevés</h2>
        <p>
          {sorted.length} relevé{sorted.length > 1 ? "s" : ""} publié
          {sorted.length > 1 ? "s" : ""}
        </p>
      </div>
      {status ? (
        <p
          className={`note note--${status.tone}`}
          role={status.tone === "error" ? "alert" : "status"}
        >
          {status.text}
        </p>
      ) : null}
      <ol>
        {shown.map((s) => (
          <li key={s.date}>
            <ImperialDate date={s.date} pti />
            <span>{s.rows.length} corporations</span>
            <span className="journal__source">{SOURCE_LABELS[s.source]}</span>
            {s.date === latest && !confirming ? (
              <button
                type="button"
                className="linklike journal__withdraw"
                onClick={() => {
                  setConfirming(true);
                  setStatus(null);
                }}
              >
                retirer
              </button>
            ) : null}
            {s.date === latest && confirming ? (
              <WithdrawConfirm
                dataset={dataset}
                date={s.date}
                busy={busy}
                onConfirm={() => withdraw(s.date)}
                onCancel={() => setConfirming(false)}
              />
            ) : null}
          </li>
        ))}
      </ol>
      {sorted.length > PREVIEW ? (
        <button type="button" className="linklike journal__more" onClick={() => setAll((v) => !v)}>
          {all ? "Afficher les plus récents" : `Afficher les ${sorted.length} relevés`}
        </button>
      ) : null}
    </section>
  );
}
