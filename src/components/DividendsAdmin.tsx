import { useState, type FormEvent } from "react";
import { useData } from "../data/DataProvider.tsx";
import type { CashMovement, InvestorAccount } from "../domain/investors.ts";
import type { CompanySeries, Market } from "../domain/market.ts";
import { formatInteger, formatPrice, formatShare } from "../domain/numbers.ts";
import {
  accountCash,
  DIVIDEND_POLICIES,
  DIVIDEND_POLICY_INFO,
  DIVIDEND_STATUS_LABELS,
  dividendCost,
  dividendProblem,
  holdersOf,
  policyOf,
  type Dividend,
  type DividendPayment,
  type DividendPolicy,
  type DividendPolicyKind,
  type MarketOrder,
  type MarketSession,
  type MarketTrade,
  type ShareIssue,
} from "../domain/trading.ts";
import { ImperialDate } from "./figures.tsx";

/** What the operator's dividend tools read: the whole market, every account. */
export interface DividendBook {
  sessions: MarketSession[];
  orders: MarketOrder[];
  trades: MarketTrade[];
  issues: ShareIssue[];
  accounts: InvestorAccount[];
  movements: CashMovement[];
  policies: DividendPolicy[];
  dividends: Dividend[];
  payments: DividendPayment[];
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Cash of one account, read from the operator's view of every account. */
function bookCash(book: DividendBook, accountId: string) {
  return accountCash(
    book.movements.filter((m) => m.accountId === accountId),
    book.trades.filter((t) => t.accountId === accountId),
    book.orders.filter((o) => o.accountId === accountId),
    book.payments.filter((p) => p.accountId === accountId),
    book.dividends.filter((d) => d.accountId === accountId),
  );
}

/** Corporations introduced and still on the cote (listed or suspended). */
function introduced(market: Market): CompanySeries[] {
  return market.companies
    .filter((c) => {
      const state = c.valuation?.listing?.state;
      return c.status !== "delisted" && (state === "listed" || state === "suspended");
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

function DividendForm({
  market,
  book,
  sessionId,
  onDone,
}: {
  market: Market;
  book: DividendBook;
  sessionId: string;
  onDone: () => void;
}) {
  const { source } = useData();
  const candidates = introduced(market)
    .map((company) => ({
      company,
      account: book.accounts.find((a) => a.companyProfileId === company.profileId && !a.closedAt),
    }))
    .filter((x) => x.account);
  const [companyId, setCompanyId] = useState("");
  const [perShare, setPerShare] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const pick = candidates.find((x) => x.company.id === companyId) ?? null;
  const corporations = new Set(
    book.accounts.filter((a) => a.companyProfileId !== null).map((a) => a.id),
  );
  const holders = pick ? holdersOf(pick.company.id, book.trades, book.issues, corporations) : [];
  const unit = Number(perShare.replace(",", "."));
  const cost = dividendCost(holders, unit > 0 ? unit : 0);
  const policy: DividendPolicyKind = pick ? policyOf(book.policies, pick.company.id) : "none";
  const cash = pick?.account ? bookCash(book, pick.account.id) : null;
  const price = pick?.company.valuation?.listing?.price ?? null;
  const already = book.dividends.some(
    (d) => d.companyId === companyId && d.sessionId === sessionId && d.status === "declared",
  );
  const problem = !pick
    ? null
    : already
      ? "un dividende est déjà annoncé sur ce titre pour cette séance"
      : perShare.trim() === ""
        ? "indiquez le dividende par titre"
        : dividendProblem(unit, {
            policy,
            shares: cost.shares,
            total: cost.total,
            available: cash?.available ?? 0,
          });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!pick || problem) return;
    if (
      !window.confirm(
        `Annoncer un dividende de ${formatPrice(unit)} ¢ par titre pour ${pick.company.name} ? ${formatInteger(cost.total)} crédits seront retenus sur son compte et versés aux détenteurs à la clôture, avant l'enchère.`,
      )
    )
      return;
    setBusy(true);
    setMessage(null);
    try {
      await source.declareDividend({
        companyId: pick.company.id,
        perShare: unit,
        note: note.trim() || null,
      });
      setPerShare("");
      setNote("");
      setMessage({ tone: "ok", text: "Dividende annoncé : il sera versé à la clôture." });
      onDone();
    } catch (err) {
      setMessage({ tone: "error", text: `Annonce refusée : ${errorText(err)}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="investor__form" onSubmit={submit}>
      <h3 className="label">Annoncer un dividende</h3>
      {candidates.length === 0 ? (
        <p className="bourse__note">
          Aucune corporation cotée n'a de compte : un dividende se paie depuis le compte KNX de la
          corporation.
        </p>
      ) : (
        <>
          <label className="field">
            <span className="label">Corporation</span>
            <select value={companyId} required onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">Choisir une corporation cotée</option>
              {candidates.map(({ company }) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Dividende par titre</span>
            <span className="investor__amount">
              <input
                inputMode="decimal"
                value={perShare}
                placeholder="0,50"
                onChange={(e) => setPerShare(e.target.value)}
              />
              <span className="investor__unit">¢</span>
            </span>
          </label>
          {pick ? (
            <p className="bourse__note">
              Politique : {DIVIDEND_POLICY_INFO[policy].label.toLowerCase()} ·{" "}
              {formatInteger(holders.length)} détenteur{holders.length > 1 ? "s" : ""},{" "}
              {formatInteger(cost.shares)} titres hors corporation · coût{" "}
              <strong>{formatInteger(cost.total)} ¢</strong> sur{" "}
              {formatInteger(cash?.available ?? 0)} ¢ disponibles
              {unit > 0 && price ? ` · ${formatShare(unit / price)} du cours KNX` : ""}.
            </p>
          ) : null}
          <label className="field">
            <span className="label">Note, publiée (facultative)</span>
            <input
              value={note}
              placeholder="Bénéfices de l'heptade, exercice…"
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          {pick && problem ? <p className="note note--warn">{problem}</p> : null}
          <button className="button" type="submit" disabled={busy || !pick || problem !== null}>
            {busy ? "Annonce…" : "Annoncer le dividende"}
          </button>
        </>
      )}
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

/** Dividends announced in the open session, the last ones paid, and the form to announce one. */
export function DividendSection({
  market,
  book,
  open,
  onDone,
}: {
  market: Market;
  book: DividendBook | null;
  open: MarketSession | null;
  onDone: () => void;
}) {
  const { source } = useData();
  const [error, setError] = useState<string | null>(null);
  const nameOf = (id: string) => market.byId.get(id)?.name ?? "corporation inconnue";
  const declared = (book?.dividends ?? []).filter((d) => d.status === "declared");
  const past = (book?.dividends ?? []).filter((d) => d.status !== "declared").slice(0, 12);

  const cancel = async (dividend: Dividend) => {
    const reason = window.prompt(
      `Retirer le dividende de ${nameOf(dividend.companyId)} ? Ses crédits seront libérés. Motif publié (facultatif) :`,
      "",
    );
    if (reason === null) return;
    setError(null);
    try {
      await source.cancelDividend(dividend.id, reason.trim() || null);
      onDone();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <section className="bourse__section" aria-labelledby="dividendes">
      <div className="section-head">
        <h2 id="dividendes">Dividendes</h2>
        <p>annoncés pendant la séance, versés à sa clôture avant l'enchère</p>
      </div>
      {error ? (
        <p className="note note--error" role="alert">
          {error}
        </p>
      ) : null}
      {!book ? (
        <p className="bourse__note">Chargement…</p>
      ) : (
        <div className="accounts__grid">
          <div className="bourse__scroll">
            {declared.length === 0 ? (
              <p className="bourse__note">Aucun dividende annoncé pour cette séance.</p>
            ) : (
              <ol className="bourse__journal">
                {declared.map((d) => (
                  <li key={d.id} className="accounts__pending">
                    <ImperialDate date={d.createdAt.slice(0, 10)} />
                    <span>
                      <strong>{nameOf(d.companyId)}</strong> · {formatPrice(d.perShare)} ¢ par titre
                      · {formatInteger(d.shares)} titres, {formatInteger(d.total)} ¢ retenus
                      {d.note ? <span className="bourse__muted"> — {d.note}</span> : null}
                    </span>
                    <span className="accounts__actions">
                      <button type="button" className="linklike" onClick={() => void cancel(d)}>
                        retirer
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {past.length > 0 ? (
              <>
                <h3 className="label">Derniers dividendes</h3>
                <ol className="bourse__journal">
                  {past.map((d) => (
                    <li key={d.id}>
                      <ImperialDate date={d.paidOn ?? d.createdAt.slice(0, 10)} />
                      <span>
                        <strong>{nameOf(d.companyId)}</strong> · {formatPrice(d.perShare)} ¢ par
                        titre · {DIVIDEND_STATUS_LABELS[d.status]}
                        {d.status === "paid"
                          ? ` · ${formatInteger(d.total)} ¢ sur ${formatInteger(d.shares)} titres`
                          : null}
                        {d.reason ? <span className="bourse__muted"> — {d.reason}</span> : null}
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            ) : null}
          </div>
          <div className="accounts__forms">
            {open ? (
              <DividendForm market={market} book={book} sessionId={open.id} onDone={onDone} />
            ) : (
              <p className="bourse__note">Ouvrez d'abord une séance.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function PolicyForm({ market, onDone }: { market: Market; onDone: () => void }) {
  const { source } = useData();
  const companies = introduced(market);
  const [companyId, setCompanyId] = useState("");
  const [decidedOn, setDecidedOn] = useState(market.latestDate);
  const [policy, setPolicy] = useState<DividendPolicyKind>("distributing");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const problem =
    policy === "other" && note.trim() === ""
      ? "décrivez la politique « autre » dans la note"
      : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!companyId || problem) return;
    setBusy(true);
    setMessage(null);
    try {
      await source.saveDividendPolicy({
        companyId,
        decidedOn,
        policy,
        note: note.trim() || null,
      });
      setNote("");
      setMessage({ tone: "ok", text: "Politique enregistrée : elle paraît sur la fiche." });
      onDone();
    } catch (err) {
      setMessage({ tone: "error", text: `Enregistrement refusé : ${errorText(err)}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="investor__form" onSubmit={submit}>
      <h3 className="label">Nouvelle politique</h3>
      <label className="field">
        <span className="label">Corporation</span>
        <select value={companyId} required onChange={(e) => setCompanyId(e.target.value)}>
          <option value="">Choisir une corporation cotée</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="accounts__row">
        <label className="field">
          <span className="label">Décidée le</span>
          <input
            type="date"
            required
            value={decidedOn}
            onChange={(e) => setDecidedOn(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="label">Politique</span>
          <select value={policy} onChange={(e) => setPolicy(e.target.value as DividendPolicyKind)}>
            {DIVIDEND_POLICIES.map((p) => (
              <option key={p} value={p}>
                {DIVIDEND_POLICY_INFO[p].label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="bourse__note">{DIVIDEND_POLICY_INFO[policy].help}</p>
      <label className="field">
        <span className="label">
          {policy === "other" ? "Description, publiée" : "Note, publiée (facultative)"}
        </span>
        <input
          value={note}
          placeholder={
            policy === "other"
              ? "Rachats de titres, dividende en nature…"
              : "Annonce de la direction…"
          }
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {companyId && problem ? <p className="note note--warn">{problem}</p> : null}
      <button className="button" type="submit" disabled={busy || !companyId || problem !== null}>
        {busy ? "Enregistrement…" : "Enregistrer la politique"}
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

/** What each corporation announced it does with its profits, and the form to record a change. */
export function PolicySection({
  market,
  book,
  onDone,
}: {
  market: Market;
  book: DividendBook | null;
  onDone: () => void;
}) {
  const { source } = useData();
  const [error, setError] = useState<string | null>(null);
  const nameOf = (id: string) => market.byId.get(id)?.name ?? "corporation inconnue";
  const history = [...(book?.policies ?? [])].sort(
    (a, b) => b.decidedOn.localeCompare(a.decidedOn) || Number(b.id) - Number(a.id),
  );

  const remove = async (policy: DividendPolicy) => {
    if (
      !window.confirm(
        `Retirer la politique « ${DIVIDEND_POLICY_INFO[policy.policy].label} » de ${nameOf(policy.companyId)} ? La précédente reprendra effet.`,
      )
    )
      return;
    setError(null);
    try {
      await source.deleteDividendPolicy(policy.id);
      onDone();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <section className="bourse__section" aria-labelledby="politiques">
      <div className="section-head">
        <h2 id="politiques">Politiques de distribution</h2>
        <p>
          la corporation choisit ; sans annonce, « aucune ». Seules « distribution » et « autre »
          permettent un dividende
        </p>
      </div>
      {error ? (
        <p className="note note--error" role="alert">
          {error}
        </p>
      ) : null}
      {!book ? (
        <p className="bourse__note">Chargement…</p>
      ) : (
        <div className="accounts__grid">
          <div className="bourse__scroll">
            {history.length === 0 ? (
              <p className="bourse__note">Aucune politique annoncée.</p>
            ) : (
              <ol className="bourse__journal">
                {history.map((p) => (
                  <li key={p.id} className="accounts__pending">
                    <ImperialDate date={p.decidedOn} />
                    <span>
                      <strong>{nameOf(p.companyId)}</strong> ·{" "}
                      {DIVIDEND_POLICY_INFO[p.policy].label}
                      {p.note ? <span className="bourse__muted"> — {p.note}</span> : null}
                    </span>
                    <span className="accounts__actions">
                      <button type="button" className="linklike" onClick={() => void remove(p)}>
                        retirer
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="accounts__forms">
            <PolicyForm market={market} onDone={onDone} />
          </div>
        </div>
      )}
    </section>
  );
}
