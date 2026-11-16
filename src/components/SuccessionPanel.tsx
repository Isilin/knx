import { useState, type FormEvent } from "react";
import { useData } from "../data/DataProvider.tsx";
import {
  FREEZE_INFO,
  parseCredits,
  type CashMovement,
  type FreezeReason,
  type InvestorAccount,
} from "../domain/investors.ts";
import type { Market } from "../domain/market.ts";
import { formatInteger, formatPrice } from "../domain/numbers.ts";
import {
  accountCash,
  holdings,
  MAX_SESSIONS,
  suggestedLimit,
  TRANSFER_REASON_INFO,
  transferProblem,
  tradeAmounts,
  type AccountTransfer,
  type Dividend,
  type DividendPayment,
  type MarketOrder,
  type MarketTrade,
  type ShareIssue,
  type TransferReason,
} from "../domain/trading.ts";
import { ImperialDate } from "./figures.tsx";

/** What the operator reads to settle a frozen account: every account's books. */
export interface SuccessionBook {
  accounts: InvestorAccount[];
  movements: CashMovement[];
  orders: MarketOrder[];
  trades: MarketTrade[];
  issues: ShareIssue[];
  payments: DividendPayment[];
  dividends: Dividend[];
  transfers: AccountTransfer[];
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

function cashOf(book: SuccessionBook, accountId: string) {
  return accountCash(
    book.movements.filter((m) => m.accountId === accountId),
    book.trades.filter((t) => t.accountId === accountId),
    book.orders.filter((o) => o.accountId === accountId),
    book.payments.filter((p) => p.accountId === accountId),
    book.dividends.filter((d) => d.accountId === accountId),
  );
}

type Mode = "transfer" | "sell" | "buyback" | "end";

const MODES: { id: Mode; label: string }[] = [
  { id: "transfer", label: "Transmettre" },
  { id: "sell", label: "Vendre au marché" },
  { id: "buyback", label: "Rachat" },
  { id: "end", label: "Lever ou clôturer" },
];

/** Freezes an account: a succession, or a seizure by the DAI. */
export function FreezeForm({
  account,
  onDone,
}: {
  account: InvestorAccount;
  onDone: (saved: boolean) => void;
}) {
  const { source } = useData();
  const [reason, setReason] = useState<FreezeReason>("succession");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !window.confirm(
        `Geler le compte ${account.login} (${account.displayName}) ? Ses ordres, souscriptions et demandes de retrait seront annulés${account.companyProfileId ? ", ainsi que les offres et dividendes annoncés de la corporation" : ""}.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await source.freezeAccount(account.id, reason, note.trim() || null);
      onDone(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="accounts__insiders" onSubmit={submit}>
      <div className="accounts__row">
        <label className="field">
          <span className="label">Motif</span>
          <select value={reason} onChange={(e) => setReason(e.target.value as FreezeReason)}>
            {(Object.keys(FREEZE_INFO) as FreezeReason[]).map((r) => (
              <option key={r} value={r}>
                {FREEZE_INFO[r].label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Note, visible du titulaire</span>
          <input
            value={note}
            placeholder={reason === "succession" ? "Mort au Secteur 4…" : "Enquête n°…"}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </div>
      <p className="bourse__note">{FREEZE_INFO[reason].help}</p>
      {error ? (
        <p className="note note--error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="accounts__actions">
        <button className="button" type="submit" disabled={busy}>
          {busy ? "Gel…" : "Geler le compte"}
        </button>
        <button type="button" className="linklike" onClick={() => onDone(false)}>
          annuler
        </button>
      </div>
    </form>
  );
}

/**
 * How a frozen account is settled, case by case: transmissions to heirs or to the Empire, a sale
 * at the next sessions, a buyback by the corporation, then the freeze lifted or the account closed.
 */
export function SuccessionPanel({
  market,
  account,
  book,
  onDone,
}: {
  market: Market;
  account: InvestorAccount;
  book: SuccessionBook;
  onDone: () => void;
}) {
  const { source } = useData();
  const params = market.valuation.params;
  const [mode, setMode] = useState<Mode>("transfer");
  const [companyId, setCompanyId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [credits, setCredits] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [reason, setReason] = useState<TransferReason>("succession");
  const [price, setPrice] = useState("");
  const [sessions, setSessions] = useState(MAX_SESSIONS);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const own = (rows: { accountId: string }[]) => rows.filter((r) => r.accountId === account.id);
  const held = holdings(
    own(book.trades) as MarketTrade[],
    own(book.orders) as MarketOrder[],
    own(book.issues) as ShareIssue[],
  );
  const cash = cashOf(book, account.id);
  const position = held.find((h) => h.companyId === companyId) ?? null;
  const company = market.byId.get(companyId) ?? null;
  const reference = company?.valuation?.listing?.price ?? null;
  const freeShares = position ? position.quantity - position.reserved : 0;
  const qty = quantity.trim() === "" ? null : Number(quantity);
  const amount = credits.trim() === "" ? null : parseCredits(credits);
  const unit =
    price.trim() === ""
      ? mode === "sell"
        ? reference !== null
          ? suggestedLimit("sell", reference)
          : 0
        : (reference ?? 0)
      : Number(price.replace(",", "."));
  const heirs = book.accounts.filter(
    (a) => a.id !== account.id && !a.closedAt && !a.frozen && a.companyProfileId === null,
  );
  const corporation = company
    ? book.accounts.find((a) => a.companyProfileId === company.profileId && !a.closedAt)
    : undefined;
  const corporationCash = corporation ? cashOf(book, corporation.id) : null;
  const buyback = qty !== null && qty > 0 ? tradeAmounts(qty, unit, params) : null;
  const empty = held.every((h) => h.quantity === 0) && cash.balance === 0 && cash.pending === 0;
  const nameOf = (id: string) => {
    const a = book.accounts.find((x) => x.id === id);
    return a ? `${a.login} · ${a.displayName}` : "?";
  };
  const journal = book.transfers.filter(
    (t) => t.fromAccount === account.id || t.toAccount === account.id,
  );

  const problem = (() => {
    if (mode === "transfer") {
      if (credits.trim() !== "" && amount === null) return "montant de crédits invalide";
      return transferProblem(
        { toAccount: toAccount || null, quantity: companyId ? qty : null, amount },
        { shares: freeShares, cash: cash.available },
      );
    }
    if (mode === "end") return null;
    if (!companyId) return "choisissez une corporation";
    if (qty === null || !Number.isInteger(qty) || qty < 1)
      return "nombre de titres entier, d'au moins 1";
    if (qty > freeShares) return `le compte gelé n'a que ${freeShares} titres libres`;
    if (!(unit > 0) || Math.round(unit * 100) / 100 !== unit)
      return "prix positif, au centième près";
    if (mode === "sell" && company?.valuation?.listing?.state !== "listed")
      return "ce titre n'est pas coté, ou sa cotation est suspendue";
    if (mode === "buyback") {
      if (!corporation) return "cette corporation n'a pas de compte KNX";
      if (corporation.frozen) return "le compte de cette corporation est gelé";
      const cost = (buyback?.amount ?? 0) + (buyback?.commission ?? 0);
      if (cost > (corporationCash?.available ?? 0))
        return `ce rachat coûte ${formatInteger(cost)} ¢ ; la corporation n'en a que ${formatInteger(corporationCash?.available ?? 0)} de disponibles`;
    }
    return null;
  })();

  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setQuantity("");
      setCredits("");
      setPrice("");
      setNote("");
      setMessage({ tone: "ok", text: done });
      onDone();
    } catch (err) {
      setMessage({ tone: "error", text: `Refusé : ${errorText(err)}` });
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (problem) return;
    if (mode === "transfer") {
      const what = [
        companyId && qty ? `${formatInteger(qty)} titres ${company?.name ?? ""}` : null,
        amount ? `${formatInteger(amount)} ¢` : null,
      ]
        .filter(Boolean)
        .join(" et ");
      if (!window.confirm(`Transmettre ${what} à ${nameOf(toAccount)} ? C'est définitif.`)) return;
      void run(
        () =>
          source.transferHoldings({
            fromAccount: account.id,
            toAccount,
            companyId: companyId && qty ? companyId : null,
            quantity: companyId && qty ? qty : null,
            amount: amount || null,
            reason,
            note: note.trim() || null,
          }),
        "Transmission inscrite.",
      );
    } else if (mode === "sell" && qty) {
      void run(
        () =>
          source.sellForAccount({
            accountId: account.id,
            companyId,
            quantity: qty,
            limit: unit,
            sessions,
          }),
        "Ordre de vente placé : servi à la clôture de la séance.",
      );
    } else if (mode === "buyback" && qty) {
      if (
        !window.confirm(
          `${company?.name ?? "La corporation"} rachète ${formatInteger(qty)} titres à ${formatPrice(unit)} ¢ (${formatInteger((buyback?.amount ?? 0) + (buyback?.commission ?? 0))} ¢ commission comprise) ? C'est définitif.`,
        )
      )
        return;
      void run(
        () =>
          source.buybackShares({ accountId: account.id, companyId, quantity: qty, price: unit }),
        "Rachat inscrit.",
      );
    }
  };

  const lift = () => {
    if (
      !window.confirm(`Lever le gel du compte ${account.login} ? Son titulaire retrouve la main.`)
    )
      return;
    void run(() => source.unfreezeAccount(account.id, note.trim() || null), "Gel levé.");
  };
  const close = () => {
    if (!window.confirm(`Clôturer le compte ${account.login} ? Il ne servira plus.`)) return;
    void run(() => source.closeAccount(account.id, note.trim() || null), "Compte clôturé.");
  };

  return (
    <div className="succession">
      <p className="bourse__note">
        <strong>{account.frozen ? FREEZE_INFO[account.frozen.reason].label : "Gel"}</strong>
        {account.frozen ? (
          <>
            {" "}
            depuis le <ImperialDate date={account.frozen.since.slice(0, 10)} />
            {account.frozen.note ? ` — ${account.frozen.note}` : ""}
          </>
        ) : null}
        . Disponible : <strong>{formatInteger(cash.available)} ¢</strong>
        {cash.balance !== cash.available ? ` sur ${formatInteger(cash.balance)} ¢` : ""}. Les
        dividendes continuent d'arriver.
      </p>
      <div className="succession__grid">
        <div>
          <h4 className="label">Titres</h4>
          {held.length === 0 ? (
            <p className="bourse__note">Aucun titre.</p>
          ) : (
            <ul className="succession__holdings">
              {held.map((h) => {
                const c = market.byId.get(h.companyId);
                const p = c?.valuation?.listing?.price ?? null;
                return (
                  <li key={h.companyId}>
                    <strong>{c?.name ?? "corporation inconnue"}</strong> ·{" "}
                    {formatInteger(h.quantity)} titres
                    {h.reserved > 0 ? ` (${formatInteger(h.reserved)} en vente)` : ""}
                    {p !== null ? (
                      <span className="bourse__muted">
                        {" "}
                        · {formatInteger(p * h.quantity)} ¢ au cours KNX
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          {journal.length > 0 ? (
            <>
              <h4 className="label">Transmissions</h4>
              <ol className="succession__holdings">
                {journal.map((t) => (
                  <li key={t.id}>
                    <ImperialDate date={t.createdAt.slice(0, 10)} /> ·{" "}
                    {TRANSFER_REASON_INFO[t.reason].label.toLowerCase()} à {nameOf(t.toAccount)} ·{" "}
                    {[
                      t.quantity
                        ? `${formatInteger(t.quantity)} titres ${market.byId.get(t.companyId ?? "")?.name ?? ""}`
                        : null,
                      t.amount ? `${formatInteger(t.amount)} ¢` : null,
                    ]
                      .filter(Boolean)
                      .join(" et ")}
                    {t.note ? <span className="bourse__muted"> — {t.note}</span> : null}
                  </li>
                ))}
              </ol>
            </>
          ) : null}
        </div>
        <form className="investor__form" onSubmit={submit}>
          <div className="segmented" role="group" aria-label="Dénouement">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={mode === m.id}
                onClick={() => {
                  setMode(m.id);
                  setMessage(null);
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode === "transfer" ? (
            <div className="accounts__row">
              <label className="field">
                <span className="label">Motif</span>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as TransferReason)}
                >
                  {(Object.keys(TRANSFER_REASON_INFO) as TransferReason[]).map((r) => (
                    <option key={r} value={r}>
                      {TRANSFER_REASON_INFO[r].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Compte qui reçoit</span>
                <select value={toAccount} onChange={(e) => setToAccount(e.target.value)}>
                  <option value="">Choisir un compte</option>
                  {heirs.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.login} · {a.displayName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {mode !== "end" ? (
            <div className="accounts__row">
              <label className="field">
                <span className="label">Corporation</span>
                <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                  <option value="">{mode === "transfer" ? "Aucun titre" : "Choisir"}</option>
                  {held
                    .filter((h) => h.quantity > 0)
                    .map((h) => (
                      <option key={h.companyId} value={h.companyId}>
                        {market.byId.get(h.companyId)?.name ?? "corporation inconnue"}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Titres</span>
                <input
                  inputMode="numeric"
                  value={quantity}
                  disabled={!companyId}
                  placeholder={companyId ? String(freeShares) : ""}
                  onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))}
                />
              </label>
            </div>
          ) : null}

          {mode === "transfer" ? (
            <label className="field">
              <span className="label">Crédits</span>
              <span className="investor__amount">
                <input
                  inputMode="numeric"
                  value={credits}
                  placeholder={String(cash.available)}
                  onChange={(e) => setCredits(e.target.value)}
                />
                <span className="investor__unit">¢</span>
              </span>
            </label>
          ) : null}

          {mode === "sell" || mode === "buyback" ? (
            <div className="accounts__row">
              <label className="field">
                <span className="label">{mode === "sell" ? "Prix limite" : "Prix par titre"}</span>
                <span className="investor__amount">
                  <input
                    inputMode="decimal"
                    value={price}
                    placeholder={unit > 0 ? String(unit) : ""}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                  <span className="investor__unit">¢</span>
                </span>
              </label>
              {mode === "sell" ? (
                <label className="field">
                  <span className="label">Validité</span>
                  <select value={sessions} onChange={(e) => setSessions(Number(e.target.value))}>
                    {Array.from({ length: MAX_SESSIONS }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n} séance{n > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="bourse__note">
                  {reference !== null ? `Cours KNX ${formatPrice(reference)} ¢. ` : ""}
                  {corporation
                    ? `La corporation dispose de ${formatInteger(corporationCash?.available ?? 0)} ¢.`
                    : companyId
                      ? "Pas de compte de corporation."
                      : ""}
                </p>
              )}
            </div>
          ) : null}

          {mode === "transfer" || mode === "end" ? (
            <label className="field">
              <span className="label">
                {mode === "end" ? "Issue, notée au journal du gel" : "Note (facultative)"}
              </span>
              <input
                value={note}
                placeholder={mode === "end" ? "Succession réglée, enquête close…" : "Testament…"}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          ) : null}

          {mode === "transfer" ? (
            <p className="bourse__note">{TRANSFER_REASON_INFO[reason].help}</p>
          ) : mode === "sell" ? (
            <p className="bourse__note">
              Un ordre de vente ordinaire, servi à la clôture par l'enchère ; son titulaire ne peut
              pas l'annuler. Le produit reste sur le compte gelé.
            </p>
          ) : mode === "buyback" ? (
            <p className="bourse__note">
              La corporation reprend ses titres au prix décidé, payé depuis son compte KNX,
              commission comprise des deux côtés ; le produit reste sur le compte gelé.
            </p>
          ) : (
            <p className="bourse__note">
              Lever le gel rend la main au titulaire (enquête close, erreur). Un compte vide — ni
              titre, ni crédit, ni ordre — peut être clôturé : la succession est réglée.
            </p>
          )}

          {problem && mode !== "end" && (companyId || toAccount || quantity || credits) ? (
            <p className="note note--warn">{problem}</p>
          ) : null}

          {mode === "end" ? (
            <div className="accounts__actions">
              <button type="button" className="button" disabled={busy} onClick={lift}>
                Lever le gel
              </button>
              <button
                type="button"
                className="button button--quiet"
                disabled={busy || !empty}
                onClick={close}
              >
                Clôturer le compte
              </button>
              {!empty ? <span className="bourse__muted">le compte n'est pas vide</span> : null}
            </div>
          ) : (
            <button className="button" type="submit" disabled={busy || problem !== null}>
              {busy
                ? "Enregistrement…"
                : mode === "transfer"
                  ? "Transmettre"
                  : mode === "sell"
                    ? "Placer l'ordre de vente"
                    : "Inscrire le rachat"}
            </button>
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
      </div>
    </div>
  );
}
