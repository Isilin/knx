import { useMemo, useState, type FormEvent } from "react";
import { Amount, Change } from "../components/figures.tsx";
import { useData } from "../data/DataProvider.tsx";
import { daysBetween, formatLongDate } from "../domain/dates.ts";
import { assignRanks, diffReport } from "../domain/diff.ts";
import { formatPercent, parseAmount } from "../domain/numbers.ts";
import { parseReport } from "../domain/report.ts";
import type { Dataset, SnapshotRow, SnapshotSource } from "../domain/types.ts";
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
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setState("sending");
    try {
      await source.requestSignIn(email.trim());
      setState("sent");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <form className="signin" onSubmit={submit}>
      <h2>Accès opérateur</h2>
      <p>
        La saisie des relevés est réservée aux opérateurs de KNX. Recevez un lien de connexion par
        e-mail.
      </p>
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
      <button className="button" type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Envoi…" : "Recevoir le lien"}
      </button>
      {state === "sent" ? (
        <p className="note note--ok">
          Lien envoyé. Ouvrez-le depuis ce navigateur pour revenir ici connecté.
        </p>
      ) : null}
      {state === "error" ? <p className="note note--error">Envoi impossible : {message}</p> : null}
    </form>
  );
}

function Journal({ dataset }: { dataset: Dataset }) {
  const recent = [...dataset.snapshots].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
  const labels: Record<SnapshotSource, string> = {
    sheet: "tableur",
    form: "formulaire",
    paste: "rapport collé",
    userscript: "userscript",
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
            <time dateTime={s.date}>{formatLongDate(s.date)}</time>
            <span>{s.rows.length} corporations</span>
            <span className="journal__source">{labels[s.source]}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** `A, B, C et 12 autres` */
function list(names: readonly string[], limit = 8): string {
  if (names.length === 0) return "aucune";
  if (names.length <= limit) return names.join(", ");
  return `${names.slice(0, limit).join(", ")} et ${names.length - limit} autres`;
}

function Editor({ dataset }: { dataset: Dataset | null }) {
  const { publish, source, state } = useData();
  const market = state.status === "ready" ? state.market : null;
  const [date, setDate] = useState(todayLocal);
  const [mode, setMode] = useState<"paste" | "form">("paste");
  const [text, setText] = useState("");
  const [replace, setReplace] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const previous = useMemo(() => {
    if (!dataset) return null;
    return (
      [...dataset.snapshots]
        .filter((s) => s.date < date)
        .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
    );
  }, [dataset, date]);

  const [formRows, setFormRows] = useState<FormRow[]>(() =>
    (previous?.rows ?? []).map((r, i) => ({
      key: `${i}-${r.name}`,
      name: r.name,
      chiffre: String(r.chiffre),
      capital: r.capital === null ? "" : String(r.capital),
      employees: r.employees === null ? "" : String(r.employees),
    })),
  );

  const exists = dataset?.snapshots.some((s) => s.date === date) ?? false;

  const parsed = useMemo((): { rows: SnapshotRow[]; errors: string[] } => {
    if (mode === "paste") {
      const result = parseReport(text);
      return {
        rows: result.rows,
        errors: result.errors.map((e) => `Ligne ${e.line} : ${e.reason}`),
      };
    }
    const errors: string[] = [];
    const rows: SnapshotRow[] = [];
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

  const diff = useMemo(() => {
    if (!previous || parsed.rows.length === 0) return null;
    const gap = daysBetween(previous.date, date);
    const creations = new Map(
      (market?.companies ?? []).map((c) => [
        c.name,
        c.creation && c.creation.method !== "first-seen" ? c.creation.creation : null,
      ]),
    );
    return diffReport(previous.rows, parsed.rows, {
      gap,
      ageOn: (name) => {
        const creation = creations.get(name);
        return creation ? daysBetween(creation, date) : null;
      },
    });
  }, [previous, parsed.rows, market, date]);
  const canPublish =
    parsed.rows.length > 0 && parsed.errors.length === 0 && (!exists || replace) && !busy;

  const submit = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await publish({
        date,
        source: mode === "paste" ? "paste" : "form",
        rows: parsed.rows,
        replace: exists && replace,
      });
      setStatus({
        tone: "ok",
        text: `Relevé du ${formatLongDate(date)} publié : ${parsed.rows.length} corporations.`,
      });
      setText("");
      setReplace(false);
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
          <span className="label">Date du relevé</span>
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
                ? ` · comparées au relevé du ${formatLongDate(previous.date)}`
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
            {diff ? (
              <ul className="checks">
                <li>
                  <span className="label">Nouvelles</span>
                  <span>{list(diff.newcomers)}</span>
                </li>
                <li className={diff.missing.length > 5 ? "is-warn" : undefined}>
                  <span className="label">Absentes</span>
                  <span>
                    {diff.missing.length === 0
                      ? "aucune"
                      : `${diff.missing.length} : ${list(diff.missing)} (seront marquées radiées)`}
                  </span>
                </li>
                {diff.renames.length > 0 ? (
                  <li className="is-warn">
                    <span className="label">Renommages ?</span>
                    <span>{diff.renames.map((r) => `${r.from} → ${r.to}`).join(" · ")}</span>
                  </li>
                ) : null}
                {diff.outliers.length > 0 ? (
                  <li className="is-warn">
                    <span className="label">À vérifier</span>
                    <span>
                      {diff.outliers.map((o) => (
                        <span key={`${o.name}-${o.field}`} className="outlier">
                          <strong>{o.name}</strong> ·{" "}
                          {o.field === "chiffre" ? "chiffre" : "capital"}{" "}
                          <Amount value={o.before} unit={false} /> →{" "}
                          <Amount value={o.after} unit={false} /> <Change ratio={o.ratio} />
                          <small>{o.reason}</small>
                        </span>
                      ))}
                    </span>
                  </li>
                ) : null}
                {diff.rankMismatches.length > 0 ? (
                  <li className="is-warn">
                    <span className="label">Rangs</span>
                    <span>
                      Ordre incohérent avec le chiffre pour {diff.rankMismatches.join(", ")}.
                    </span>
                  </li>
                ) : null}
              </ul>
            ) : null}
            {parsed.rows.length > 0 &&
            parsed.errors.length === 0 &&
            diff &&
            diff.outliers.length === 0 &&
            diff.renames.length === 0 ? (
              <p className="note note--ok">
                Aucune anomalie détectée. Variation moyenne du chiffre :{" "}
                {formatPercent(average(previous?.rows ?? [], parsed.rows))}.
              </p>
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
            Un relevé existe déjà pour le {formatLongDate(date)} : le remplacer.
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

function average(previous: readonly SnapshotRow[], next: readonly SnapshotRow[]): number {
  const before = new Map(previous.map((r) => [r.name, r.chiffre]));
  const ratios = next.flatMap((r) => {
    const old = before.get(r.name);
    return old && old > 0 && r.chiffre > 0 ? [r.chiffre / old - 1] : [];
  });
  return ratios.length === 0 ? 0 : ratios.reduce((a, b) => a + b, 0) / ratios.length;
}

export function ReportsPage() {
  const { state, session, source } = useData();
  const dataset = state.status === "ready" ? state.dataset : null;

  return (
    <div className="reports">
      <header className="page-head">
        <div>
          <h1>Relevés</h1>
          <p>
            Chaque jour, le rapport « Corporations » du jeu devient un relevé KNX. Collez-le tel
            quel ou saisissez-le à la main ; un envoi direct depuis le jeu viendra plus tard.
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
          <Editor key={dataset?.snapshots.length ?? 0} dataset={dataset} />
          {dataset ? <Journal dataset={dataset} /> : null}
        </div>
      )}
    </div>
  );
}
