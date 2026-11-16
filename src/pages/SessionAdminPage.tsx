import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router";
import {
  DividendSection,
  PolicySection,
  type DividendBook,
} from "../components/DividendsAdmin.tsx";
import { ImperialDate } from "../components/figures.tsx";
import { useData } from "../data/DataProvider.tsx";
import { daysBetween } from "../domain/dates.ts";
import type { CompanySeries, Market } from "../domain/market.ts";
import { formatInteger, formatPercent, formatPrice, formatShare } from "../domain/numbers.ts";
import {
  allocateOffer,
  clearingPrice,
  holdings,
  OFFER_KIND_INFO,
  offerProblem,
  type MarketOffer,
  type MarketOrder,
  type OfferKind,
} from "../domain/trading.ts";
import { SignIn } from "./ReportsPage.tsx";
import "./BoursePage.css";
import "./AccountsAdminPage.css";
import "./InvestorPage.css";

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

interface Book extends DividendBook {
  offers: MarketOffer[];
}

/** Listed corporations with a KNX price: what the close reads to break ties. */
function listed(market: Market): CompanySeries[] {
  return market.companies.filter(
    (c) =>
      c.status !== "delisted" &&
      c.valuation?.listing?.state === "listed" &&
      c.valuation.listing.price !== null,
  );
}

