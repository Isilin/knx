import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { MovementsTable } from "../components/MovementsTable.tsx";
import { useData } from "../data/DataProvider.tsx";
import {
  cashBalance,
  isLogin,
  MIN_PASSWORD,
  parseCredits,
  passwordProblem,
  type CashMovement,
  type InvestorAccount,
} from "../domain/investors.ts";
import { formatInteger } from "../domain/numbers.ts";
import "./InvestorPage.css";

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

function InvestorSignIn() {
  const { source } = useData();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await source.signInInvestor(login.trim(), password);
      // The session listener swaps this form for the account.
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <form className="signin" onSubmit={submit}>
      <h2>Connexion investisseur</h2>
      <p>
        Votre identifiant de cinq chiffres et votre mot de passe vous ont été remis par KNX à
        l'ouverture de votre compte.
      </p>
      <label className="field">
        <span className="label">Identifiant</span>
        <input
          required
          inputMode="numeric"
          autoComplete="username"
          pattern="[0-9]{5}"
          maxLength={5}
          value={login}
          onChange={(e) => setLogin(e.target.value.replace(/\D/g, ""))}
        />
      </label>
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
      <button className="button" type="submit" disabled={busy || !isLogin(login.trim())}>
        {busy ? "Connexion…" : "Se connecter"}
      </button>
      {error ? (
        <p className="note note--error" role="alert">
          Connexion impossible : {error}
        </p>
      ) : null}
    </form>
  );
}

function PasswordChange({
  account,
  forced,
  onDone,
}: {
  account: InvestorAccount;
  forced: boolean;
  onDone?: () => void;
}) {
  const { source, refreshSession } = useData();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem = password ? passwordProblem(password, account.login) : null;
  const mismatch = confirm !== "" && confirm !== password;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (problem || mismatch) return;
    setBusy(true);
    setError(null);
    try {
      await source.changePassword(password);
      // The session carries the temporary-password flag: read it again.
      refreshSession();
      onDone?.();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <form className="signin" onSubmit={submit}>
      <h2>{forced ? "Choisissez votre mot de passe" : "Changer de mot de passe"}</h2>
      {forced ? (
        <p>
          Le mot de passe remis à l'ouverture est temporaire : remplacez-le avant d'utiliser votre
          compte. KNX ne le connaîtra plus.
        </p>
      ) : null}
      <label className="field">
        <span className="label">Nouveau mot de passe ({MIN_PASSWORD} caractères au moins)</span>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <label className="field">
        <span className="label">Confirmation</span>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>
      {problem ? <p className="note note--warn">Mot de passe : {problem}.</p> : null}
      {mismatch ? <p className="note note--warn">Les deux saisies diffèrent.</p> : null}
      <button
        className="button"
        type="submit"
        disabled={busy || !password || problem !== null || confirm !== password}
      >
        {busy ? "Enregistrement…" : "Enregistrer le mot de passe"}
      </button>
      {error ? (
        <p className="note note--error" role="alert">
          Changement refusé : {error}
        </p>
      ) : null}
    </form>
  );
}

