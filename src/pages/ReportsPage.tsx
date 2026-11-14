import { useMemo, useState, type FormEvent } from "react";
import { ConsortiumManager } from "../components/ConsortiumManager.tsx";
import { ImperialDate } from "../components/figures.tsx";
import { useData } from "../data/DataProvider.tsx";
import { isIsoDate } from "../domain/dates.ts";
import { formatImperialDate } from "../domain/imperial.ts";
import { assignRanks } from "../domain/diff.ts";
import { parseAmount } from "../domain/numbers.ts";
import { parseReport } from "../domain/report.ts";
import {
  creationLookup,
  previousSnapshot,
  reviewReport,
  type IdentityChoices,
} from "../domain/review.ts";
import type { Dataset, ReportRow, SnapshotSource } from "../domain/types.ts";
import { ApiKeysPanel } from "./reports/ApiKeysPanel.tsx";
import { PendingReview } from "./reports/PendingReview.tsx";
import { ReportChecks } from "./reports/ReportChecks.tsx";
import { usePending } from "./reports/usePending.ts";
import "./ReportsPage.css";

function todayLocal(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

interface FormRow {
  key: string;
  name: string;
  chiffre: string;
  capital: string;
  employees: string;
}

function SignIn() {
  const { source } = useData();
  const [method, setMethod] = useState<"password" | "link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setState("sending");
    try {
      if (method === "password") {
        await source.signInWithPassword(email.trim(), password);
        // The session listener swaps this form for the editor.
        setState("idle");
      } else {
        await source.requestSignIn(email.trim());
        setState("sent");
      }
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const choose = (next: "password" | "link") => {
    setMethod(next);
    setState("idle");
  };

  return (
    <form className="signin" onSubmit={submit}>
      <h2>Accès opérateur</h2>
      <p>La saisie des relevés est réservée aux opérateurs de KNX.</p>
      <div className="segmented" role="group" aria-label="Mode de connexion">
        <button
          type="button"
          aria-pressed={method === "password"}
          onClick={() => choose("password")}
        >
          Mot de passe
        </button>
        <button type="button" aria-pressed={method === "link"} onClick={() => choose("link")}>
          Lien par e-mail
        </button>
      </div>
      <label className="field">
        <span className="label">Adresse e-mail</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      {method === "password" ? (
        <label className="field">
          <span className="label">Mot de passe</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      ) : (
        <p className="signin__hint">
          Un lien de connexion vous est envoyé. Supabase limite ces envois à 2 par heure pour tout
          le projet.
        </p>
      )}
      <button className="button" type="submit" disabled={state === "sending"}>
        {state === "sending"
          ? method === "password"
            ? "Connexion…"
            : "Envoi…"
          : method === "password"
            ? "Se connecter"
            : "Recevoir le lien"}
      </button>
      {state === "sent" ? (
        <p className="note note--ok">
          Lien envoyé. Ouvrez-le depuis ce navigateur pour revenir ici connecté.
        </p>
      ) : null}
      {state === "error" ? (
        <p className="note note--error" role="alert">
          {method === "password" ? "Connexion impossible" : "Envoi impossible"} : {message}
        </p>
      ) : null}
    </form>
  );
}

function Journal({ dataset }: { dataset: Dataset }) {
  const recent = [...dataset.snapshots].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
  const labels: Record<SnapshotSource, string> = {
    sheet: "tableur",
    form: "formulaire",
    paste: "rapport collé",
    userscript: "module du jeu",
  };
  return (
    <section className="journal" aria-labelledby="journal">
      <div className="section-head">
        <h2 id="journal">Journal des relevés</h2>
        <p>{dataset.snapshots.length} relevés publiés</p>
      </div>
      <ol>
        {recent.map((s) => (
          <li key={s.date}>
            <ImperialDate date={s.date} pti />
            <span>{s.rows.length} corporations</span>
            <span className="journal__source">{labels[s.source]}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

interface PublishStatus {
  tone: "ok" | "error";
  text: string;
}

function Editor({
  dataset,
  pendingDates,
  status,
  setStatus,
}: {
  dataset: Dataset | null;
  /** Dates holding a report sent by the in-game module, not yet reviewed. */
  pendingDates: ReadonlySet<string>;
  /** Kept by the page: a successful publication reloads the data and remounts the editor. */
  status: PublishStatus | null;
  setStatus: (status: PublishStatus | null) => void;
}) {
  const { publish, source, state } = useData();
  const market = state.status === "ready" ? state.market : null;
  const [date, setDate] = useState(todayLocal);
  const [mode, setMode] = useState<"paste" | "form">("paste");
  const [text, setText] = useState("");
  const [replace, setReplace] = useState(false);
  const [choices, setChoices] = useState<IdentityChoices>({});
  const [busy, setBusy] = useState(false);

  const previous = useMemo(
    () => (dataset ? previousSnapshot(dataset.snapshots, date) : null),
    [dataset, date],
  );
  const nameOf = useMemo(() => {
    const names = new Map(dataset?.companies.map((c) => [c.id, c.name]) ?? []);
    return (id: string) => names.get(id) ?? id;
  }, [dataset]);

  const [formRows, setFormRows] = useState<FormRow[]>(() =>
    (previous?.rows ?? []).map((r, i) => ({
      key: `${i}-${r.companyId}`,
      name: nameOf(r.companyId),
      chiffre: String(r.chiffre),
      capital: r.capital === null ? "" : String(r.capital),
      employees: r.employees === null ? "" : String(r.employees),
    })),
  );

  const published = dataset?.snapshots.some((s) => s.date === date) ?? false;
  const pendingHere = !published && pendingDates.has(date);
  const exists = published || pendingHere;

  const parsed = useMemo((): { rows: ReportRow[]; errors: string[] } => {
    if (mode === "paste") {
      const result = parseReport(text);
      return {
        rows: result.rows,
        errors: result.errors.map((e) => `Ligne ${e.line} : ${e.reason}`),
      };
    }
    const errors: string[] = [];
    const rows: ReportRow[] = [];
    const seen = new Set<string>();
    formRows.forEach((r, i) => {
      const name = r.name.trim();
      if (!name && !r.chiffre.trim()) return;
      const chiffre = parseAmount(r.chiffre);
      const capital = r.capital.trim() === "" ? null : parseAmount(r.capital);
      const employees = r.employees.trim() === "" ? null : parseAmount(r.employees);
      if (!name) errors.push(`Ligne ${i + 1} : nom manquant.`);
      else if (seen.has(name)) errors.push(`Ligne ${i + 1} : « ${name} » apparaît deux fois.`);
      else if (chiffre === null || chiffre < 0)
        errors.push(`Ligne ${i + 1} : chiffre illisible pour « ${name} ».`);
      else if (r.capital.trim() !== "" && capital === null)
        errors.push(`Ligne ${i + 1} : capital illisible pour « ${name} ».`);
      else if (r.employees.trim() !== "" && (employees === null || employees < 0))
        errors.push(`Ligne ${i + 1} : effectif illisible pour « ${name} ».`);
      else {
        seen.add(name);
        rows.push({ name, rank: null, chiffre, capital, employees });
      }
    });
    return { rows: assignRanks(rows), errors };
  }, [mode, text, formRows]);

  const review = useMemo(
    () =>
      reviewReport(
        dataset ?? { companies: [], snapshots: [], events: [] },
        creationLookup(market?.companies ?? []),
        date,
        parsed.rows,
        choices,
      ),
    [dataset, market, date, parsed.rows, choices],
  );
  const canPublish =
    dataset !== null &&
    parsed.rows.length > 0 &&
    parsed.errors.length === 0 &&
    (!exists || replace) &&
    !busy;

  const submit = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await publish({
        date,
        source: mode === "paste" ? "paste" : "form",
        rows: review.resolved.rows,
        closures: review.resolved.closures,
        replace: exists && replace,
      });
      setStatus({
        tone: "ok",
        text: `Relevé du ${formatImperialDate(date)} publié : ${parsed.rows.length} corporations.`,
      });
      setText("");
      setReplace(false);
      setChoices({});
    } catch (error) {
      setStatus({
        tone: "error",
        text: `Publication refusée : ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setBusy(false);
    }
  };

  const updateRow = (key: string, field: keyof Omit<FormRow, "key">, value: string) =>
    setFormRows((rows) => rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  return (
    <section className="editor" aria-labelledby="nouveau">
      <div className="section-head">
        <h2 id="nouveau">Nouveau relevé</h2>
        {source.kind === "local" ? <p>Mode local : le relevé reste dans ce navigateur.</p> : null}
      </div>

      <div className="editor__bar">
        <label className="field editor__date">
          <span className="label">
            Date du relevé
            {isIsoDate(date) ? (
              <span className="editor__ig">
                {" · "}
                <ImperialDate date={date} />
              </span>
            ) : null}
          </span>
          <input
            type="date"
            value={date}
            max={todayLocal()}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
        <div className="segmented" role="group" aria-label="Mode de saisie">
          <button type="button" aria-pressed={mode === "paste"} onClick={() => setMode("paste")}>
            Coller le rapport
          </button>
          <button type="button" aria-pressed={mode === "form"} onClick={() => setMode("form")}>
            Formulaire
          </button>
        </div>
      </div>

      {mode === "paste" ? (
        <label className="field">
          <span className="label">Rapport « Corporations » copié depuis le jeu</span>
          <textarea
            rows={12}
            value={text}
            spellCheck={false}
            placeholder={
              "Corporations\nClass.\tNom\tChiffre\tCapital\tEmployés\n1\tArmacham Technology\t677.085\t27.120.847\t4\n…"
            }
            onChange={(e) => setText(e.target.value)}
          />
        </label>
      ) : (
        <div className="form-grid">
          <div className="form-grid__head" aria-hidden="true">
            <span>Corporation</span>
            <span>Chiffre</span>
            <span>Capital</span>
            <span>Employés</span>
            <span />
          </div>
          {formRows.map((r) => (
            <div className="form-grid__row" key={r.key}>
              <input
                className="input"
                aria-label="Corporation"
                value={r.name}
                onChange={(e) => updateRow(r.key, "name", e.target.value)}
              />
              <input
                className="input num"
                aria-label={`Chiffre de ${r.name}`}
                inputMode="numeric"
                value={r.chiffre}
                onChange={(e) => updateRow(r.key, "chiffre", e.target.value)}
              />
              <input
                className="input num"
                aria-label={`Capital de ${r.name}`}
                inputMode="numeric"
                value={r.capital}
                onChange={(e) => updateRow(r.key, "capital", e.target.value)}
              />
              <input
                className="input num"
                aria-label={`Employés de ${r.name}`}
                inputMode="numeric"
                value={r.employees}
                onChange={(e) => updateRow(r.key, "employees", e.target.value)}
              />
              <button
                type="button"
                className="form-grid__remove"
                aria-label={`Retirer ${r.name || "cette ligne"}`}
                onClick={() => setFormRows((rows) => rows.filter((x) => x.key !== r.key))}
              >
                <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                  <path d="m3 3 6 6M9 3 3 9" />
                </svg>
              </button>
            </div>
          ))}
          <button
            type="button"
            className="button button--quiet"
            onClick={() =>
              setFormRows((rows) => [
                ...rows,
                { key: crypto.randomUUID(), name: "", chiffre: "", capital: "", employees: "" },
              ])
            }
          >
            Ajouter une corporation
          </button>
        </div>
      )}

      <div className="preview" aria-live="polite">
        <h3 className="label">Contrôle avant publication</h3>
        {parsed.rows.length === 0 && parsed.errors.length === 0 ? (
          <p className="preview__idle">
            Collez le rapport ou remplissez le formulaire : KNX le compare au relevé précédent avant
            publication.
          </p>
        ) : (
          <>
            <p className="preview__summary">
              <strong>{parsed.rows.length}</strong> corporations lues
              {previous
                ? ` · comparées au relevé du ${formatImperialDate(previous.date)}`
                : " · premier relevé"}
            </p>
            {parsed.errors.length > 0 ? (
              <div className="note note--error">
                <strong>
                  {parsed.errors.length} ligne{parsed.errors.length > 1 ? "s" : ""} à corriger
                </strong>
                <ul>
                  {parsed.errors.slice(0, 8).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {review.diff ? (
              <ReportChecks
                review={review}
                choices={choices}
                onChoice={(key, value) => setChoices((current) => ({ ...current, [key]: value }))}
                showClean={parsed.errors.length === 0}
              />
            ) : null}
          </>
        )}

        {exists ? (
          <label className="replace">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
            />
            {pendingHere ? (
              <>
                Un envoi du jeu attend validation pour le <ImperialDate date={date} /> : publier
                cette saisie à sa place.
              </>
            ) : (
              <>
                Un relevé existe déjà pour le <ImperialDate date={date} /> : le remplacer.
              </>
            )}
          </label>
        ) : null}

        <div className="preview__actions">
          <button type="button" className="button" disabled={!canPublish} onClick={submit}>
            {busy ? "Publication…" : exists ? "Remplacer le relevé" : "Publier le relevé"}
          </button>
          {status ? <p className={`note note--${status.tone}`}>{status.text}</p> : null}
        </div>
      </div>
    </section>
  );
}

export function ReportsPage() {
  const { state, session, source } = useData();
  const dataset = state.status === "ready" ? state.dataset : null;
  const isAdmin = session?.state === "signed-in" && session.isAdmin;
  const { pending, error: pendingError, refresh } = usePending(isAdmin);
  const pendingDates = useMemo(() => new Set(pending.map((p) => p.date)), [pending]);
  const [status, setStatus] = useState<PublishStatus | null>(null);

  return (
    <div className="reports">
      <header className="page-head">
        <div>
          <h1>Relevés</h1>
          <p>
            Chaque jour, le rapport « Corporations » du jeu devient un relevé KNX. Le module de jeu
            l'envoie directement pour validation ; sinon, collez-le tel quel ou saisissez-le à la
            main.
          </p>
        </div>
        {source.kind === "supabase" && session?.state === "signed-in" ? (
          <p className="reports__who">
            Connecté : {session.email}{" "}
            <button type="button" className="linklike" onClick={() => source.signOut()}>
              se déconnecter
            </button>
          </p>
        ) : null}
      </header>

      {session === null ? (
        <p className="state" role="status">
          Vérification de l'accès…
        </p>
      ) : session.state === "anonymous" ? (
        <SignIn />
      ) : !session.isAdmin ? (
        <p className="note note--warn">
          <strong>Accès en lecture seule.</strong> Ce compte n'est pas opérateur de KNX. Un
          administrateur doit l'ajouter à la table des opérateurs.
        </p>
      ) : (
        <div className="reports__grid">
          <div className="reports__main">
            <PendingReview
              pending={pending}
              error={pendingError}
              dataset={dataset}
              onChanged={refresh}
            />
            <Editor
              key={dataset?.snapshots.length ?? 0}
              dataset={dataset}
              pendingDates={pendingDates}
              status={status}
              setStatus={setStatus}
            />
          </div>
          <div className="reports__side">
            {state.status === "ready" ? <ConsortiumManager market={state.market} /> : null}
            {dataset ? <Journal dataset={dataset} /> : null}
            {source.kind === "supabase" ? <ApiKeysPanel /> : null}
          </div>
        </div>
      )}
    </div>
  );
}
