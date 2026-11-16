import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { ImperialDate } from "../components/figures.tsx";
import { MovementsTable } from "../components/MovementsTable.tsx";
import { useData } from "../data/DataProvider.tsx";
import {
  cashBalance,
  isLogin,
  parseCredits,
  temporaryPassword,
  type CashMovement,
  type InvestorAccount,
} from "../domain/investors.ts";
import { formatInteger } from "../domain/numbers.ts";
import { accountCash, type MarketOrder, type MarketTrade } from "../domain/trading.ts";
import { SignIn } from "./ReportsPage.tsx";
import "./BoursePage.css";
import "./InvestorPage.css";
import "./AccountsAdminPage.css";

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Credentials to hand over once: KNX does not keep the password. */
function Handover({
  login,
  password,
  onClose,
}: {
  login: string;
  password: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = `Identifiant : ${login}\nMot de passe temporaire : ${password}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="note note--ok accounts__handover" role="status">
      <p>
        <strong>À remettre au joueur, une seule fois.</strong> Ce mot de passe ne sera plus affiché
        ; le joueur le remplace à sa première connexion sur la page Compte.
      </p>
      <dl>
        <div>
          <dt className="label">Identifiant</dt>
          <dd>{login}</dd>
        </div>
        <div>
          <dt className="label">Mot de passe temporaire</dt>
          <dd className="accounts__secret">{password}</dd>
        </div>
      </dl>
      <div className="accounts__actions">
        <button type="button" className="button button--quiet" onClick={() => void copy()}>
          {copied ? "Copié" : "Copier"}
        </button>
        <button type="button" className="linklike" onClick={onClose}>
          masquer
        </button>
      </div>
    </div>
  );
}

function CreateAccount({
  taken,
  companies,
  onDone,
}: {
  taken: ReadonlySet<string>;
  /** Pages that have no account of their own yet. */
  companies: readonly { profileId: string; name: string }[];
  onDone: () => void;
}) {
  const { source } = useData();
  const [login, setLogin] = useState("");
  const [name, setName] = useState("");
  const [profileId, setProfileId] = useState("");
  const [password, setPassword] = useState(() => temporaryPassword());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handover, setHandover] = useState<{ login: string; password: string } | null>(null);
  const duplicate = taken.has(login);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isLogin(login) || duplicate) return;
    setBusy(true);
    setError(null);
    try {
      await source.createInvestorAccount({
        login,
        displayName: name.trim(),
        password,
        profileId: profileId || null,
      });
      setHandover({ login, password });
      setLogin("");
      setName("");
      setProfileId("");
      setPassword(temporaryPassword());
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="investor__form" onSubmit={submit}>
      <h3 className="label">Nouveau compte</h3>
      <div className="accounts__row">
        <label className="field">
          <span className="label">Identifiant (5 chiffres)</span>
          <input
            required
            inputMode="numeric"
            pattern="[0-9]{5}"
            maxLength={5}
            value={login}
            onChange={(e) => setLogin(e.target.value.replace(/\D/g, ""))}
          />
        </label>
        <label className="field">
          <span className="label">{profileId ? "DG, personnage" : "Personnage"}</span>
          <input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span className="label">Compte de corporation (facultatif)</span>
        <select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
          <option value="">Compte d'investisseur</option>
          {companies.map((c) => (
            <option key={c.profileId} value={c.profileId}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {profileId ? (
        <p className="bourse__note">
          Un compte de corporation reçoit le produit de ses offres et se retire en jeu comme un
          autre ; il ne passe pas d'ordres. Tenu par le DG.
        </p>
      ) : null}
      <label className="field">
        <span className="label">Mot de passe temporaire</span>
        <span className="investor__amount">
          <input readOnly value={password} className="accounts__secret" />
          <button
            type="button"
            className="button button--quiet"
            onClick={() => setPassword(temporaryPassword())}
          >
            Autre
          </button>
        </span>
      </label>
      {duplicate ? <p className="note note--warn">Identifiant déjà pris.</p> : null}
      <button
        className="button"
        type="submit"
        disabled={busy || !isLogin(login) || duplicate || name.trim() === ""}
      >
        {busy ? "Création…" : "Créer le compte"}
      </button>
      {error ? (
        <p className="note note--error" role="alert">
          Création refusée : {error}
        </p>
      ) : null}
      {handover ? <Handover {...handover} onClose={() => setHandover(null)} /> : null}
    </form>
  );
}

function DepositForm({
  accounts,
  selected,
  onSelect,
  onDone,
}: {
  accounts: readonly InvestorAccount[];
  selected: string;
  onSelect: (id: string) => void;
  onDone: () => void;
}) {
  const { source } = useData();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const value = parseCredits(amount);
  const account = accounts.find((a) => a.id === selected) ?? null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!account || value === null) return;
    if (
      !window.confirm(
        `Inscrire un dépôt de ${formatInteger(value)} ¢ sur le compte ${account.login} (${account.displayName}) ? Les crédits doivent avoir été reçus en jeu.`,
      )
    )
      return;
    setBusy(true);
    setMessage(null);
    try {
      await source.recordDeposit(account.id, value, note.trim() || null);
      setAmount("");
      setNote("");
      setMessage({ tone: "ok", text: `Dépôt inscrit sur le compte ${account.login}.` });
      onDone();
    } catch (err) {
      setMessage({ tone: "error", text: `Dépôt refusé : ${errorText(err)}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="investor__form" onSubmit={submit}>
      <h3 className="label">Inscrire un dépôt reçu en jeu</h3>
      <label className="field">
        <span className="label">Compte</span>
        <select value={selected} required onChange={(e) => onSelect(e.target.value)}>
          <option value="">Choisir un compte</option>
          {accounts
            .filter((a) => !a.closedAt)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.login} · {a.displayName}
              </option>
            ))}
        </select>
      </label>
      <label className="field">
        <span className="label">Montant reçu</span>
        <span className="investor__amount">
          <input
            inputMode="numeric"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <span className="investor__unit">¢</span>
        </span>
      </label>
      <label className="field">
        <span className="label">Note (facultative)</span>
        <input value={note} placeholder="Virement du…" onChange={(e) => setNote(e.target.value)} />
      </label>
      {amount && value === null ? (
        <p className="note note--warn">Montant en crédits entiers.</p>
      ) : null}
      <button className="button" type="submit" disabled={busy || !account || value === null}>
        {busy ? "Inscription…" : "Inscrire le dépôt"}
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

