import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  BALANCE_ITEM_INFO,
  BALANCE_ITEMS,
  SOURCE_INFO,
  type BalanceItem,
} from "../domain/balance.ts";
import { acrossLives, lifeValuation, type CompanySeries, type Market } from "../domain/market.ts";
import {
  formatDecimal,
  formatFactor,
  formatInteger,
  formatPercent,
  formatPrice,
  formatShare,
} from "../domain/numbers.ts";
import { CATEGORY_INFO, CONFIDENCE_INFO, ratingCode } from "../domain/rating.ts";
import { useData } from "../data/DataProvider.tsx";
import { OPERATION_INFO } from "../domain/securities.ts";
import {
  DIVIDEND_POLICY_INFO,
  DIVIDEND_STATUS_LABELS,
  fixingHistory,
  policyHistory,
  type Dividend,
  type DividendPolicy,
  type MarketSession,
} from "../domain/trading.ts";
import { priceHistory, type ValuationParams, type ValuationPoint } from "../domain/valuation.ts";
import type { IsoDate } from "../domain/types.ts";
import { wageOriginLabel, type WageRate } from "../domain/wages.ts";
import { listingLabel, operationDetail, operationMarkers } from "./bourseText.ts";
import { Change, ImperialDate } from "./figures.tsx";
import { PeriodPicker, type PeriodId } from "./PeriodPicker.tsx";
import { TimeChart, type ChartMarker } from "./TimeChart.tsx";
import "./ValuationPanel.css";

/** The report a change is read from; reports are not daily. */
function Since({ date }: { date: IsoDate | null }) {
  return date ? (
    <>
      depuis le relevé du <ImperialDate date={date} />
    </>
  ) : (
    <>pas de relevé assez ancien</>
  );
}

/** The lever that weighs each item of the balance sheet. */
const ITEM_WEIGHT: Record<BalanceItem, (p: ValuationParams) => number> = {
  land: (p) => p.landWeight,
  building: (p) => p.buildingWeight,
  fittings: (p) => p.fittingsWeight,
  stock: (p) => p.stockWeight,
};

