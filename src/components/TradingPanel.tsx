import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useData } from "../data/DataProvider.tsx";
import type { InvestorAccount } from "../domain/investors.ts";
import type { Market } from "../domain/market.ts";
import { formatInteger, formatPercent, formatPrice } from "../domain/numbers.ts";
import {
  holdings,
  orderProblem,
  ORDER_STATUS_LABELS,
  reservationFor,
  SIDE_LABELS,
  suggestedLimit,
  tradable,
  carryFee,
  MAX_SESSIONS,
  type MarketOffer,
  type MarketOrder,
  type MarketSession,
  type MarketTrade,
  type OrderSide,
  type ShareIssue,
} from "../domain/trading.ts";
import { Change, ImperialDate } from "./figures.tsx";
import "./TradingPanel.css";

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

function OrderForm({
  market,
  account,
  free,
  onDone,
}: {
  market: Market;
  account: InvestorAccount;
  free: { cash: number; shares: Map<string, number> };
  onDone: () => void;
}) {
  const { source } = useData();
  const params = market.valuation.params;
  const companies = useMemo(() => tradable(market, account), [market, account]);
  const [companyId, setCompanyId] = useState("");
  const [side, setSide] = useState<OrderSide>("buy");
  const [quantity, setQuantity] = useState("");
  const [limit, setLimit] = useState("");
  const [life, setLife] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const company = companies.find((c) => c.id === companyId) ?? null;
  const reference = company?.valuation?.listing?.price ?? null;
  const suggested = reference !== null ? suggestedLimit(side, reference) : null;
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
      await source.placeOrder({
        companyId: company.id,
        side,
        quantity: qty,
        limit: lim,
        sessions: life,
      });
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
          <label className="field">
            <span className="label">Validité</span>
            <select value={life} onChange={(e) => setLife(Number(e.target.value))}>
              {Array.from({ length: MAX_SESSIONS }, (_, k) => k + 1).map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "Cette séance seulement" : `${n} séances`}
                </option>
              ))}
            </select>
          </label>
          {company && qty > 0 && lim > 0 ? (
            <p className="trading__preview">
              {side === "buy" ? (
                <>
                  Crédits retenus jusqu'à la clôture :{" "}
                  <strong>{formatInteger(reservationFor(qty, lim, params))} ¢</strong> (commission
                  de {formatPercent(params.commission).replace("+", "")} comprise). Vous paierez le
                  prix de l'enchère de la séance, au plus {formatPrice(lim)} ¢ par titre, si un
                  vendeur vous rencontre.
                </>
              ) : (
                <>
                  Vous recevrez le prix de l'enchère de la séance, au moins {formatPrice(lim)} ¢ par
                  titre, moins {formatPercent(params.commission).replace("+", "")} de commission, si
                  un acheteur vous rencontre.
                </>
              )}
              {life > 1 ? (
                <>
                  {" "}
                  Non servi, l'ordre passe à la séance suivante contre{" "}
                  {formatInteger(carryFee(qty, lim, params))} ¢ de frais de report, jusqu'à {life}{" "}
                  séances.
                </>
              ) : null}
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

/** A corporation's own account: its shares and its offers. It sells through offers only. */
export function CorporatePanel({
  market,
  account,
  offers,
  trades,
  issues,
}: {
  market: Market;
  account: InvestorAccount;
  offers: readonly MarketOffer[];
  trades: readonly MarketTrade[];
  issues: readonly ShareIssue[];
}) {
  const company = market.companies.find((c) => c.profileId === account.companyProfileId) ?? null;
  const held = holdings(trades, [], issues).find((h) => h.companyId === company?.id);
  const own = offers.filter((o) => o.accountId === account.id);
  return (
    <section className="trading" aria-labelledby="corporation">
      <div className="section-head">
        <h2 id="corporation">{company ? company.name : "Corporation"}</h2>
        <p>
          compte de corporation : les titres se vendent par des offres, ouvertes par KNX à la
          demande du DG
        </p>
      </div>
      <dl className="investor__facts">
        <div>
          <dt className="label">Titres détenus</dt>
          <dd className="investor__figure">{formatInteger(held?.quantity ?? 0)}</dd>
          <dd className="investor__detail">
            sur {formatInteger(company?.valuation?.listing?.shares ?? 0)} ; reçus à la première
            offre
          </dd>
        </div>
        <div>
          <dt className="label">Levé par les offres</dt>
          <dd className="investor__figure">
            {formatInteger(own.reduce((sum, o) => sum + o.proceeds, 0))}
            <span className="amount__unit"> ¢</span>
          </dd>
          <dd className="investor__detail">commission déduite</dd>
        </div>
      </dl>
      {own.length === 0 ? (
        <p className="trading__muted">Aucune offre pour l'instant.</p>
      ) : (
        <ol className="trading__orders">
          {own.map((o) => (
            <li key={o.id}>
              <ImperialDate date={o.createdAt.slice(0, 10)} />
              <span>
                {formatInteger(o.sharesOffered)} titres à {formatPrice(o.price)} ¢ ·{" "}
                {o.status === "open"
                  ? "en souscription"
                  : o.status === "cancelled"
                    ? "retirée"
                    : `${formatInteger(o.allocated)} vendus, ${formatInteger(o.proceeds)} ¢ levés`}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Open offers of the corporations: the investor subscribes at the offer's price. */
function Offers({
  market,
  account,
  offers,
  cash,
  onDone,
}: {
  market: Market;
  account: InvestorAccount;
  offers: readonly MarketOffer[];
  cash: number;
  onDone: () => void;
}) {
  const { source } = useData();
  const params = market.valuation.params;
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const open = offers.filter((o) => o.status === "open");
  if (open.length === 0) return null;

  const subscribe = async (offer: MarketOffer, quantity: number) => {
    setMessage(null);
    try {
      await source.subscribe(offer.id, quantity);
      setAmounts((a) => ({ ...a, [offer.id]: "" }));
      setMessage({
        tone: "ok",
        text: "Souscription enregistrée : servie à la clôture de la séance.",
      });
      onDone();
    } catch (err) {
      setMessage({ tone: "error", text: `Souscription refusée : ${errorText(err)}` });
    }
  };

  return (
    <div className="trading__offers">
      <h3 className="label">Offres ouvertes</h3>
      <ol className="trading__orders">
        {open.map((o) => {
          const company = market.byId.get(o.companyId);
          const insider = company ? account.insiderOf.includes(company.profileId) : false;
          const qty = Number(amounts[o.id] ?? "");
          const cost = qty > 0 ? reservationFor(qty, o.price, params) : 0;
          return (
            <li key={o.id}>
              <span>
                <strong>{company?.name ?? "corporation inconnue"}</strong> vend{" "}
                {formatInteger(o.sharesOffered)} titres à {formatPrice(o.price)} ¢
                {company?.valuation?.listing?.price != null ? (
                  <span className="trading__muted">
                    {" "}
                    · cours KNX {formatPrice(company.valuation.listing.price)} ¢
                  </span>
                ) : null}
                {o.note ? <span className="trading__muted"> — {o.note}</span> : null}
              </span>
              {insider ? (
                <span className="trading__muted">fermé aux initiés</span>
              ) : (
                <span className="trading__subscribe">
                  <input
                    className="input"
                    inputMode="numeric"
                    aria-label={`Titres souscrits à l'offre de ${company?.name ?? ""}`}
                    placeholder="titres"
                    value={amounts[o.id] ?? ""}
                    onChange={(e) =>
                      setAmounts((a) => ({ ...a, [o.id]: e.target.value.replace(/\D/g, "") }))
                    }
                  />
                  <button
                    type="button"
                    className="button button--quiet"
                    disabled={!(qty > 0) || qty > o.sharesOffered || cost > cash}
                    onClick={() => void subscribe(o, qty)}
                  >
                    Souscrire{qty > 0 ? ` · ${formatInteger(cost)} ¢` : ""}
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="trading__muted">
        Chaque souscription retient son montant, commission comprise. À la clôture, chacun est servi
        en entier, ou au prorata si l'offre est dépassée ; le reste des crédits est libéré.
      </p>
      {message ? (
        <p
          className={`note note--${message.tone}`}
          role={message.tone === "error" ? "alert" : undefined}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}

/** A player's shares, orders and trades on the weekly market. */
export function TradingPanel({
  market,
  account,
  sessions,
  orders,
  trades,
  offers,
  issues,
  cash,
  onChange,
}: {
  market: Market;
  account: InvestorAccount;
  sessions: readonly MarketSession[];
  orders: readonly MarketOrder[];
  trades: readonly MarketTrade[];
  offers: readonly MarketOffer[];
  issues: readonly ShareIssue[];
  /** Credits free for a new buy order. */
  cash: number;
  onChange: () => void;
}) {
  const { source } = useData();
  const [error, setError] = useState<string | null>(null);
  const held = useMemo(() => holdings(trades, orders, issues), [trades, orders, issues]);
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
                    <strong>{o.offerId ? "Souscription" : SIDE_LABELS[o.side]}</strong>{" "}
                    {formatInteger(o.quantity)} × {nameOf(o.companyId)} ·{" "}
                    {o.side === "buy" ? "au plus" : "au moins"} {formatPrice(o.limitPrice)} ¢
                    {o.side === "buy" ? (
                      <span className="trading__muted">
                        {" "}
                        · {formatInteger(o.reserved)} ¢ retenus
                      </span>
                    ) : null}
                    {o.sessionsLeft > 1 ? (
                      <span className="trading__muted"> · encore {o.sessionsLeft} séances</span>
                    ) : null}
                    {o.feesPaid > 0 ? (
                      <span className="trading__muted">
                        {" "}
                        · reports {formatInteger(o.feesPaid)} ¢
                      </span>
                    ) : null}
                    {o.reason ? <span className="trading__muted"> — {o.reason}</span> : null}
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
                    <strong>{o.offerId ? "Souscription" : SIDE_LABELS[o.side]}</strong>{" "}
                    {formatInteger(o.quantity)} × {nameOf(o.companyId)} ·{" "}
                    {ORDER_STATUS_LABELS[o.status]}
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
        <div className="trading__side">
          <Offers market={market} account={account} offers={offers} cash={cash} onDone={onChange} />
          <OrderForm market={market} account={account} free={free} onDone={onChange} />
        </div>
      </div>
    </section>
  );
}
