import { useMemo, useState, type FormEvent } from "react";
import { Amount, Change } from "../components/figures.tsx";
import { useData } from "../data/DataProvider.tsx";
import { daysBetween, formatLongDate, formatShortDate } from "../domain/dates.ts";
import { assignRanks, diffReport, type DiffRow } from "../domain/diff.ts";
import {
  proposeIdentities,
  resolveReport,
  type Evidence,
  type IdentityDecisions,
  type RefoundingProposal,
  type RenameProposal,
} from "../domain/identity.ts";
import { formatPercent, parseAmount } from "../domain/numbers.ts";
import { parseReport } from "../domain/report.ts";
import type { Dataset, ReportRow, SnapshotSource } from "../domain/types.ts";
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

const EVIDENCE: Record<Evidence, string> = {
  name: "nom proche",
  chiffre: "CA",
  capital: "capital",
  employees: "effectif",
};

/** `nom proche · mêmes CA, capital et effectif` */
function evidenceText(evidence: readonly Evidence[]): string {
  const parts: string[] = [];
  if (evidence.includes("name")) parts.push(EVIDENCE.name);
  const figures = evidence.filter((e) => e !== "name").map((e) => EVIDENCE[e]);
  if (figures.length > 0)
    parts.push(
      `${figures.length > 1 ? "mêmes" : "même"} ${figures.length > 1 ? `${figures.slice(0, -1).join(", ")} et ${figures.at(-1)}` : figures[0]}`,
    );
  return parts.join(" · ");
}