function OfferForm({ market, book, onDone }: { market: Market; book: Book; onDone: () => void }) {
  const { source } = useData();
  const params = market.valuation.params;
  // Listed corporations that have their own account.
  const candidates = useMemo(
    () =>
      listed(market)
        .map((c) => ({
          company: c,
          account: book.accounts.find((a) => a.companyProfileId === c.profileId && !a.closedAt),
        }))
        .filter((x) => x.account)
        .sort((a, b) => a.company.name.localeCompare(b.company.name, "fr")),
    [market, book.accounts],
  );
  const [companyId, setCompanyId] = useState("");
  const [kind, setKind] = useState<OfferKind>("sale");
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const pick = candidates.find((x) => x.company.id === companyId) ?? null;
  const total = pick?.company.valuation?.listing?.shares ?? 0;
  const reference = pick?.company.valuation?.listing?.price ?? null;
  const endowed = book.issues.some((i) => i.companyId === companyId);
  const held = pick?.account
    ? (holdings(
        book.trades.filter((t) => t.accountId === pick.account?.id),
        [],
        book.issues.filter((i) => i.accountId === pick.account?.id),
      ).find((h) => h.companyId === companyId)?.quantity ?? 0)
    : 0;
  const offered = book.offers
    .filter((o) => o.companyId === companyId && o.status === "open" && o.kind === "sale")
    .reduce((sum, o) => sum + o.sharesOffered, 0);
  const issuing = book.offers.some(
    (o) => o.companyId === companyId && o.status === "open" && o.kind === "issue",
  );
  // Before its first offer, the corporation receives all its shares.
  const free = (endowed ? held : total) - offered;
  const most = Math.floor(params.maxOffer * total);
  const suggested = Math.max(0, kind === "sale" ? Math.min(most, free) : most);
  const qty = Number(shares || suggested);
  const unit = price.trim() === "" ? (reference ?? 0) : Number(price.replace(",", "."));
  const roundedUnit = Math.round(unit * 100) / 100;
  const problem = !pick
    ? null
    : kind === "issue" && issuing
      ? "une offre d'émission est déjà ouverte sur ce titre"
      : offerProblem(
          qty,
          roundedUnit,
          { kind, totalShares: total, freeShares: free, reference },
          params,
        );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!pick || problem) return;
    if (
      !window.confirm(
        kind === "issue"
          ? `Ouvrir l'émission de ${formatInteger(qty)} titres nouveaux ${pick.company.name} à ${formatPrice(roundedUnit)} ¢ ? À la clôture, les titres souscrits seront créés (augmentation de capital) : les détenteurs actuels seront dilués.`
          : `Ouvrir l'offre de ${formatInteger(qty)} titres ${pick.company.name} à ${formatPrice(roundedUnit)} ¢ ? Les souscriptions seront servies à la clôture de la séance.`,
      )
    )
      return;
    setBusy(true);
    setMessage(null);
    try {
      await source.createOffer({
        companyId: pick.company.id,
        kind,
        shares: qty,
        price: roundedUnit,
        note: note.trim() || null,
      });
      setShares("");
      setPrice("");
      setNote("");
      setMessage({ tone: "ok", text: "Offre ouverte : les investisseurs peuvent souscrire." });
      onDone();
    } catch (err) {
      setMessage({ tone: "error", text: `Offre refusée : ${errorText(err)}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="investor__form" onSubmit={submit}>
      <h3 className="label">Nouvelle offre</h3>
      {candidates.length === 0 ? (
        <p className="bourse__note">
          Aucune corporation cotée n'a de compte. Introduisez-la (Réglages), puis créez son compte
          de corporation (Comptes) : son DG pourra alors vendre une partie de ses titres.
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
            <span className="label">Nature de l'offre</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as OfferKind)}>
              {(Object.keys(OFFER_KIND_INFO) as OfferKind[]).map((k) => (
                <option key={k} value={k}>
                  {OFFER_KIND_INFO[k].label}
                </option>
              ))}
            </select>
          </label>
          <p className="bourse__note">{OFFER_KIND_INFO[kind].help}</p>
          <div className="accounts__row">
            <label className="field">
              <span className="label">{kind === "issue" ? "Titres émis" : "Titres offerts"}</span>
              <input
                inputMode="numeric"
                value={shares}
                placeholder={pick ? String(suggested) : ""}
                onChange={(e) => setShares(e.target.value.replace(/\D/g, ""))}
              />
            </label>
            <label className="field">
              <span className="label">Prix par titre</span>
              <span className="investor__amount">
                <input
                  inputMode="decimal"
                  value={price}
                  placeholder={reference !== null ? String(reference) : ""}
                  onChange={(e) => setPrice(e.target.value)}
                />
                <span className="investor__unit">¢</span>
              </span>
            </label>
          </div>
          {pick ? (
            <p className="bourse__note">
              {formatInteger(total)} titres au total
              {kind === "sale" ? `, ${formatInteger(Math.max(0, free))} libres` : ""}
              {endowed ? "" : " (la corporation les reçoit à sa première offre)"} · cours KNX{" "}
              {reference !== null ? `${formatPrice(reference)} ¢` : "—"} · offre de{" "}
              {formatShare(params.maxOffer)} des titres au plus, à ± {formatShare(params.offerBand)}{" "}
              du cours KNX.
            </p>
          ) : null}
          <label className="field">
            <span className="label">Note, publiée (facultative)</span>
            <input
              value={note}
              placeholder="Introduction, financement d'un projet…"
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          {pick && problem ? <p className="note note--warn">{problem}</p> : null}
          <button className="button" type="submit" disabled={busy || !pick || problem !== null}>
            {busy ? "Ouverture…" : "Ouvrir l'offre"}
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

function SessionAdmin({ market }: { market: Market }) {
  const { source } = useData();
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    Promise.all([
      source.marketSessions(),
      source.marketOrders(),
      source.marketTrades(),
      source.marketOffers(),
      source.shareIssues(),
      source.investorAccounts(),
      source.cashMovements(),
      source.dividendPolicies(),
      source.dividends(),
      source.dividendPayments(),
    ]).then(
      ([
        sessions,
        orders,
        trades,
        offers,
        issues,
        accounts,
        movements,
        policies,
        dividends,
        payments,
      ]) =>
        setBook({
          sessions,
          orders,
          trades,
          offers,
          issues,
          accounts,
          movements,
          policies,
          dividends,
          payments,
        }),
      (err: unknown) => setError(errorText(err)),
    );
  }, [source]);
  useEffect(refresh, [refresh]);

  const params = market.valuation.params;
  const open = book?.sessions.find((s) => s.status === "open") ?? null;
  const pending = useMemo(
    () =>
      book && open ? book.orders.filter((o) => o.sessionId === open.id && o.status === "open") : [],
    [book, open],
  );
  const openOffers = (book?.offers ?? []).filter((o) => o.status === "open");
  const auctions = useMemo(() => {
    const byCompany = new Map<string, MarketOrder[]>();
    for (const o of pending)
      if (o.offerId === null)
        byCompany.set(o.companyId, [...(byCompany.get(o.companyId) ?? []), o]);
    return [...byCompany.entries()].map(([companyId, orders]) => ({
      companyId,
      orders,
      clearing: clearingPrice(
        orders,
        market.byId.get(companyId)?.valuation?.listing?.price ?? null,
      ),
    }));
  }, [pending, market]);
  const commissions = (book?.trades ?? []).reduce((sum, t) => sum + t.commission, 0);
  const closed = (book?.sessions ?? []).filter((s) => s.status === "closed");
  const nameOf = (id: string) => market.byId.get(id)?.name ?? "corporation inconnue";
  const age = open ? daysBetween(open.openedOn, market.latestDate) : 0;

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await source.openSession(market.latestDate);
      setMessage("Séance ouverte : les investisseurs peuvent passer leurs ordres.");
      refresh();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const cancelOffer = async (offer: MarketOffer) => {
    if (
      !window.confirm(
        `Retirer l'offre de ${nameOf(offer.companyId)} ? Ses souscriptions seront annulées.`,
      )
    )
      return;
    try {
      await source.cancelOffer(offer.id);
      refresh();
    } catch (err) {
      setError(errorText(err));
    }
  };

  const close = async () => {
    if (!open) return;
    const early =
      age < 7
        ? ` Attention : la séance n'a que ${age} jour${age > 1 ? "s" : ""}, une heptade en compte 7.`
        : "";
    if (
      !window.confirm(
        `Clôturer la séance au relevé du ${market.latestDate} ? Les dividendes annoncés seront versés, les offres servies (les émissions créent leurs titres) et une enchère tiendra lieu de fixing pour chaque titre, en crédits réels ; c'est définitif.${early}`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await source.closeSession(
        open.id,
        market.latestDate,
        listed(market).map((c) => ({
          companyId: c.id,
          shares: c.valuation?.listing?.shares ?? 0,
          reference: c.valuation?.listing?.price ?? 0,
        })),
        { commission: params.commission, carry_fee: params.carryFee },
      );
      setMessage(
        "Séance close : dividendes versés, offres servies, enchères tenues, séance suivante ouverte.",
      );
      refresh();
    } catch (err) {
      setError(`Clôture refusée : ${errorText(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <dl className="bourse__facts">
        <div>
          <dt className="label">Séance</dt>
          <dd className="bourse__figure">
            {open ? <ImperialDate date={open.openedOn} /> : "fermée"}
          </dd>
          <dd className="bourse__detail">
            {open ? `ouverte depuis ${age} jour${age > 1 ? "s" : ""}` : "aucune séance ouverte"}
          </dd>
        </div>
        <div>
          <dt className="label">Ordres en attente</dt>
          <dd className="bourse__figure">{pending.filter((o) => o.offerId === null).length}</dd>
          <dd className="bourse__detail">sur le marché entre investisseurs</dd>
        </div>
        <div>
          <dt className="label">Offres ouvertes</dt>
          <dd className="bourse__figure">{openOffers.length}</dd>
          <dd className="bourse__detail">
            {pending.filter((o) => o.offerId !== null).length} souscriptions
          </dd>
        </div>
        <div>
          <dt className="label">Commissions perçues</dt>
          <dd className="bourse__figure">
            {formatInteger(commissions)}
            <span className="amount__unit"> ¢</span>
          </dd>
          <dd className="bourse__detail">seule recette de la Bourse, jamais contrepartie</dd>
        </div>
      </dl>

      {error ? (
        <p className="note note--error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="note note--ok">{message}</p> : null}

      <section className="bourse__section" aria-labelledby="offres">
        <div className="section-head">
          <h2 id="offres">Offres des corporations</h2>
          <p>
            une corporation vend une partie de ses titres, ou en émet de nouveaux, pendant la séance
          </p>
        </div>
        {!book ? (
          <p className="bourse__note">Chargement…</p>
        ) : (
          <div className="accounts__grid">
            <div className="bourse__scroll">
              {openOffers.length === 0 ? (
                <p className="bourse__note">Aucune offre ouverte.</p>
              ) : (
                <ol className="bourse__journal">
                  {openOffers.map((o) => {
                    const subs = pending.filter((x) => x.offerId === o.id);
                    const asked = subs.reduce((sum, x) => sum + x.quantity, 0);
                    const served = allocateOffer(subs, o.sharesOffered);
                    const given = [...served.values()].reduce((sum, q) => sum + q, 0);
                    return (
                      <li key={o.id} className="accounts__pending">
                        <ImperialDate date={o.createdAt.slice(0, 10)} />
                        <span>
                          <strong>{nameOf(o.companyId)}</strong> · {OFFER_KIND_INFO[o.kind].short}{" "}
                          de {formatInteger(o.sharesOffered)} titres à {formatPrice(o.price)} ¢ ·{" "}
                          {formatInteger(asked)} demandés
                          {asked > o.sharesOffered ? (
                            <span className="bourse__off">
                              {" "}
                              · prorata {formatShare(given / asked)}
                            </span>
                          ) : null}
                          {o.note ? <span className="bourse__muted"> — {o.note}</span> : null}
                        </span>
                        <span className="accounts__actions">
                          <button
                            type="button"
                            className="linklike"
                            onClick={() => void cancelOffer(o)}
                          >
                            retirer
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
            <div className="accounts__forms">
              {open ? (
                <OfferForm market={market} book={book} onDone={refresh} />
              ) : (
                <p className="bourse__note">Ouvrez d'abord une séance.</p>
              )}
            </div>
          </div>
        )}
      </section>

      <DividendSection market={market} book={book} open={open} onDone={refresh} />

      <section className="bourse__section" aria-labelledby="cloture">
        <div className="section-head">
          <h2 id="cloture">{open ? "Clôture de la séance" : "Ouvrir la séance"}</h2>
          <p>
            {open
              ? "enchère entre investisseurs, titre par titre ; le cours KNX départage deux prix également bons"
              : "la première séance s'ouvre ici ; chaque clôture ouvre la suivante"}
          </p>
        </div>
        {!book ? (
          <p className="bourse__note">Chargement…</p>
        ) : !open ? (
          <div className="accounts__actions">
            <button type="button" className="button" disabled={busy} onClick={() => void start()}>
              Ouvrir la séance au relevé du {market.latestDate}
            </button>
          </div>
        ) : (
          <>
            {auctions.length === 0 ? (
              <p className="bourse__note">
                Aucun ordre en attente sur le marché entre investisseurs.
              </p>
            ) : (
              <div className="bourse__scroll">
                <table className="ledger">
                  <caption className="sr-only">Aperçu des enchères</caption>
                  <thead>
                    <tr>
                      <th scope="col">Titre</th>
                      <th scope="col" className="num">
                        Cours KNX
                      </th>
                      <th scope="col" className="num">
                        Ordres
                      </th>
                      <th scope="col" className="num">
                        Fixing
                      </th>
                      <th scope="col" className="num">
                        Titres échangés
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {auctions.map((a) => {
                      const reference =
                        market.byId.get(a.companyId)?.valuation?.listing?.price ?? null;
                      return (
                        <tr key={a.companyId}>
                          <th scope="row">{nameOf(a.companyId)}</th>
                          <td className="num">
                            {reference !== null ? `${formatPrice(reference)} ¢` : "—"}
                          </td>
                          <td className="num">
                            {a.orders.filter((o) => o.side === "buy").length} achats ·{" "}
                            {a.orders.filter((o) => o.side === "sell").length} ventes
                          </td>
                          <td className="num">
                            {a.clearing ? (
                              <span className="estimated">{formatPrice(a.clearing.price)} ¢</span>
                            ) : (
                              <span className="bourse__muted">pas de rencontre</span>
                            )}
                            {a.clearing && reference ? (
                              <span className="bourse__muted">
                                {" "}
                                ({formatPercent(a.clearing.price / reference - 1)})
                              </span>
                            ) : null}
                          </td>
                          <td className="num">
                            {a.clearing ? formatInteger(a.clearing.volume) : "0"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="bourse__note">
              Commission {formatShare(params.commission)} sur l'acheteur et le vendeur, et sur le
              produit des offres ; frais de report {formatShare(params.carryFee)}. Ces leviers se
              règlent dans les <Link to="/bourse/reglages">réglages</Link>. L'aperçu reprend le
              calcul que la base refait à la clôture.
            </p>
            <div className="accounts__actions">
              <button type="button" className="button" disabled={busy} onClick={() => void close()}>
                {busy ? "Clôture…" : `Clôturer la séance au relevé du ${market.latestDate}`}
              </button>
              {age < 7 ? (
                <span className="bourse__off">
                  la séance n'a que {age} jour{age > 1 ? "s" : ""} : une heptade en compte 7
                </span>
              ) : null}
            </div>
          </>
        )}
      </section>

      <section className="bourse__section" aria-labelledby="seances">
        <div className="section-head">
          <h2 id="seances">Séances closes</h2>
          <p>les plus récentes d'abord</p>
        </div>
        {closed.length === 0 ? (
          <p className="bourse__note">Aucune séance close.</p>
        ) : (
          <ol className="bourse__journal">
            {closed.map((s) => {
              const filled = (book?.trades ?? []).filter(
                (t) => t.sessionId === s.id && t.side === "buy",
              );
              const offersClosed = (book?.offers ?? []).filter(
                (o) => o.sessionId === s.id && o.status === "closed",
              );
              const paid = (book?.dividends ?? []).filter(
                (d) => d.sessionId === s.id && d.status === "paid",
              );
              return (
                <li key={s.id}>
                  <ImperialDate date={s.closedOn ?? s.openedOn} />
                  <span>
                    {s.prices.length} titre{s.prices.length > 1 ? "s" : ""} échangé
                    {s.prices.length > 1 ? "s" : ""} · volume{" "}
                    {formatInteger(filled.reduce((sum, t) => sum + t.amount, 0))} ¢
                    {offersClosed.length > 0 ? (
                      <span className="bourse__muted">
                        {" "}
                        · {offersClosed.length} offre{offersClosed.length > 1 ? "s" : ""}, produit{" "}
                        {formatInteger(offersClosed.reduce((sum, o) => sum + o.proceeds, 0))} ¢
                      </span>
                    ) : null}
                    {paid.length > 0 ? (
                      <span className="bourse__muted">
                        {" "}
                        · {paid.length} dividende{paid.length > 1 ? "s" : ""},{" "}
                        {formatInteger(paid.reduce((sum, d) => sum + d.total, 0))} ¢ versés
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <PolicySection market={market} book={book} onDone={refresh} />
    </>
  );
}

/** The operator's side of the weekly market: offers, dividends, auction preview, close. */
export function SessionAdminPage() {
  const { state, session, source } = useData();

  return (
    <div className="bourse accounts">
      <header className="page-head">
        <div>
          <h1>Séance de la Bourse</h1>
          <p>
            Une séance par heptade. Les corporations y vendent une partie de leurs titres, en
            émettent de nouveaux et annoncent leurs dividendes ; les investisseurs échangent entre
            eux. À la clôture, une enchère par titre fixe le prix, en crédits réels. Voir aussi les{" "}
            <Link to="/bourse/comptes">comptes</Link> et les{" "}
            <Link to="/bourse/reglages">réglages</Link>.
          </p>
        </div>
      </header>
      {source.kind === "local" ? (
        <p className="note note--warn">
          Mode local : la séance porte de vrais crédits et demande la base Supabase.
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
      ) : state.status !== "ready" ? (
        <p className="state" role="status">
          Chargement de la cote…
        </p>
      ) : (
        <SessionAdmin market={state.market} />
      )}
    </div>
  );
}
