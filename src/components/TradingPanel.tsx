import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useData } from "../data/DataProvider.tsx";
import type { InvestorAccount } from "../domain/investors.ts";
import type { Market } from "../domain/market.ts";
import { formatInteger, formatPercent, formatPrice } from "../domain/numbers.ts";
import {
  holdings,
  lastPremiums,
  orderProblem,
  ORDER_STATUS_LABELS,
  reservationFor,
  SIDE_LABELS,
  suggestedLimit,
  tradable,
  type MarketOrder,
  type MarketSession,
  type MarketTrade,
  type OrderSide,
} from "../domain/trading.ts";
import { Change, ImperialDate } from "./figures.tsx";
import "./TradingPanel.css";

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

function OrderForm({
  market,
  account,
  sessions,
  free,
  onDone,
}: {
  market: Market;
  account: InvestorAccount;
  sessions: readonly MarketSession[];
  free: { cash: number; shares: Map<string, number> };
  onDone: () => void;
}) {
  const { source } = useData();
  const params = market.valuation.params;
  const companies = useMemo(() => tradable(market, account), [market, account]);
  const premiums = useMemo(() => lastPremiums(sessions), [sessions]);
  const [companyId, setCompanyId] = useState("");
  const [side, setSide] = useState<OrderSide>("buy");
  const [quantity, setQuantity] = useState("");
  const [limit, setLimit] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const company = companies.find((c) => c.id === companyId) ?? null;
  const reference = company?.valuation?.listing?.price ?? null;
  const suggested =
    reference !== null
      ? suggestedLimit(side, reference, premiums.get(company?.id ?? "") ?? 0, params)
      : null;
  const qty = Number(quantity);
  const lim = limit.trim() === "" ? (suggested ?? 0) : Number(limit.replace(",", "."));
  const problem = company
    ? orderProblem(
        side,
        qty,
        lim,
        { cash: free.cash, shares: free.shares.get(company.id) ?? 0 },
        params,
      )
    : null;
  const insiders = market.companies.filter(
    (c) => c.status !== "delisted" && account.insiderOf.includes(c.profileId),
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!company || problem) return;
    setBusy(true);
    setMessage(null);
    try {
      await source.placeOrder({ companyId: company.id, side, quantity: qty, limit: lim });
      setQuantity("");
      setLimit("");
      setMessage({
        tone: "ok",
        text: "Ordre enregistré : il sera servi à la clôture de la séance.",
      });
      onDone();
    } catch (err) {
      setMessage({ tone: "error", text: `Ordre refusé : ${errorText(err)}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="trading__form" onSubmit={submit}>
      <h3 className="label">Passer un ordre</h3>
      {companies.length === 0 ? (
        <p className="trading__muted">
          Aucune corporation n'est cotée pour l'instant : les ordres s'ouvrent avec la première
          introduction en bourse.
        </p>
      ) : (
        <>
          <div className="segmented" role="group" aria-label="Sens de l'ordre">
            {(["buy", "sell"] as const).map((s) => (
              <button key={s} type="button" aria-pressed={side === s} onClick={() => setSide(s)}>
                {SIDE_LABELS[s]}
              </button>
            ))}
          </div>
          <label className="field">
            <span className="label">Titre</span>
            <select value={companyId} required onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">Choisir une corporation cotée</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {formatPrice(c.valuation?.listing?.price ?? 0)} ¢
                </option>
              ))}
            </select>
          </label>
          <div className="trading__row">
            <label className="field">
              <span className="label">Titres</span>
              <input
                inputMode="numeric"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))}
              />
            </label>
            <label className="field">
              <span className="label">{side === "buy" ? "Prix maximal" : "Prix minimal"}</span>
              <span className="trading__amount">
                <input
                  inputMode="decimal"
                  value={limit}
                  placeholder={suggested !== null ? String(suggested) : ""}
                  onChange={(e) => setLimit(e.target.value)}
                />
                <span className="trading__unit">¢</span>
              </span>
            </label>
          </div>
          {company && qty > 0 && lim > 0 ? (
            <p className="trading__preview">
              {side === "buy" ? (
                <>
                  Crédits retenus jusqu'à la clôture :{" "}
                  <strong>{formatInteger(reservationFor(qty, lim, params))} ¢</strong> (commission
                  de {formatPercent(params.commission).replace("+", "")} comprise). Vous paierez le
                  prix d'achat de la séance, au plus {formatPrice(lim)} ¢ par titre.
                </>
              ) : (
                <>
                  Vous recevrez le prix de vente de la séance, au moins {formatPrice(lim)} ¢ par
                  titre, moins {formatPercent(params.commission).replace("+", "")} de commission.
                </>
              )}
            </p>
          ) : null}
          {company && problem && quantity ? <p className="note note--warn">{problem}</p> : null}
          <button className="button" type="submit" disabled={busy || !company || problem !== null}>
            {busy
              ? "Envoi…"
              : side === "buy"
                ? "Placer l'ordre d'achat"
                : "Placer l'ordre de vente"}
          </button>
        </>
      )}
      {insiders.length > 0 ? (
        <p className="trading__muted">
          Déclaré initié de {insiders.map((c) => c.name).join(", ")} : ces titres vous sont fermés.
        </p>
      ) : null}
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

/** A player's shares, orders and trades on the weekly market. */
export function TradingPanel({
  market,
  account,
  sessions,
  orders,
  trades,
  cash,
  onChange,
}: {
  market: Market;
  account: InvestorAccount;
  sessions: readonly MarketSession[];
  orders: readonly MarketOrder[];
  trades: readonly MarketTrade[];
  /** Credits free for a new buy order. */
  cash: number;
  onChange: () => void;
}) {
  const { source } = useData();
  const [error, setError] = useState<string | null>(null);
  const held = useMemo(() => holdings(trades, orders), [trades, orders]);
  const free = useMemo(
    () => ({ cash, shares: new Map(held.map((h) => [h.companyId, h.quantity - h.reserved])) }),
    [cash, held],
  );
  const open = sessions.find((s) => s.status === "open") ?? null;
  const nameOf = (id: string) => market.byId.get(id)?.name ?? "corporation inconnue";
  const slugOf = (id: string) => market.byId.get(id)?.slug ?? null;
  const pending = orders.filter((o) => o.status === "open");
  const past = orders.filter((o) => o.status !== "open").slice(0, 30);

  const cancel = async (order: MarketOrder) => {
    if (
      !window.confirm(
        `Annuler l'ordre ${SIDE_LABELS[order.side].toLowerCase()} de ${order.quantity} titres ${nameOf(order.companyId)} ?`,
      )
    )
      return;
    try {
      await source.cancelOrder(order.id);
      onChange();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <section className="trading" aria-labelledby="portefeuille">
      <div className="section-head">
        <h2 id="portefeuille">Portefeuille</h2>
        <p>
          {open ? (
            <>
              séance ouverte depuis le relevé du <ImperialDate date={open.openedOn} /> · ordres
              servis à sa clôture, une heptade plus tard
            </>
          ) : (
            "aucune séance ouverte : les ordres attendent l'ouverture par KNX"
          )}
        </p>
      </div>
      {error ? (
        <p className="note note--error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="trading__grid">
        <div className="trading__main">
          {held.length === 0 ? (
            <p className="trading__muted">Aucun titre détenu.</p>
          ) : (
            <div className="trading__scroll">
              <table className="trading__table">
                <caption className="sr-only">Titres détenus</caption>
                <thead>
                  <tr>
                    <th scope="col">Titre</th>
                    <th scope="col" className="num">
                      Titres
                    </th>
                    <th scope="col" className="num">
                      Cours KNX
                    </th>
                    <th scope="col" className="num">
                      Valeur
                    </th>
                    <th scope="col" className="num secondary">
                      Plus-value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {held.map((h) => {
                    const company = market.byId.get(h.companyId);
                    const price = company?.valuation?.listing?.price ?? null;
                    const value = price !== null ? price * h.quantity : null;
                    const gain = value !== null && h.cost > 0 ? value / h.cost - 1 : null;
                    const slug = slugOf(h.companyId);
                    return (
                      <tr key={h.companyId}>
                        <th scope="row">
                          {slug ? (
                            <Link to={`/corporations/${slug}`}>{nameOf(h.companyId)}</Link>
                          ) : (
                            nameOf(h.companyId)
                          )}
                          {h.reserved > 0 ? (
                            <span className="trading__muted"> · {h.reserved} en vente</span>
                          ) : null}
                        </th>
                        <td className="num">{formatInteger(h.quantity)}</td>
                        <td className="num">{price === null ? "—" : `${formatPrice(price)} ¢`}</td>
                        <td className="num">
                          {value === null ? (
                            "—"
                          ) : (
                            <span className="estimated">{formatInteger(value)} ¢</span>
                          )}
                        </td>
                        <td className="num secondary">
                          <Change ratio={gain} estimated />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <h3 className="label trading__h3">Ordres en attente</h3>
          {pending.length === 0 ? (
            <p className="trading__muted">Aucun ordre en attente.</p>
          ) : (
            <ol className="trading__orders">
              {pending.map((o) => (
                <li key={o.id}>
                  <span>
                    <strong>{SIDE_LABELS[o.side]}</strong> {formatInteger(o.quantity)} ×{" "}
                    {nameOf(o.companyId)} · {o.side === "buy" ? "au plus" : "au moins"}{" "}
                    {formatPrice(o.limitPrice)} ¢
                    {o.side === "buy" ? (
                      <span className="trading__muted">
                        {" "}
                        · {formatInteger(o.reserved)} ¢ retenus
                      </span>
                    ) : null}
                  </span>
                  <button type="button" className="linklike" onClick={() => void cancel(o)}>
                    annuler
                  </button>
                </li>
              ))}
            </ol>
          )}

          <h3 className="label trading__h3">Historique</h3>
          {past.length === 0 ? (
            <p className="trading__muted">Aucun ordre traité.</p>
          ) : (
            <ol className="trading__orders">
              {past.map((o) => (
                <li key={o.id}>
                  <ImperialDate date={(o.closedAt ?? o.createdAt).slice(0, 10)} />
                  <span>
                    <strong>{SIDE_LABELS[o.side]}</strong> {formatInteger(o.quantity)} ×{" "}
                    {nameOf(o.companyId)} · {ORDER_STATUS_LABELS[o.status]}
                    {o.filledQuantity > 0 && o.fillPrice !== null
                      ? ` · ${formatInteger(o.filledQuantity)} à ${formatPrice(o.fillPrice)} ¢`
                      : null}
                    {o.reason ? <span className="trading__muted"> — {o.reason}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <OrderForm
          market={market}
          account={account}
          sessions={sessions}
          free={free}
          onDone={onChange}
        />
      </div>
    </section>
  );
}