/** The calculation of one day's value, line by line, like a receipt. */
function Receipt({
  v,
  wage,
  shares,
  params,
}: {
  v: ValuationPoint;
  /** The wage in force that day, and where it comes from. */
  wage: WageRate;
  shares: number | null;
  params: ValuationParams;
}) {
  const capped = v.rawRevenue - v.revenue;
  const rating = v.rating;
  return (
    <table className="receipt">
      <caption className="sr-only">Calcul de la valeur KNX du relevé</caption>
      <tbody>
        <tr>
          <th scope="row">CA réel retenu</th>
          <td className="num">
            <span className="estimated">{formatInteger(v.revenue)} ¢/j</span>
          </td>
          <td className="receipt__why">
            moyenne des {v.revenueDays} jours connus sur {params.revenueWindow}, chaque jour
            plafonné à {formatFactor(params.spikeCap)} jours ordinaires
            {capped > 0.5 ? (
              <>
                {" "}
                · pics écrêtés : <span className="estimated">−{formatInteger(capped)} ¢/j</span>
              </>
            ) : null}
          </td>
        </tr>
        <tr>
          <th scope="row">− salaires estimés</th>
          <td className="num">
            <span className="estimated">{formatInteger(v.payroll)} ¢/j</span>
          </td>
          <td className="receipt__why">
            {v.payroll > 0 ? (
              <>
                moyenne sur la même fenêtre de l'effectif payé (le DG ne l'est pas) à{" "}
                {formatInteger(wage.wage)} ¢ par jour, {wageOriginLabel(wage.origin)}
              </>
            ) : (
              "aucun salarié payé connu sur la fenêtre"
            )}
          </td>
        </tr>
        <tr className="receipt__sub">
          <th scope="row">= marge</th>
          <td className="num">
            <span className="estimated">{formatInteger(v.margin)} ¢/j</span>
          </td>
          <td className="receipt__why">
            {v.payroll > v.revenue
              ? "les salaires dépassent la recette : la marge reste à zéro"
              : null}
          </td>
        </tr>
        <tr>
          <th scope="row">× jours de recettes</th>
          <td className="num">{formatInteger(params.revenueDays)}</td>
          <td className="receipt__why">ce que vaut le fonds de commerce, en jours de CA</td>
        </tr>
        <tr>
          <th scope="row">× maturité</th>
          <td className="num">
            <span className="estimated">{formatDecimal(v.maturity * 100)} %</span>
          </td>
          <td className="receipt__why">
            {formatInteger(v.age)} jours d'âge ÷ ({formatInteger(v.age)} +{" "}
            {formatInteger(params.maturityHalf)}) : une maison jeune vaut moins
          </td>
        </tr>
        <tr className="receipt__sub">
          <th scope="row">= fonds de commerce</th>
          <td className="num">
            <span className="estimated">{formatInteger(v.operating)} ¢</span>
          </td>
          <td />
        </tr>
        <tr>
          <th scope="row">+ capital retenu</th>
          <td className="num">
            <span className="estimated">{formatInteger(v.capital)} ¢</span>
          </td>
          <td className="receipt__why">
            {formatInteger(v.retainedCapital)} ¢ × {formatShare(params.capitalWeight)} : le plus bas
            du capital du jour et de sa moyenne sur {params.capitalWindow} jours, décoté parce que
            la direction peut le retirer
          </td>
        </tr>
        <tr className="receipt__sub">
          <th scope="row">= base</th>
          <td className="num">
            <span className="estimated">{formatInteger(v.base)} ¢</span>
          </td>
          <td />
        </tr>
        <tr>
          <th scope="row">× Agence</th>
          <td className="num">× {formatFactor(v.multiplier)}</td>
          <td className="receipt__why">
            {rating ? (
              <>
                notée {ratingCode(rating.category, rating.confidence)} (
                {CATEGORY_INFO[rating.category].label}, {CONFIDENCE_INFO[rating.confidence].label})
                le <ImperialDate date={rating.date} />
              </>
            ) : (
              "sans notation en vigueur : décote d'opacité"
            )}
          </td>
        </tr>
        <tr className="receipt__sub">
          <th scope="row">= valeur de l'activité</th>
          <td className="num">
            <span className="estimated">{formatInteger(v.business)} ¢</span>
          </td>
          <td />
        </tr>
        {BALANCE_ITEMS.some((item) => v.assets[item]) ? (
          BALANCE_ITEMS.map((item) => {
            const asset = v.assets[item];
            if (!asset) return null;
            return (
              <tr key={item}>
                <th scope="row">+ {BALANCE_ITEM_INFO[item].label.toLowerCase()}</th>
                <td className="num">
                  <span className="estimated">{formatInteger(asset.counted)} ¢</span>
                </td>
                <td className="receipt__why">
                  {formatInteger(asset.amount)} ¢ × {formatShare(ITEM_WEIGHT[item](params))}
                  {asset.source === "declared"
                    ? ` × ${formatShare(asset.trust)} (déclaré)`
                    : " (audité)"}
                  {asset.fade !== undefined ? ` × ${formatShare(asset.fade)} (fraîcheur)` : null}
                  {" · "}
                  {SOURCE_INFO[asset.source].label} le <ImperialDate date={asset.date} />
                </td>
              </tr>
            );
          })
        ) : (
          <tr>
            <th scope="row">+ local et stock</th>
            <td className="num">
              <span className="amount--none">—</span>
            </td>
            <td className="receipt__why">aucun bilan enregistré</td>
          </tr>
        )}
        <tr className="receipt__total">
          <th scope="row">= valeur KNX</th>
          <td className="num">
            <span className="estimated">{formatInteger(v.value)} ¢</span>
          </td>
          <td className="receipt__why">
            fourchette {formatInteger(v.low)} – {formatInteger(v.high)} ¢ (±{" "}
            {formatPercent(v.band).replace("+", "")} sur l'activité, selon la confiance de la
            notation)
          </td>
        </tr>
        {shares ? (
          <>
            <tr>
              <th scope="row">÷ titres</th>
              <td className="num">{formatInteger(shares)}</td>
              <td />
            </tr>
            <tr className="receipt__total">
              <th scope="row">= cours</th>
              <td className="num">
                <span className="estimated">{formatPrice(v.value / shares)} ¢</span>
              </td>
              <td />
            </tr>
          </>
        ) : null}
      </tbody>
    </table>
  );
}