function Editor({ dataset }: { dataset: Dataset | null }) {
  const { publish, source, state } = useData();
  const market = state.status === "ready" ? state.market : null;
  const [date, setDate] = useState(todayLocal);
  const [mode, setMode] = useState<"paste" | "form">("paste");
  const [text, setText] = useState("");
  const [replace, setReplace] = useState(false);
  const [choices, setChoices] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const nameOf = useMemo(() => {
    const names = new Map(dataset?.companies.map((c) => [c.id, c.name]) ?? []);
    return (id: string) => names.get(id) ?? id;
  }, [dataset]);

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
      key: `${i}-${r.companyId}`,
      name: nameOf(r.companyId),
      chiffre: String(r.chiffre),
      capital: r.capital === null ? "" : String(r.capital),
      employees: r.employees === null ? "" : String(r.employees),
    })),
  );

  const exists = dataset?.snapshots.some((s) => s.date === date) ?? false;

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

  /** Estimated days of activity on the report's date, by corporation. */
  const ageOn = useMemo(() => {
    const creations = new Map(
      (market?.companies ?? []).map((c) => [
        c.id,
        c.creation && c.creation.method !== "first-seen" ? c.creation.creation : null,
      ]),
    );
    return (id: string) => {
      const creation = creations.get(id);
      return creation ? daysBetween(creation, date) : null;
    };
  }, [market, date]);

  const proposals = useMemo(() => {
    if (!dataset || parsed.rows.length === 0) return null;
    return proposeIdentities({
      companies: dataset.companies,
      snapshots: dataset.snapshots,
      withEvents: new Set(dataset.events.map((e) => e.companyId)),
      date,
      rows: parsed.rows,
      ageOn,
    });
  }, [dataset, parsed.rows, date, ageOn]);

  const renameKey = (r: RenameProposal) => `rename:${r.companyId}:${r.to}`;
  const refoundKey = (r: RefoundingProposal) => `refound:${r.companyId}`;
  const resolved = useMemo(() => {
    if (!proposals) return null;
    const decisions: IdentityDecisions = {
      renames: new Set(
        proposals.renames
          .filter((r) => choices[renameKey(r)] ?? r.suggested)
          .map((r) => r.companyId),
      ),
      refoundings: new Set(
        proposals.refoundings.filter((r) => choices[refoundKey(r)] ?? true).map((r) => r.companyId),
      ),
    };
    return resolveReport(parsed.rows, proposals, decisions);
  }, [proposals, parsed.rows, choices]);

  const comparison = useMemo(() => {
    if (!previous || !resolved) return null;
    const before: DiffRow[] = previous.rows.map((r) => ({
      ...r,
      key: r.companyId,
      name: nameOf(r.companyId),
    }));
    const after: DiffRow[] = resolved.rows.map((r) => ({
      ...r,
      key: r.companyId ?? `new:${r.name}`,
    }));
    return {
      before,
      after,
      diff: diffReport(before, after, { gap: daysBetween(previous.date, date), ageOn }),
    };
  }, [previous, resolved, nameOf, date, ageOn]);
  const diff = comparison?.diff ?? null;

  const created = resolved?.rows.filter((r) => r.companyId === null).map((r) => r.name) ?? [];
  const namesakes = new Map(proposals?.namesakes.map((n) => [n.name, n.closedOn]) ?? []);
  const closures = resolved?.closures.map(nameOf) ?? [];
  const toggle = (key: string, value: boolean) =>
    setChoices((current) => ({ ...current, [key]: value }));

  const canPublish =
    parsed.rows.length > 0 &&
    parsed.errors.length === 0 &&
    resolved !== null &&
    (!exists || replace) &&
    !busy;

  const submit = async () => {
    if (!resolved) return;
    setBusy(true);
    setStatus(null);
    try {
      await publish({
        date,
        source: mode === "paste" ? "paste" : "form",
        rows: resolved.rows,
        closures: resolved.closures,
        replace: exists && replace,
      });
      setStatus({
        tone: "ok",
        text: `Relevé du ${formatLongDate(date)} publié : ${parsed.rows.length} corporations.`,
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
            {proposals && !proposals.latest ? (
              <p className="note">
                Ce relevé est antérieur au dernier publié : ses lignes sont rattachées aux
                corporations ouvertes à cette date, sans fermeture ni renommage.
              </p>
            ) : null}
            {proposals && (diff || created.length > 0) ? (
              <ul className="checks">
                <li>
                  <span className="label">Nouvelles</span>
                  <span>
                    {created.length === 0
                      ? "aucune"
                      : created
                          .map((name) =>
                            namesakes.has(name)
                              ? `${name} (homonyme d'une corporation fermée le ${formatShortDate(namesakes.get(name) ?? "")} : nouvelle fiche)`
                              : name,
                          )
                          .join(", ")}
                  </span>
                </li>
                <li className={closures.length > 0 ? "is-warn" : undefined}>
                  <span className="label">Fermetures</span>
                  <span>
                    {closures.length === 0
                      ? "aucune"
                      : `${closures.length} : ${list(closures)}. Une fermeture est définitive.`}
                  </span>
                </li>
                {proposals.renames.length > 0 ? (
                  <li className="is-warn">
                    <span className="label">Renommages</span>
                    <span className="choices">
                      {proposals.renames.map((r) => (
                        <label key={renameKey(r)} className="choice">
                          <input
                            type="checkbox"
                            checked={choices[renameKey(r)] ?? r.suggested}
                            onChange={(e) => toggle(renameKey(r), e.target.checked)}
                          />
                          <span>
                            <strong>{r.from}</strong> devient <strong>{r.to}</strong>
                            <small>
                              {evidenceText(r.evidence)} · décoché : {r.from} fermée, {r.to}{" "}
                              nouvelle
                            </small>
                          </span>
                        </label>
                      ))}
                    </span>
                  </li>
                ) : null}
                {proposals.refoundings.length > 0 ? (
                  <li className="is-warn">
                    <span className="label">Refondations</span>
                    <span className="choices">
                      {proposals.refoundings.map((r) => (
                        <label key={refoundKey(r)} className="choice">
                          <input
                            type="checkbox"
                            checked={choices[refoundKey(r)] ?? true}
                            onChange={(e) => toggle(refoundKey(r), e.target.checked)}
                          />
                          <span>
                            <strong>{r.name}</strong> a fermé puis rouvert sous le même nom :
                            nouvelle fiche, historique repris à zéro
                            <small>
                              CA <Amount value={r.before.chiffre} unit={false} /> →{" "}
                              <Amount value={r.after.chiffre} unit={false} />
                              {r.before.capital !== null && r.after.capital !== null ? (
                                <>
                                  {" "}
                                  · capital <Amount value={r.before.capital} unit={false} /> →{" "}
                                  <Amount value={r.after.capital} unit={false} />
                                </>
                              ) : null}
                            </small>
                          </span>
                        </label>
                      ))}
                    </span>
                  </li>
                ) : null}
                {diff && diff.outliers.length > 0 ? (
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
                {diff && diff.rankMismatches.length > 0 ? (
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
            comparison &&
            comparison.diff.outliers.length === 0 &&
            proposals?.renames.length === 0 &&
            proposals.refoundings.length === 0 ? (
              <p className="note note--ok">
                Aucune anomalie détectée. Variation moyenne du chiffre :{" "}
                {formatPercent(average(comparison.before, comparison.after))}.
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

function average(previous: readonly DiffRow[], next: readonly DiffRow[]): number {
  const before = new Map(previous.map((r) => [r.key, r.chiffre]));
  const ratios = next.flatMap((r) => {
    const old = before.get(r.key);
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
