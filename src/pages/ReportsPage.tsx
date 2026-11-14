import { useState, type FormEvent } from "react";
import { ConsortiumManager } from "../components/ConsortiumManager.tsx";
import { useData } from "../data/DataProvider.tsx";
import { ApiKeysPanel } from "./reports/ApiKeysPanel.tsx";
import { Journal } from "./reports/Journal.tsx";
import { PendingReview } from "./reports/PendingReview.tsx";
import { usePending } from "./reports/usePending.ts";
import "./ReportsPage.css";

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
      <p>La validation des relevés est réservée aux opérateurs de KNX.</p>
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

export function ReportsPage() {
  const { state, session, source } = useData();
  const dataset = state.status === "ready" ? state.dataset : null;
  const isAdmin = session?.state === "signed-in" && session.isAdmin;
  const { pending, error: pendingError, refresh } = usePending(isAdmin);

  return (
    <div className="reports">
      <header className="page-head">
        <div>
          <h1>Relevés</h1>
          <p>
            Chaque jour, le module du jeu envoie le rapport « Corporations » à KNX. L'envoi attend
            ici qu'un opérateur le contrôle et le publie ; le journal garde la trace des relevés
            publiés.
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
            {dataset ? <Journal dataset={dataset} /> : null}
          </div>
          <div className="reports__side">
            {state.status === "ready" ? <ConsortiumManager market={state.market} /> : null}
            {source.kind === "supabase" ? <ApiKeysPanel /> : null}
          </div>
        </div>
      )}
    </div>
  );
}
