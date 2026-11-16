import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Change, ImperialDate } from "../components/figures.tsx";
import { useData } from "../data/DataProvider.tsx";
import { daysBetween } from "../domain/dates.ts";
import { houseExposure } from "../domain/exposure.ts";
import type { Market } from "../domain/market.ts";
import { formatInteger, formatPercent, formatPrice, formatShare } from "../domain/numbers.ts";
import {
  fixingPlan,
  lastPremiums,
  type FixingInput,
  type MarketOrder,
  type MarketSession,
  type MarketTrade,
} from "../domain/trading.ts";
import { SignIn } from "./ReportsPage.tsx";
import "./BoursePage.css";
import "./AccountsAdminPage.css";

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Listed corporations as the close reads them: KNX price per share at the latest report. */
function fixingInputs(market: Market, sessions: readonly MarketSession[]): FixingInput[] {
  const premiums = lastPremiums(sessions);
  return market.companies
    .filter(
      (c) =>
        c.status !== "delisted" &&
        c.valuation?.listing?.state === "listed" &&
        c.valuation.listing.price !== null,
    )
    .map((c) => ({
      companyId: c.id,
      shares: c.valuation?.listing?.shares ?? 0,
      reference: c.valuation?.listing?.price ?? 0,
      previousPremium: premiums.get(c.id) ?? 0,
    }));
}