function WithdrawalForm({ available, onDone }: { available: number; onDone: () => void }) {
  const { source } = useData();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const value = parseCredits(amount);
  const tooMuch = value !== null && value > available;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (value === null || tooMuch) return;
    setBusy(true);
    setMessage(null);
    try {
      await source.requestWithdrawal(value, note.trim() || null);
      setAmount("");
      setNote("");
      setMessage({
        tone: "ok",
        text: "Demande envoyée : KNX vous versera les crédits en jeu, puis la réglera ici.",
      });
      onDone();
    } catch (err) {
      setMessage({ tone: "error", text: `Demande refusée : ${errorText(err)}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="investor__form" onSubmit={submit}>
      <h3 className="label">Demander un retrait</h3>
      <label className="field">
        <span className="label">Montant</span>
        <span className="investor__amount">
          <input
            inputMode="numeric"
            required
            value={amount}
            placeholder={formatInteger(Math.max(0, available))}
            onChange={(e) => setAmount(e.target.value)}
          />
          <span className="investor__unit">¢</span>
        </span>
      </label>
      <label className="field">
        <span className="label">Note pour KNX (facultative)</span>
        <input
          value={note}
          placeholder="Personnage qui reçoit les crédits…"
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {amount && value === null ? (
        <p className="note note--warn">Montant en crédits entiers.</p>
      ) : null}
      {tooMuch ? (
        <p className="note note--warn">Au plus {formatInteger(available)} ¢ disponibles.</p>
      ) : null}
      <button
        className="button"
        type="submit"
        disabled={busy || value === null || tooMuch || available <= 0}
      >
        {busy ? "Envoi…" : "Demander le retrait"}
      </button>
      {message ? (
        <p
          className={`note note--${message.tone}`}
          role={message.tone === "error" ? "alert" : undefined}
        >
          {message.text}
        </p>
      ) : null}
    </form>
  );
}

function AccountView({ account }: { account: InvestorAccount }) {
  const { source } = useData();
  const [movements, setMovements] = useState<CashMovement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  const refresh = useCallback(() => {
    source.cashMovements().then(setMovements, (err: unknown) => setError(errorText(err)));
  }, [source]);
  useEffect(refresh, [refresh]);

  const cancel = async (movement: CashMovement) => {
    if (!window.confirm(`Annuler la demande de retrait de ${formatInteger(movement.amount)} ¢ ?`))
      return;
    try {
      await source.cancelWithdrawal(movement.id);
      refresh();
    } catch (err) {
      setError(errorText(err));
    }
  };

  const { balance, pending, available } = cashBalance(movements ?? []);

  return (
    <div className="investor__account">
      <dl className="investor__facts">
        <div>
          <dt className="label">Solde</dt>
          <dd className="investor__figure">
            {movements ? formatInteger(balance) : "…"}
            <span className="amount__unit"> ¢</span>
          </dd>
          <dd className="investor__detail">crédits de Dreadcast déposés chez KNX</dd>
        </div>
        <div>
          <dt className="label">Disponible</dt>
          <dd className="investor__figure">
            {movements ? formatInteger(available) : "…"}
            <span className="amount__unit"> ¢</span>
          </dd>
          <dd className="investor__detail">solde moins les retraits en attente</dd>
        </div>
        <div>
          <dt className="label">Retraits en attente</dt>
          <dd className="investor__figure">
            {movements ? formatInteger(pending) : "…"}
            <span className="amount__unit"> ¢</span>
          </dd>
          <dd className="investor__detail">à verser en jeu par KNX</dd>
        </div>
      </dl>

      {error ? (
        <p className="note note--error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="investor__grid">
        <section aria-labelledby="mouvements">
          <h2 id="mouvements" className="investor__h2">
            Mouvements
          </h2>
          {movements ? <MovementsTable movements={movements} onCancel={cancel} /> : null}
        </section>
        <aside className="investor__side">
          <div className="investor__box">
            <h3 className="label">Déposer des crédits</h3>
            <p>
              Versez les crédits en jeu à KNX en précisant votre identifiant ({account.login}). Dès
              réception, KNX les inscrit sur votre compte.
            </p>
          </div>
          <WithdrawalForm available={available} onDone={refresh} />
          {changing ? (
            <PasswordChange account={account} forced={false} onDone={() => setChanging(false)} />
          ) : (
            <button type="button" className="linklike" onClick={() => setChanging(true)}>
              Changer de mot de passe
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

/** A player's own space: sign in, set a password, follow and withdraw their credits. */
export function InvestorPage() {
  const { session, source } = useData();
  const investor = session?.state === "signed-in" ? session.investor : null;

  return (
    <div className="investor">
      <header className="page-head">
        <div>
          <h1>{investor ? `Compte ${investor.login}` : "Compte investisseur"}</h1>
          <p>
            {investor
              ? `${investor.displayName} · crédits de Dreadcast déposés chez KNX. Les ordres de bourse arrivent bientôt.`
              : "L'espace des investisseurs de la Bourse KNX : vos crédits déposés, vos retraits."}
          </p>
        </div>
        {session?.state === "signed-in" ? (
          <button type="button" className="button button--quiet" onClick={() => source.signOut()}>
            Se déconnecter
          </button>
        ) : null}
      </header>

      {source.kind === "local" ? (
        <p className="note note--warn">
          Mode local : les comptes investisseurs portent de vrais crédits et demandent la base
          Supabase.
        </p>
      ) : session === null ? (
        <p className="state" role="status">
          Vérification de l'accès…
        </p>
      ) : session.state === "anonymous" ? (
        <InvestorSignIn />
      ) : !investor ? (
        <p className="note note--warn">
          <strong>Ce compte n'est pas un compte investisseur.</strong>{" "}
          {session.isAdmin ? (
            <>
              Les comptes des joueurs se gèrent depuis{" "}
              <Link to="/bourse/comptes">Bourse › Comptes</Link>.
            </>
          ) : (
            "Déconnectez-vous, puis connectez-vous avec votre identifiant de cinq chiffres."
          )}
        </p>
      ) : investor.closedAt ? (
        <p className="note note--warn">Ce compte est fermé. Contactez KNX.</p>
      ) : investor.mustChangePassword ? (
        <PasswordChange account={investor} forced />
      ) : (
        <AccountView account={investor} />
      )}
    </div>
  );
}
