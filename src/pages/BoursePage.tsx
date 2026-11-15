import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Change, ImperialDate } from "../components/figures.tsx";
import { changedLevers, LEVERS, listingLabel, operationDetail } from "../components/bourseText.ts";
import { Seal } from "../components/Seal.tsx";
import { useData, useMarket } from "../data/DataProvider.tsx";
import type { CompanySeries } from "../domain/market.ts";
import { formatCompact, formatInteger, formatPrice } from "../domain/numbers.ts";
import type { Market } from "../domain/market.ts";
import { OPERATION_INFO } from "../domain/securities.ts";
import type { MarketSession } from "../domain/trading.ts";
import { DEFAULT_VALUATION, VALUATION_METHOD } from "../domain/valuation.ts";
import "./BoursePage.css";

function ListedTable({ listed }: { listed: CompanySeries[] }) {
  return (
    <div className="bourse__scroll">
      <table className="ledger">
        <caption className="sr-only">Corporations introduites en bourse</caption>
        <thead>
          <tr>
            <th scope="col">Corporation</th>
            <th scope="col" className="num">
              Cours
            </th>
            <th scope="col" className="num">
              Relevé
            </th>
            <th scope="col" className="num secondary">
              30 jours
            </th>
            <th scope="col" className="num secondary">
              Titres
            </th>
            <th scope="col" className="num">
              Valeur KNX
            </th>
            <th scope="col" className="secondary">
              État
            </th>
          </tr>
        </thead>
        <tbody>
          {listed.map((c) => {
            const listing = c.valuation?.listing;
            if (!listing) return null;
            return (
              <tr key={c.id}>
                <th scope="row">
                  <span className="ledger__name">
                    <Seal seed={c.sealSeed} size={22} />
                    <Link to={`/corporations/${c.slug}`}>{c.name}</Link>
                  </span>
                </th>
                <td className="num">
                  {listing.price !== null ? (
                    <span className="estimated">{formatPrice(listing.price)} ¢</span>
                  ) : (
                    <span className="amount--none">—</span>
                  )}
                </td>
                <td className="num">
                  {listing.state === "listed" ? (
                    <Change ratio={c.valuation?.change.report ?? null} estimated />
                  ) : (
                    <span className="amount--none">—</span>
                  )}
                </td>
                <td className="num secondary">
                  {listing.state === "listed" ? (
                    <Change ratio={c.valuation?.change.month ?? null} estimated />
                  ) : (
                    <span className="amount--none">—</span>
                  )}
                </td>
                <td className="num secondary">{formatInteger(listing.shares)}</td>
                <td className="num">
                  {c.valuation?.latest ? (
                    <span className="estimated">{formatCompact(c.valuation.latest.value)} ¢</span>
                  ) : (
                    <span className="amount--none">—</span>
                  )}
                </td>
                <td className="secondary">
                  <span className={listing.state === "listed" ? undefined : "bourse__off"}>
                    {listingLabel(c.valuation)}
                  </span>{" "}
                  <span className="bourse__muted">
                    depuis le <ImperialDate date={listing.since} />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Prices fixed at the latest closed session, for everyone to read. */
function LastSession({ market }: { market: Market }) {
  const { source } = useData();
  const [sessions, setSessions] = useState<MarketSession[] | null>(null);
  useEffect(() => {
    source.marketSessions().then(setSessions, () => setSessions([]));
  }, [source]);
  const last = (sessions ?? [])
    .filter((x) => x.status === "closed")
    .sort((a, b) => (b.closedOn ?? "").localeCompare(a.closedOn ?? ""))[0];
  const open = (sessions ?? []).find((x) => x.status === "open");
  if (!sessions || (!last && !open)) return null;
  return (
    <section className="bourse__section" aria-labelledby="seance">
      <div className="section-head">
        <h2 id="seance">Séance</h2>
        <p>
          {open ? (
            <>
              séance en cours depuis le relevé du <ImperialDate date={open.openedOn} /> ·{" "}
            </>
          ) : null}
          {last ? (
            <>
              dernière clôture au relevé du <ImperialDate date={last.closedOn ?? last.openedOn} />
            </>
          ) : (
            "aucune séance close"
          )}
        </p>
      </div>
      {last && last.prices.length > 0 ? (
        <div className="bourse__scroll">
          <table className="ledger">
            <caption className="sr-only">Prix de la dernière séance</caption>
            <thead>
              <tr>
                <th scope="col">Titre</th>
                <th scope="col" className="num">
                  Cours KNX
                </th>
                <th scope="col" className="num">
                  Prime
                </th>
                <th scope="col" className="num">
                  Fixing
                </th>
                <th scope="col" className="num secondary">
                  Achats / ventes
                </th>
              </tr>
            </thead>
            <tbody>
              {last.prices.map((p) => {
                const company = market.byId.get(p.companyId);
                return (
                  <tr key={p.companyId}>
                    <th scope="row">
                      {company ? (
                        <span className="ledger__name">
                          <Seal seed={company.sealSeed} size={22} />
                          <Link to={`/corporations/${company.slug}`}>{company.name}</Link>
                        </span>
                      ) : (
                        "corporation inconnue"
                      )}
                    </th>
                    <td className="num">{formatPrice(p.reference)} ¢</td>
                    <td className="num">
                      <Change ratio={p.premium} estimated />
                    </td>
                    <td className="num">
                      <span className="estimated">{formatPrice(p.price)} ¢</span>
                    </td>
                    <td className="num secondary">
                      {formatInteger(p.demand)} / {formatInteger(p.supply)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="bourse__note">
        Chaque heptade, les investisseurs passent leurs ordres ; à la clôture, le fixing s'écarte du
        cours KNX selon le solde des ordres, et la Banque impériale sert chaque ordre compatible.{" "}
        <Link to="/compte">Espace investisseur</Link>.
      </p>
    </section>
  );
}

export function BoursePage() {
  const market = useMarket();
  const { session } = useData();
  const isAdmin = session?.state === "signed-in" && session.isAdmin;
  const { params, versions } = market.valuation;
  const inForce = versions.at(-1) ?? null;

  const listed = useMemo(
    () =>
      // A closed corporation's shares end with it: it stays in the journal only.
      market.companies
        .filter(
          (c) =>
            c.status !== "delisted" &&
            c.valuation?.listing &&
            c.valuation.listing.state !== "withdrawn",
        )
        .sort((a, b) => (b.valuation?.latest?.value ?? 0) - (a.valuation?.latest?.value ?? 0)),
    [market],
  );
  const journal = useMemo(
    () =>
      [...market.operations.values()]
        .flat()
        .map((op) => ({ op, company: market.byId.get(op.companyId) ?? null }))
        .sort((a, b) => b.op.date.localeCompare(a.op.date)),
    [market],
  );
  const valued = market.companies.filter((c) => c.status !== "delisted" && c.valuation?.latest);
  const total = valued.reduce((sum, c) => sum + (c.valuation?.latest?.value ?? 0), 0);

  return (
    <div className="bourse">
      <header className="page-head">
        <div>
          <h1>Bourse</h1>
          <p>
            KNX estime chaque jour la valeur de toutes les corporations cotées au rapport, et publie
            un cours par titre pour celles dont la direction a demandé l'introduction en bourse. Le
            cours est théorique : il suit les relevés et la notation de l'Agence, pas des ordres
            d'achat et de vente ; à chaque séance, le fixing s'en écarte selon les ordres des
            investisseurs. Les chiffres en violet sont calculés par KNX.
          </p>
        </div>
        <div className="bourse__head-actions">
          <Link className="button button--quiet" to="/compte">
            Espace investisseur
          </Link>
          {isAdmin ? (
            <>
              <Link className="button button--quiet" to="/bourse/seance">
                Séance
              </Link>
              <Link className="button button--quiet" to="/bourse/comptes">
                Comptes
              </Link>
              <Link className="button button--quiet" to="/bourse/reglages">
                Réglages et opérations
              </Link>
            </>
          ) : null}
        </div>
      </header>

      <dl className="bourse__facts">
        <div>
          <dt className="label">Corporations valorisées</dt>
          <dd className="bourse__figure">{valued.length}</dd>
          <dd className="bourse__detail">
            au relevé du <ImperialDate date={market.latestDate} />
          </dd>
        </div>
        <div>
          <dt className="label">Valeur de la cote</dt>
          <dd className="bourse__figure">
            <span className="estimated">{formatCompact(total)}</span>
            <span className="amount__unit"> ¢</span>
          </dd>
          <dd className="bourse__detail">somme des valeurs KNX</dd>
        </div>
        <div>
          <dt className="label">Introduites</dt>
          <dd className="bourse__figure">{listed.length}</dd>
          <dd className="bourse__detail">avec un cours par titre</dd>
        </div>
        <div>
          <dt className="label">Réglages</dt>
          <dd className="bourse__figure">
            {inForce ? <ImperialDate date={inForce.date} /> : "par défaut"}
          </dd>
          <dd className="bourse__detail">méthode {VALUATION_METHOD}</dd>
        </div>
      </dl>

      <section className="bourse__section" aria-labelledby="introduites">
        <div className="section-head">
          <h2 id="introduites">Corporations introduites</h2>
          <p>cours théorique par titre, par valeur décroissante</p>
        </div>
        {listed.length === 0 ? (
          <p className="bourse__note">
            Aucune corporation n'est encore introduite. Une direction qui veut ouvrir son capital
            s'adresse à KNX : elle choisit son nombre de titres, et son cours paraît dès le relevé
            suivant. En attendant, la valeur KNX de chaque corporation figure dans la cote et sur sa
            fiche.
          </p>
        ) : (
          <ListedTable listed={listed} />
        )}
      </section>

      <LastSession market={market} />

      <section className="bourse__section" aria-labelledby="methode">
        <div className="section-head">
          <h2 id="methode">Méthode</h2>
          <p>
            méthode {VALUATION_METHOD}
            {inForce ? (
              <>
                {" "}
                · réglages du <ImperialDate date={inForce.date} />
              </>
            ) : (
              " · réglages par défaut"
            )}
          </p>
        </div>
        <div className="bourse__method">
          <div className="bourse__formula">
            <p className="bourse__equation">
              <span>activité</span> = ( <span>jours de recettes</span> × <span>CA réel retenu</span>{" "}
              × <span>maturité</span> + <span>poids du capital</span> × <span>capital retenu</span>{" "}
              ) × <span>multiplicateur de l'Agence</span>
            </p>
            <p className="bourse__equation">
              <span>valeur</span> = <span>activité</span> + <span>local</span> + <span>stock</span>
            </p>
            <p className="bourse__equation">
              <span>cours</span> = <span>valeur</span> ÷ <span>titres</span>
            </p>
            <ul className="bourse__principles">
              <li>
                <strong>Le CA réel, pas le chiffre publié.</strong> Le jeu publie une moyenne depuis
                la création ; KNX reconstitue la recette de chaque jour et en lit la moyenne
                récente.
              </li>
              <li>
                <strong>Les pics écrêtés.</strong> Une direction peut se vendre un objet à n'importe
                quel prix, puis reprendre les crédits : un jour ne compte jamais plus que quelques
                jours ordinaires.
              </li>
              <li>
                <strong>Le capital prudent.</strong> Une injection ne compte que si elle dure, un
                retrait compte tout de suite ; et la trésorerie est décotée, car la direction peut
                la retirer.
              </li>
              <li>
                <strong>La notation de l'Agence.</strong> Sa catégorie multiplie la valeur de
                l'activité, sa confiance règle la fourchette. Sans notation, une décote d'opacité
                s'applique.
              </li>
              <li>
                <strong>Le local et le stock à part.</strong> Terrain, bâtiment et aménagement
                comptent selon ce qui se revend ; le stock à son prix d'achat, et il s'efface faute
                de nouveau chiffre. Un montant déclaré par la direction compte moins qu'un montant
                audité par l'Agence. Un terrain vaut son prix quelle que soit la notation : ces
                postes restent hors du multiplicateur et de la fourchette.
              </li>
              <li>
                <strong>Toute l'histoire avec les mêmes réglages.</strong> Quand KNX change un
                levier, toute la courbe est recalculée et le changement est publié ci-dessous : la
                série ne saute jamais un jour donné.
              </li>
              <li>
                <strong>Divisions et regroupements neutres.</strong> Le cours passé est ajusté au
                nombre de titres d'aujourd'hui : une division ne se lit jamais comme une chute.
              </li>
            </ul>
          </div>
          <table className="ledger ledger--levers">
            <caption className="sr-only">Réglages en vigueur</caption>
            <tbody>
              {LEVERS.map((l) => {
                const changed = l.read(params) !== l.read(DEFAULT_VALUATION);
                return (
                  <tr key={l.key}>
                    <th scope="row">{l.label}</th>
                    <td>
                      <span className={changed ? "bourse__changed" : undefined}>
                        {l.read(params)}
                      </span>
                      <span className="bourse__help">{l.help}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bourse__section" aria-labelledby="operations">
        <div className="section-head">
          <h2 id="operations">Opérations sur titres</h2>
          <p>introductions, divisions, regroupements, suspensions et sorties de cote</p>
        </div>
        {journal.length === 0 ? (
          <p className="bourse__note">Aucune opération enregistrée.</p>
        ) : (
          <ol className="bourse__journal">
            {journal.map(({ op, company }) => (
              <li key={op.id}>
                <ImperialDate date={op.date} />
                <span>
                  {company ? (
                    <Link to={`/corporations/${company.slug}`}>{company.name}</Link>
                  ) : (
                    "Corporation inconnue"
                  )}{" "}
                  · <strong>{OPERATION_INFO[op.kind].label}</strong>
                  {operationDetail(op) ? ` · ${operationDetail(op)}` : null}
                  {op.note ? <span className="bourse__muted"> — {op.note}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="bourse__section" aria-labelledby="reglages">
        <div className="section-head">
          <h2 id="reglages">Historique des réglages</h2>
          <p>chaque version publiée, la plus récente en vigueur</p>
        </div>
        {versions.length === 0 ? (
          <p className="bourse__note">
            Aucun réglage publié : KNX applique les réglages par défaut de la méthode{" "}
            {VALUATION_METHOD}.
          </p>
        ) : (
          <ol className="bourse__journal">
            {[...versions].reverse().map((v, index, list) => {
              const before = list[index + 1]?.params ?? DEFAULT_VALUATION;
              const changes = changedLevers(before, v.params);
              return (
                <li key={v.id}>
                  <ImperialDate date={v.date} />
                  <span>
                    <strong>{index === 0 ? "En vigueur" : "Remplacée"}</strong>
                    {v.note ? ` — ${v.note}` : null}
                    {changes.length > 0 ? (
                      <span className="bourse__changes">
                        {changes.map((c) => (
                          <span key={c}>{c}</span>
                        ))}
                      </span>
                    ) : (
                      <span className="bourse__muted"> · aucun levier modifié</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