/** Corporations an account is declared an insider of (DG, employee): no trading their shares. */
function InsiderEditor({
  account,
  companies,
  onDone,
}: {
  account: InvestorAccount;
  companies: readonly { profileId: string; name: string }[];
  onDone: (saved: boolean) => void;
}) {
  const { source } = useData();
  const [chosen, setChosen] = useState<string[]>(account.insiderOf);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await source.setInsiders(account.id, chosen);
      onDone(true);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };
  return (
    <div className="accounts__insiders">
      <label className="field">
        <span className="label">
          Initié de (DG, employé) : ces titres lui sont fermés · Ctrl ou Maj pour plusieurs
        </span>
        <select
          multiple
          size={8}
          value={chosen}
          onChange={(e) => setChosen([...e.target.selectedOptions].map((o) => o.value))}
        >
          {companies.map((c) => (
            <option key={c.profileId} value={c.profileId}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="accounts__actions">
        <button type="button" className="button" disabled={busy} onClick={() => void save()}>
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button type="button" className="linklike" onClick={() => onDone(false)}>
          annuler
        </button>
      </div>
      {error ? (
        <p className="note note--error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function AccountsAdmin() {
  const { source, state } = useData();
  const market = state.status === "ready" ? state.market : null;
  const [accounts, setAccounts] = useState<InvestorAccount[] | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [orders, setOrders] = useState<MarketOrder[]>([]);
  const [trades, setTrades] = useState<MarketTrade[]>([]);
  const [insiderFor, setInsiderFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [handover, setHandover] = useState<{ login: string; password: string } | null>(null);

  const refresh = useCallback(() => {
    Promise.all([
      source.investorAccounts(),
      source.cashMovements(),
      source.marketOrders(),
      source.marketTrades(),
    ]).then(
      ([a, m, o, t]) => {
        setAccounts(a);
        setMovements(m);
        setOrders(o);
        setTrades(t);
        setError(null);
      },
      (err: unknown) => setError(errorText(err)),
    );
  }, [source]);
  useEffect(refresh, [refresh]);

  const byAccount = useMemo(() => {
    const map = new Map<string, CashMovement[]>();
    for (const m of movements) map.set(m.accountId, [...(map.get(m.accountId) ?? []), m]);
    return map;
  }, [movements]);
  const companies = useMemo(
    () =>
      (market?.companies ?? [])
        .map((c) => ({ profileId: c.profileId, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [market],
  );
  const companyName = (profileId: string) =>
    companies.find((c) => c.profileId === profileId)?.name ?? "corporation inconnue";
  const nameOf = (id: string) => {
    const a = accounts?.find((x) => x.id === id);
    return a ? `${a.login} · ${a.displayName}` : "?";
  };
  const pendingList = movements.filter((m) => m.kind === "withdrawal" && m.status === "requested");
  const totals = cashBalance(movements);
  const taken = useMemo(() => new Set((accounts ?? []).map((a) => a.login)), [accounts]);

  const settle = async (m: CashMovement) => {
    if (
      !window.confirm(
        `Confirmer que ${formatInteger(m.amount)} ¢ ont été versés en jeu à ${nameOf(m.accountId)} ?`,
      )
    )
      return;
    try {
      await source.settleWithdrawal(m.id);
      refresh();
    } catch (err) {
      setError(errorText(err));
    }
  };
  const refuse = async (m: CashMovement) => {
    if (
      !window.confirm(
        `Refuser le retrait de ${formatInteger(m.amount)} ¢ de ${nameOf(m.accountId)} ?`,
      )
    )
      return;
    try {
      await source.cancelWithdrawal(m.id);
      refresh();
    } catch (err) {
      setError(errorText(err));
    }
  };
  const reset = async (a: InvestorAccount) => {
    if (
      !window.confirm(
        `Donner un nouveau mot de passe temporaire au compte ${a.login} (${a.displayName}) ? L'ancien cessera de fonctionner.`,
      )
    )
      return;
    const password = temporaryPassword();
    try {
      await source.resetInvestorPassword(a.login, password);
      setHandover({ login: a.login, password });
      refresh();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <>
      <dl className="bourse__facts">
        <div>
          <dt className="label">Crédits en garde</dt>
          <dd className="bourse__figure">
            {formatInteger(totals.balance)}
            <span className="amount__unit"> ¢</span>
          </dd>
          <dd className="bourse__detail">soldes réglés de tous les comptes</dd>
        </div>
        <div>
          <dt className="label">Retraits à verser</dt>
          <dd className="bourse__figure">
            {formatInteger(totals.pending)}
            <span className="amount__unit"> ¢</span>
          </dd>
          <dd className="bourse__detail">
            {pendingList.length} demande{pendingList.length > 1 ? "s" : ""} en attente
          </dd>
        </div>
        <div>
          <dt className="label">Comptes</dt>
          <dd className="bourse__figure">{accounts?.length ?? "…"}</dd>
          <dd className="bourse__detail">
            {(accounts ?? []).filter((a) => a.mustChangePassword).length} sur mot de passe
            temporaire
          </dd>
        </div>
      </dl>

      {error ? (
        <p className="note note--error" role="alert">
          {error}
        </p>
      ) : null}
      {handover ? <Handover {...handover} onClose={() => setHandover(null)} /> : null}

      <section className="bourse__section" aria-labelledby="retraits">
        <div className="section-head">
          <h2 id="retraits">Retraits à verser</h2>
          <p>versez les crédits en jeu, puis réglez la demande</p>
        </div>
        {pendingList.length === 0 ? (
          <p className="bourse__note">Aucune demande en attente.</p>
        ) : (
          <ol className="bourse__journal">
            {pendingList.map((m) => (
              <li key={m.id} className="accounts__pending">
                <ImperialDate date={m.requestedAt.slice(0, 10)} />
                <span>
                  <strong>{formatInteger(m.amount)} ¢</strong> pour {nameOf(m.accountId)}
                  {m.note ? <span className="bourse__muted"> — {m.note}</span> : null}
                </span>
                <span className="accounts__actions">
                  <button type="button" className="button" onClick={() => void settle(m)}>
                    Versé en jeu
                  </button>
                  <button type="button" className="linklike" onClick={() => void refuse(m)}>
                    refuser
                  </button>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="bourse__section" aria-labelledby="comptes">
        <div className="section-head">
          <h2 id="comptes">Comptes</h2>
          <p>un compte par personnage investisseur</p>
        </div>
        <div className="accounts__grid">
          <div className="bourse__scroll">
            {accounts && accounts.length === 0 ? (
              <p className="bourse__note">Aucun compte pour l'instant.</p>
            ) : (
              <table className="ledger">
                <caption className="sr-only">Comptes investisseurs</caption>
                <thead>
                  <tr>
                    <th scope="col">Compte</th>
                    <th scope="col" className="num">
                      Solde
                    </th>
                    <th scope="col" className="num secondary">
                      En attente
                    </th>
                    <th scope="col" className="secondary">
                      Mot de passe
                    </th>
                    <th scope="col" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {(accounts ?? []).map((a) => {
                    const cash = accountCash(
                      byAccount.get(a.id) ?? [],
                      trades.filter((t) => t.accountId === a.id),
                      orders.filter((o) => o.accountId === a.id),
                    );
                    return (
                      <Fragment key={a.id}>
                        <tr>
                          <th scope="row">
                            <strong>{a.login}</strong> {a.displayName}
                            {a.closedAt ? <span className="bourse__off"> · fermé</span> : null}
                            {a.companyProfileId ? (
                              <span className="accounts__corporate">
                                compte de {companyName(a.companyProfileId)}
                              </span>
                            ) : null}
                            {a.insiderOf.length > 0 ? (
                              <span className="accounts__insider-list">
                                initié de {a.insiderOf.map(companyName).join(", ")}
                              </span>
                            ) : null}
                          </th>
                          <td className="num">{formatInteger(cash.balance)} ¢</td>
                          <td className="num secondary">
                            {cash.pending > 0 ? `${formatInteger(cash.pending)} ¢` : "—"}
                          </td>
                          <td className="secondary">
                            {a.mustChangePassword ? (
                              <span className="bourse__off">temporaire</span>
                            ) : (
                              "choisi"
                            )}
                          </td>
                          <td className="accounts__row-actions">
                            <button
                              type="button"
                              className="linklike"
                              onClick={() => setSelected(a.id)}
                            >
                              dépôt
                            </button>
                            <button
                              type="button"
                              className="linklike"
                              onClick={() => void reset(a)}
                            >
                              nouveau mot de passe
                            </button>
                            {market ? (
                              <button
                                type="button"
                                className="linklike"
                                onClick={() => setInsiderFor(insiderFor === a.id ? null : a.id)}
                              >
                                initiés
                              </button>
                            ) : null}
                          </td>
                        </tr>
                        {insiderFor === a.id ? (
                          <tr>
                            <td colSpan={5}>
                              <InsiderEditor
                                account={a}
                                companies={companies}
                                onDone={(saved) => {
                                  setInsiderFor(null);
                                  if (saved) refresh();
                                }}
                              />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className="accounts__forms">
            <DepositForm
              accounts={accounts ?? []}
              selected={selected}
              onSelect={setSelected}
              onDone={refresh}
            />
            <CreateAccount
              taken={taken}
              companies={companies.filter(
                (c) => !(accounts ?? []).some((a) => a.companyProfileId === c.profileId),
              )}
              onDone={refresh}
            />
          </div>
        </div>
      </section>

      <section className="bourse__section" aria-labelledby="journal">
        <div className="section-head">
          <h2 id="journal">Journal des mouvements</h2>
          <p>tous les comptes, le plus récent d'abord</p>
        </div>
        <MovementsTable movements={movements} account={(m) => nameOf(m.accountId)} />
      </section>
    </>
  );
}

/** The operator's side of the investor accounts: create, credit, pay out. */
export function AccountsAdminPage() {
  const { session, source } = useData();

  return (
    <div className="bourse accounts">
      <header className="page-head">
        <div>
          <h1>Comptes investisseurs</h1>
          <p>
            Les joueurs investissent de vrais crédits de Dreadcast : ils les versent en jeu, KNX les
            inscrit ici ; un retrait demandé sur le site est versé en jeu, puis réglé. Voir aussi
            les <Link to="/bourse/reglages">réglages de la Bourse</Link>.
          </p>
        </div>
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
        <SignIn />
      ) : !session.isAdmin ? (
        <p className="note note--warn">
          <strong>Accès réservé aux opérateurs.</strong>
        </p>
      ) : (
        <AccountsAdmin />
      )}
    </div>
  );
}