function SessionAdmin({ market }: { market: Market }) {
  const { source } = useData();
  const [book, setBook] = useState<{
    sessions: MarketSession[];
    orders: MarketOrder[];
    trades: MarketTrade[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    Promise.all([source.marketSessions(), source.marketOrders(), source.marketTrades()]).then(
      ([sessions, orders, trades]) => setBook({ sessions, orders, trades }),
      (err: unknown) => setError(errorText(err)),
    );
  }, [source]);
  useEffect(refresh, [refresh]);

  const params = market.valuation.params;
  const open = book?.sessions.find((s) => s.status === "open") ?? null;
  const openOrders = useMemo(
    () =>
      book && open ? book.orders.filter((o) => o.sessionId === open.id && o.status === "open") : [],
    [book, open],
  );
  const plan = useMemo(
    () => (book ? fixingPlan(fixingInputs(market, book.sessions), openOrders, params) : []),
    [book, market, openOrders, params],
  );
  const exposure = useMemo(() => houseExposure(market, book?.trades ?? []), [market, book]);
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

  const close = async () => {
    if (!open) return;
    const early =
      age < 7
        ? ` Attention : la séance n'a que ${age} jour${age > 1 ? "s" : ""}, une heptade en compte 7.`
        : "";
    if (
      !window.confirm(
        `Clôturer la séance au relevé du ${market.latestDate} ? ${openOrders.length} ordre${openOrders.length > 1 ? "s" : ""} seront servis ou refusés aux prix affichés, en crédits réels ; c'est définitif.${early}`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await source.closeSession(open.id, market.latestDate, plan, {
        commission: params.commission,
        spread: params.spread,
        hold_cap: params.holdCap,
        player_cap: params.playerCap,
        premium_sensitivity: params.premiumSensitivity,
        premium_half_life: params.premiumHalfLife,
        premium_band: params.premiumBand,
        carry_fee: params.carryFee,
      });
      setMessage("Séance close : ordres servis, séance suivante ouverte.");
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
          <dd className="bourse__figure">{openOrders.length}</dd>
          <dd className="bourse__detail">servis à la clôture</dd>
        </div>
        <div>
          <dt className="label">Dû aux joueurs</dt>
          <dd className="bourse__figure">
            <span className="estimated">{formatInteger(exposure.owed)}</span>
            <span className="amount__unit"> ¢</span>
          </dd>
          <dd className="bourse__detail">titres détenus, au cours KNX du jour</dd>
        </div>
        <div>
          <dt className="label">Gain latent des joueurs</dt>
          <dd className="bourse__figure">
            <span className="estimated">{formatInteger(exposure.playersGain)}</span>
            <span className="amount__unit"> ¢</span>
          </dd>
          <dd className="bourse__detail">
            perte latente de la maison · commissions perçues {formatInteger(exposure.commissions)} ¢
          </dd>
        </div>
      </dl>

      {error ? (
        <p className="note note--error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="note note--ok">{message}</p> : null}

      <section className="bourse__section" aria-labelledby="cloture">
        <div className="section-head">
          <h2 id="cloture">{open ? "Clôture de la séance" : "Ouvrir la séance"}</h2>
          <p>
            {open
              ? `prix fixés au relevé du ${market.latestDate}, à partir de la valeur KNX et des ordres`
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
            {plan.length === 0 ? (
              <p className="bourse__note">
                Aucune corporation cotée : la clôture refusera les ordres en attente.
              </p>
            ) : (
              <div className="bourse__scroll">
                <table className="ledger">
                  <caption className="sr-only">Prix de clôture</caption>
                  <thead>
                    <tr>
                      <th scope="col">Titre</th>
                      <th scope="col" className="num">
                        Cours KNX
                      </th>
                      <th scope="col" className="num">
                        Achats / ventes
                      </th>
                      <th scope="col" className="num">
                        Prime
                      </th>
                      <th scope="col" className="num">
                        Fixing
                      </th>
                      <th scope="col" className="num secondary">
                        Achat / vente servis à
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.map((p) => (
                      <tr key={p.companyId}>
                        <th scope="row">{nameOf(p.companyId)}</th>
                        <td className="num">{formatPrice(p.reference)} ¢</td>
                        <td className="num">
                          {formatInteger(p.demand)} / {formatInteger(p.supply)}
                        </td>
                        <td className="num">
                          <Change ratio={p.premium} estimated />
                        </td>
                        <td className="num">
                          <span className="estimated">{formatPrice(p.price)} ¢</span>
                        </td>
                        <td className="num secondary">
                          {formatPrice(p.buy)} / {formatPrice(p.sell)} ¢
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="bourse__note">
              Commission {formatShare(params.commission)}, écart {formatShare(params.spread)}, prime
              bornée à ± {formatShare(params.premiumBand)} ; les joueurs réunis détiennent au plus{" "}
              {formatShare(params.holdCap)} des titres d'une corporation, chacun{" "}
              {formatShare(params.playerCap)}. Ces leviers se règlent dans les{" "}
              <Link to="/bourse/reglages">réglages</Link>.
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

      <section className="bourse__section" aria-labelledby="exposition">
        <div className="section-head">
          <h2 id="exposition">Exposition de la maison</h2>
          <p>titres détenus par les joueurs, face à la caisse de la Banque impériale</p>
        </div>
        {exposure.companies.length === 0 ? (
          <p className="bourse__note">Aucun titre détenu par les joueurs.</p>
        ) : (
          <div className="bourse__scroll">
            <table className="ledger">
              <caption className="sr-only">Exposition par titre</caption>
              <thead>
                <tr>
                  <th scope="col">Titre</th>
                  <th scope="col" className="num">
                    Titres détenus
                  </th>
                  <th scope="col" className="num">
                    Part du capital
                  </th>
                  <th scope="col" className="num">
                    Valeur
                  </th>
                  <th scope="col" className="num secondary">
                    Gain latent
                  </th>
                </tr>
              </thead>
              <tbody>
                {exposure.companies.map((e) => (
                  <tr key={e.companyId}>
                    <th scope="row">{nameOf(e.companyId)}</th>
                    <td className="num">{formatInteger(e.held)}</td>
                    <td className="num">
                      {e.share === null ? (
                        "—"
                      ) : (
                        <span className={e.share >= params.holdCap ? "bourse__off" : undefined}>
                          {formatShare(e.share)}
                        </span>
                      )}
                    </td>
                    <td className="num">
                      {e.value === null ? (
                        "—"
                      ) : (
                        <span className="estimated">{formatInteger(e.value)} ¢</span>
                      )}
                    </td>
                    <td className="num secondary">
                      {e.value === null ? (
                        "—"
                      ) : (
                        <Change ratio={e.cost > 0 ? e.value / e.cost - 1 : null} estimated />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="bourse__note">
          Caisse nette de la maison sur le marché : {formatInteger(exposure.cashIn)} ¢ (achats
          encaissés moins ventes payées, commissions comprises). Si les joueurs revendaient tout au
          cours du jour, elle leur devrait {formatInteger(exposure.owed)} ¢.
        </p>
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
              const filled = (book?.trades ?? []).filter((t) => t.sessionId === s.id);
              return (
                <li key={s.id}>
                  <ImperialDate date={s.closedOn ?? s.openedOn} />
                  <span>
                    {s.prices.length} titre{s.prices.length > 1 ? "s" : ""} fixé
                    {s.prices.length > 1 ? "s" : ""} · {filled.length} exécution
                    {filled.length > 1 ? "s" : ""} · volume{" "}
                    {formatInteger(filled.reduce((sum, t) => sum + t.amount, 0))} ¢
                    {s.prices.length > 0 ? (
                      <span className="bourse__muted">
                        {" "}
                        — prime médiane{" "}
                        {formatPercent(
                          [...s.prices].sort((a, b) => a.premium - b.premium)[
                            Math.floor(s.prices.length / 2)
                          ].premium,
                        )}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </>
  );
}

/** The operator's side of the weekly market: preview the fixing, close the session. */
export function SessionAdminPage() {
  const { state, session, source } = useData();

  return (
    <div className="bourse accounts">
      <header className="page-head">
        <div>
          <h1>Séance de la Bourse</h1>
          <p>
            Une séance par heptade. À la clôture, KNX fixe un prix par corporation cotée et la
            Banque impériale sert chaque ordre compatible, en crédits réels. Voir aussi les{" "}
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