export function ValuationPanel({
  company,
  lives,
  market,
  start,
  period,
  onPeriod,
  markers,
}: {
  company: CompanySeries;
  /** Every life of the page, oldest first. */
  lives: readonly CompanySeries[];
  market: Market;
  start: IsoDate | null;
  period: PeriodId;
  onPeriod: (period: PeriodId) => void;
  /** Market events and refoundings, drawn on the chart. */
  markers: readonly ChartMarker[];
}) {
  const { params } = market.valuation;
  const valuation = company.valuation;
  const listing = valuation?.listing ?? null;
  const operations = useMemo(() => market.operations.get(company.id) ?? [], [market, company.id]);
  const sheets = market.balances.get(company.id) ?? [];
  const current = useMemo(() => lifeValuation(market, company, params), [company, market, params]);
  const values = useMemo(() => current.history(), [current]);
  const prices = useMemo(() => priceHistory(values, operations), [values, operations]);
  const pageValues = useMemo(
    () =>
      acrossLives(lives, (life) =>
        (life === company ? values : lifeValuation(market, life, params).history()).map((v) => ({
          date: v.date,
          value: v.value,
        })),
      ),
    [lives, company, values, market, params],
  );
  // A price curve needs two published prices; until then the value curve stands in.
  const { source } = useData();
  const [sessions, setSessions] = useState<MarketSession[]>([]);
  const [policies, setPolicies] = useState<DividendPolicy[]>([]);
  const [dividends, setDividends] = useState<Dividend[]>([]);
  useEffect(() => {
    if (!listing) return;
    let live = true;
    Promise.all([source.marketSessions(), source.dividendPolicies(), source.dividends()]).then(
      ([list, decided, announced]) => {
        if (!live) return;
        setSessions(list);
        setPolicies(decided);
        setDividends(announced);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [source, listing]);
  const policy = policyHistory(policies, company.id).at(-1) ?? null;
  const ownDividends = dividends.filter(
    (d) => d.companyId === company.id && d.status !== "cancelled",
  );
  const fixings = useMemo(
    () => (listing ? fixingHistory(sessions, company.id, listing.shares) : []),
    [sessions, company.id, listing],
  );
  const canPrice = listing !== null && prices.filter((p) => p.value !== null).length > 1;
  const [mode, setMode] = useState<"value" | "price">("price");
  const showPrice = canPrice && mode === "price";
  const inPeriod = (p: { date: IsoDate }) => !start || p.date >= start;
  const latest = valuation?.latest ?? null;
  const chartMarkers = useMemo(
    () =>
      [...markers, ...operationMarkers(operations)].sort((a, b) => a.date.localeCompare(b.date)),
    [markers, operations],
  );

  return (
    <section className="company__valuation valuation" aria-labelledby="valeur">
      <div className="section-head">
        <h2 id="valeur">Valeur et cours</h2>
        <p>
          <span className="estimated">cours théorique KNX</span>, recalculé à chaque relevé ·{" "}
          <Link to="/bourse">méthode</Link>
        </p>
        <div className="push valuation__tools">
          {canPrice ? (
            <div className="segmented" role="group" aria-label="Courbe">
              <button type="button" aria-pressed={showPrice} onClick={() => setMode("price")}>
                Cours par titre
              </button>
              <button type="button" aria-pressed={!showPrice} onClick={() => setMode("value")}>
                Valeur
              </button>
            </div>
          ) : null}
          <PeriodPicker value={period} onChange={onPeriod} />
        </div>
      </div>

      <dl className="valuation__facts">
        <div>
          <dt className="label">Valeur KNX</dt>
          <dd className="valuation__figure">
            {latest ? (
              <span className="estimated" title="Estimation KNX">
                {formatInteger(latest.value)}
                <span className="amount__unit"> ¢</span>
              </span>
            ) : (
              "—"
            )}
          </dd>
          <dd className="valuation__detail">
            {latest
              ? `de ${formatInteger(latest.low)} à ${formatInteger(latest.high)} ¢`
              : valuation?.status === "unknown-age"
                ? "date de création inconnue : pas de valeur"
                : "en observation : il faut une semaine de recettes connues"}
          </dd>
        </div>
        <div>
          <dt className="label">Cours</dt>
          <dd className="valuation__figure">
            {listing?.price != null ? (
              <span className="estimated" title="Cours théorique KNX : valeur ÷ titres">
                {formatPrice(listing.price)}
                <span className="amount__unit"> ¢</span>
              </span>
            ) : (
              "—"
            )}
          </dd>
          <dd className="valuation__detail">
            {!listing ? (
              "non introduite en bourse"
            ) : listing.state === "listed" ? (
              <>
                {formatInteger(listing.shares)} titres · introduite le{" "}
                <ImperialDate date={listing.introducedOn} />
              </>
            ) : (
              <>
                <span className="valuation__state">{listingLabel(valuation)}</span> depuis le{" "}
                <ImperialDate date={listing.since} />
                {listing.priceDate ? (
                  <>
                    {" "}
                    · dernier cours du <ImperialDate date={listing.priceDate} />
                  </>
                ) : null}
                {listing.note ? ` · ${listing.note}` : null}
              </>
            )}
          </dd>
        </div>
        <div>
          <dt className="label">Sur le relevé</dt>
          <dd className="valuation__figure">
            <Change ratio={valuation?.change.report ?? null} estimated />
          </dd>
          <dd className="valuation__detail">
            <Since date={valuation?.changeFrom.report ?? null} />
          </dd>
        </div>
        <div>
          <dt className="label">Sur une heptade</dt>
          <dd className="valuation__figure">
            <Change ratio={valuation?.change.week ?? null} estimated />
          </dd>
          <dd className="valuation__detail">
            <Since date={valuation?.changeFrom.week ?? null} />
          </dd>
        </div>
        <div>
          <dt className="label">Sur un an impérial</dt>
          <dd className="valuation__figure">
            <Change ratio={valuation?.change.month ?? null} estimated />
          </dd>
          <dd className="valuation__detail">
            <Since date={valuation?.changeFrom.month ?? null} />
          </dd>
        </div>
      </dl>

      {values.length > 1 || pageValues.length > 1 ? (
        <TimeChart
          label={
            showPrice
              ? `Cours théorique par titre de ${company.name}, ajusté des divisions et regroupements`
              : `Valeur KNX de ${company.name}`
          }
          formatValue={(v) => `${showPrice ? formatPrice(v) : formatInteger(v)} ¢`}
          height={280}
          markers={chartMarkers}
          series={
            showPrice
              ? [
                  {
                    id: "price",
                    label: "Cours par titre",
                    color: "var(--estime)",
                    kind: "trend",
                    points: prices.filter(inPeriod),
                  },
                  ...(fixings.length > 0
                    ? [
                        {
                          id: "fixing",
                          label: "Fixing de séance",
                          color: "var(--ivoire)",
                          kind: "step" as const,
                          points: fixings
                            .map((f) => ({ date: f.date, value: f.adjusted }))
                            .filter(inPeriod),
                        },
                      ]
                    : []),
                ]
              : [
                  {
                    id: "high",
                    label: "Haut de fourchette",
                    color: "var(--filet-fort)",
                    points: values.map((v) => ({ date: v.date, value: v.high })).filter(inPeriod),
                  },
                  {
                    id: "low",
                    label: "Bas de fourchette",
                    color: "var(--filet-fort)",
                    points: values.map((v) => ({ date: v.date, value: v.low })).filter(inPeriod),
                  },
                  {
                    id: "value",
                    label: "Valeur KNX",
                    color: "var(--estime)",
                    kind: "trend",
                    points: pageValues.filter(inPeriod),
                  },
                ]
          }
        />
      ) : null}

      <div className="valuation__grid">
        <div>
          <h3 className="label">Calcul du dernier relevé</h3>
          {latest ? (
            <Receipt
              v={latest}
              wage={current.wageOn(latest.date)}
              params={params}
              shares={listing?.state === "listed" ? listing.shares : null}
            />
          ) : (
            <p className="valuation__note">
              {valuation?.status === "unknown-age"
                ? "KNX ne connaît pas la date de création de cette corporation : sans âge, pas de maturité ni de valeur."
                : `KNX attend ${params.minHistory} jours de recettes connues avant de publier une valeur.`}
            </p>
          )}
        </div>
        <div>
          {fixings.length > 0 ? (
            <>
              <h3 className="label">Séances</h3>
              <ol className="valuation__ops">
                {[...fixings]
                  .reverse()
                  .slice(0, 8)
                  .map((f) => (
                    <li key={f.date}>
                      <ImperialDate date={f.date} />
                      <span>
                        fixing <strong>{formatPrice(f.price)} ¢</strong> ·{" "}
                        <Change ratio={f.premium} estimated /> du cours KNX (
                        {formatPrice(f.reference)} ¢)
                        <span className="valuation__op-note">
                          {" "}
                          · {formatInteger(f.volume)} titres échangés
                        </span>
                      </span>
                    </li>
                  ))}
              </ol>
            </>
          ) : null}
          {listing ? (
            <>
              <h3 className="label">Distribution</h3>
              <p className="valuation__note">
                <strong>{DIVIDEND_POLICY_INFO[policy?.policy ?? "none"].label}</strong>
                {policy ? (
                  <>
                    {" "}
                    depuis le <ImperialDate date={policy.decidedOn} />
                    {policy.note ? ` — ${policy.note}` : null}
                  </>
                ) : null}
                . {DIVIDEND_POLICY_INFO[policy?.policy ?? "none"].help}
              </p>
              {ownDividends.length > 0 ? (
                <ol className="valuation__ops">
                  {ownDividends.slice(0, 8).map((d) => (
                    <li key={d.id}>
                      <ImperialDate date={d.paidOn ?? d.createdAt.slice(0, 10)} />
                      <span>
                        <strong>Dividende</strong> · {formatPrice(d.perShare)} ¢ par titre ·{" "}
                        {DIVIDEND_STATUS_LABELS[d.status]}
                        {d.note ? <span className="valuation__op-note"> — {d.note}</span> : null}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </>
          ) : null}
          <h3 className="label">Opérations sur titres</h3>
          {operations.length === 0 ? (
            <p className="valuation__note">
              Aucune opération. Une corporation entre en bourse quand sa direction le demande : KNX
              publie alors un cours par titre, sa valeur divisée par le nombre de titres choisi.
            </p>
          ) : (
            <ol className="valuation__ops">
              {[...operations].reverse().map((op) => (
                <li key={op.id}>
                  <ImperialDate date={op.date} />
                  <span>
                    <strong>{OPERATION_INFO[op.kind].label}</strong>
                    {operationDetail(op) ? ` · ${operationDetail(op)}` : null}
                    {op.note ? <span className="valuation__op-note"> — {op.note}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {company.life.count > 1 ? (
            <p className="valuation__note">
              Les titres appartiennent à une vie de la corporation : après une refondation, elle
              doit être réintroduite. La courbe de valeur reprend chaque vie séparément.
            </p>
          ) : null}
          <h3 className="label">Bilans</h3>
          {sheets.length === 0 ? (
            <p className="valuation__note">
              Aucun bilan. Le local (terrain, bâtiment, aménagement) et le stock ne figurent pas au
              rapport du jeu : la direction les déclare, ou l'Agence les audite, par exemple au
              dossier d'une introduction en bourse.
            </p>
          ) : (
            <ol className="valuation__ops">
              {[...sheets].reverse().map((sheet) => (
                <li key={sheet.id}>
                  <ImperialDate date={sheet.date} />
                  <span>
                    <strong>{sheet.source === "audited" ? "Audité" : "Déclaré"}</strong>
                    {BALANCE_ITEMS.filter((item) => sheet[item] !== null).map((item) => (
                      <span key={item}>
                        {" · "}
                        {BALANCE_ITEM_INFO[item].label.toLowerCase()}{" "}
                        {formatInteger(sheet[item] ?? 0)} ¢
                      </span>
                    ))}
                    {sheet.note ? (
                      <span className="valuation__op-note"> — {sheet.note}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
