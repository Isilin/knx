import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Change, ImperialDate, Score } from "../components/figures.tsx";
import { Seal } from "../components/Seal.tsx";
import { TimeChart } from "../components/TimeChart.tsx";
import { useMarket } from "../data/DataProvider.tsx";
import { marketMarkers } from "../domain/marketEvents.ts";
import {
  formatCompact,
  formatDecimal,
  formatInteger,
  formatPercent,
  formatShare,
} from "../domain/numbers.ts";
import { sectorShort } from "../domain/sectors.ts";
import { districtSectors, eventShock, revenueQuality, supplyChain } from "../domain/studies.ts";
import "./SectorsPage.css";
import "./StudiesPage.css";

/** `+2 semaines`, `−1 semaine`, `même semaine`. */
function lagText(weeks: number): string {
  if (weeks === 0) return "la même semaine";
  const n = Math.abs(weeks);
  return `${n} semaine${n > 1 ? "s" : ""} ${weeks > 0 ? "après les usines" : "avant les usines"}`;
}

function SupplyChain() {
  const market = useMarket();
  const chain = useMemo(() => supplyChain(market), [market]);
  const markers = useMemo(() => marketMarkers(market.marketEvents), [market.marketEvents]);
  const strong = chain.best !== null && chain.best.r >= 0.3;
  return (
    <section className="sectors__section" aria-labelledby="filiere">
      <div className="section-head">
        <h2 id="filiere">De l'usine aux boutiques</h2>
        <p>
          <span className="estimated">recette réelle par jour</span> sur 30 jours, chaque heptade
        </p>
      </div>
      {chain.points.length < 2 ? (
        <p className="sectors__note">
          Pas assez de relevés couverts par les secteurs pour suivre la filière.
        </p>
      ) : (
        <div className="studies__pair">
          <div>
            <TimeChart
              label="Recette réelle par jour des usines et des boutiques qu'elles fournissent"
              formatValue={(v) => `${formatInteger(v)} ¢/j`}
              height={280}
              zeroBased
              markers={markers}
              series={[
                {
                  id: "upstream",
                  label: "Usines",
                  color: "var(--ivoire)",
                  points: chain.points.map((p) => ({ date: p.date, value: p.upstream })),
                },
                {
                  id: "downstream",
                  label: "Boutiques",
                  color: "var(--gris)",
                  points: chain.points.map((p) => ({ date: p.date, value: p.downstream })),
                },
              ]}
              endLabel={(s) => s.label}
            />
          </div>
          <div>
            <h3 className="label">Les boutiques suivent-elles les usines ?</h3>
            <p className="studies__lead">
              {chain.best === null
                ? "Trop peu d'heptades mesurables pour le dire."
                : strong
                  ? `Les variations se ressemblent le plus quand on lit les boutiques ${lagText(chain.best.lagWeeks)} (corrélation ${formatDecimal(chain.best.r)}).`
                  : `Aucun lien net : la plus forte corrélation ne dépasse pas ${formatDecimal(chain.best.r)}.`}
            </p>
            <ol
              className="lag-bars"
              aria-label="Corrélation selon le décalage des boutiques, en heptades"
            >
              {chain.correlations.map((c) => (
                <li
                  key={c.lagWeeks}
                  className={c.lagWeeks === chain.best?.lagWeeks ? "is-best" : undefined}
                  title={`${c.lagWeeks > 0 ? "+" : ""}${c.lagWeeks} : ${c.r === null ? "non mesurable" : formatDecimal(c.r)} (${c.n} paires)`}
                >
                  <span className="lag-bars__bar">
                    {c.r !== null ? (
                      <span
                        className={c.r >= 0 ? "is-up" : "is-down"}
                        style={{ height: `${Math.abs(c.r) * 50}%` }}
                      />
                    ) : null}
                  </span>
                  <span className="lag-bars__lag">
                    {c.lagWeeks % 2 === 0 ? (c.lagWeeks > 0 ? `+${c.lagWeeks}` : c.lagWeeks) : ""}
                  </span>
                </li>
              ))}
            </ol>
            <p className="sectors__note">
              Corrélation des variations sur quatre heptades, les boutiques (armes, équipement,
              spécialisées) décalées de −8 à +8 heptades : à droite, elles bougent après les usines.
              Lecture fragile : relevés irréguliers, petits secteurs, et un lien n'est pas une
              cause.
            </p>
          </div>
        </div>
      )}
      <p className="sectors__note">
        Les boutiques achètent au prix des usines : une part de la recette des usines est une
        dépense des boutiques. Seule la dernière période où les corporations classées font au moins
        90 % des recettes du marché est lue
        {chain.points.length > 0 ? (
          <>
            , depuis le <ImperialDate date={chain.points[0].date} />
          </>
        ) : null}
        .
      </p>
    </section>
  );
}

function Shock() {
  const market = useMarket();
  const events = market.marketEvents;
  const [eventId, setEventId] = useState(events.at(-1)?.id ?? null);
  const event = events.find((e) => e.id === eventId) ?? events.at(-1) ?? null;
  const shock = useMemo(() => (event ? eventShock(market, event) : null), [market, event]);
  return (
    <section className="sectors__section" aria-labelledby="choc">
      <div className="section-head">
        <h2 id="choc">Chocs de marché</h2>
        <p>ce qu'un évènement de marché a fait à chaque secteur</p>
        {events.length > 1 ? (
          <div className="push">
            <div className="segmented" role="group" aria-label="Évènement">
              {events.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  aria-pressed={e.id === event?.id}
                  onClick={() => setEventId(e.id)}
                >
                  {e.label ?? e.title}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {!event || !shock ? (
        <p className="sectors__note">
          Aucun évènement de marché encadré par des relevés. Les évènements se déclarent sur la page
          Relevés.
        </p>
      ) : (
        <>
          <p className="studies__lead">
            <strong>{event.title}</strong>, le <ImperialDate date={event.date} /> : relevé du{" "}
            <ImperialDate date={shock.before} /> face à celui du <ImperialDate date={shock.after} />
            .
          </p>
          <div className="sectors__scroll">
            <table className="sectors__table">
              <thead>
                <tr>
                  <th scope="col">Secteur</th>
                  <th scope="col" className="num">
                    Corporations
                  </th>
                  <th scope="col" className="num">
                    Capital avant
                  </th>
                  <th scope="col" className="num">
                    Capital après
                  </th>
                  <th scope="col" className="num" title="Corporations au-delà de 30 M¢ de capital">
                    Au-delà de 30 M¢
                  </th>
                  <th scope="col" className="num">
                    Recette, 30 j avant
                  </th>
                  <th scope="col" className="num">
                    Recette, 30 j après
                  </th>
                </tr>
              </thead>
              <tbody>
                {shock.rows.map((r) => (
                  <tr key={r.id}>
                    <th scope="row">{r.label}</th>
                    <td className="num">{r.companies}</td>
                    <td className="num">{formatCompact(r.capitalBefore)} ¢</td>
                    <td className="num">
                      {formatCompact(r.capitalAfter)} ¢{" "}
                      <Change
                        ratio={r.capitalBefore > 0 ? r.capitalAfter / r.capitalBefore - 1 : null}
                      />
                    </td>
                    <td className="num">
                      {r.exposedBefore} → {r.exposedAfter}
                    </td>
                    <td className="num">
                      <span className="estimated">{formatInteger(r.rateBefore)} ¢/j</span>
                    </td>
                    <td className="num">
                      <span className="estimated">{formatInteger(r.rateAfter)} ¢/j</span>{" "}
                      <Change
                        ratio={r.rateBefore > 0 ? r.rateAfter / r.rateBefore - 1 : null}
                        estimated
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="sectors__note">
            Capital publié des corporations cotées aux deux relevés, et leur recette réelle estimée
            sur les 30 jours avant l'évènement et les 30 jours après sa durée ({event.span} jour
            {event.span > 1 ? "s" : ""}). Secteurs du plus touché au moins touché.
            {shock.coverage !== null && shock.coverage < 0.9
              ? ` Les corporations classées ne tenaient que ${formatShare(shock.coverage)} du capital : bien des fermées n'ont pas encore de secteur.`
              : ""}
          </p>
        </>
      )}
    </section>
  );
}

function Districts() {
  const market = useMarket();
  const map = useMemo(() => districtSectors(market), [market]);
  return (
    <section className="sectors__section" aria-labelledby="quartiers">
      <div className="section-head">
        <h2 id="quartiers">Quartiers</h2>
        <p>où les secteurs sont implantés dans la cité</p>
      </div>
      <dl className="studies__districts">
        {map.columns.map((c) => (
          <div key={c.district ?? "aucun"}>
            <dt className="label">{c.label}</dt>
            <dd className="studies__district-value">
              <span className="estimated">{formatShare(c.weight)}</span>
            </dd>
            <dd className="studies__district-detail">
              {c.listed} corporation{c.listed > 1 ? "s" : ""} · dyn. <Score value={c.dynamics} />
            </dd>
          </div>
        ))}
      </dl>
      <div className="sectors__scroll">
        <table className="sectors__table">
          <thead>
            <tr>
              <th scope="col">Secteur</th>
              {map.columns.map((c) => (
                <th key={c.district ?? "aucun"} scope="col" className="num">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {map.rows.map((row) => (
              <tr key={row.sector}>
                <th scope="row">
                  <Link to={`/corporations?secteur=${row.sector}`}>{row.label}</Link>
                </th>
                {row.cells.slice(0, map.columns.length).map((cell, index) => (
                  <td key={map.columns[index].district ?? "aucun"} className="num">
                    {cell.listed === 0 ? (
                      <span className="sectors__empty">—</span>
                    ) : (
                      <>
                        {cell.listed}{" "}
                        <small className="estimated">{formatShare(cell.weight)}</small>
                      </>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sectors__note">
        En tête : part de chaque quartier dans les recettes du marché sur 30 jours, ses corporations
        cotées et leur dynamique médiane. Dans le tableau : corporations et part du marché, secteur
        par secteur. Le quartier se renseigne depuis la fiche de chaque corporation.
      </p>
    </section>
  );
}

function Quality() {
  const market = useMarket();
  const quality = useMemo(() => revenueQuality(market), [market]);
  return (
    <section className="sectors__section" aria-labelledby="qualite">
      <div className="section-head">
        <h2 id="qualite">Qualité des recettes</h2>
        <p>
          part des <span className="estimated">recettes</span> retrouvée dans le capital, sur cinq
          ans impériaux
        </p>
      </div>
      <div className="studies__pair">
        <div>
          <h3 className="label">Par secteur, médiane</h3>
          <ol className="retention-bars">
            {quality.sectors.map((s) => (
              <li key={s.sector}>
                <Link to={`/corporations?secteur=${s.sector}`}>{sectorShort(s.sector)}</Link>
                <span className="retention-bars__track" aria-hidden="true">
                  <span className="retention-bars__zero" />
                  {s.retention !== null ? (
                    <span
                      className={s.retention >= 0 ? "is-up" : "is-down"}
                      style={
                        s.retention >= 0
                          ? { left: "50%", width: `${Math.min(1, s.retention) * 50}%` }
                          : { right: "50%", width: `${Math.min(1, -s.retention) * 50}%` }
                      }
                    />
                  ) : null}
                </span>
                <span className="retention-bars__value">
                  {s.retention === null ? (
                    "—"
                  ) : (
                    <span className="estimated">{formatPercent(s.retention)}</span>
                  )}
                </span>
                <small>{s.measured}</small>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h3 className="label">Les rétentions les plus basses</h3>
          <ol className="studies__list">
            {quality.lowest.map((r) => (
              <li key={r.company.slug}>
                <Seal seed={r.company.sealSeed} size={18} />
                <Link to={`/corporations/${r.company.slug}#risque`}>{r.company.name}</Link>
                <span className="studies__list-sector">
                  {r.company.sector ? sectorShort(r.company.sector) : "—"}
                </span>
                <span className="estimated">{formatPercent(r.retention)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <p className="sectors__note">
        La rétention du profil de risque : ce que le capital a gagné (ou perdu) rapporté à la
        recette estimée sur la même fenêtre. Une rétention basse a plusieurs causes, salaires,
        achats, retraits, ou recettes gonflées par une vente à soi-même : KNX ne tranche pas. Les{" "}
        {quality.capped} corporations tenues près du seuil de piratage sont écartées, leurs sorties
        servant à rester sous 30 M¢. {quality.measured} corporations mesurées.
      </p>
    </section>
  );
}

export function StudiesPage() {
  const market = useMarket();
  return (
    <div className="sectors studies">
      <header className="page-head">
        <div>
          <h1>Études</h1>
          <p>
            Lectures exploratoires des secteurs au relevé du{" "}
            <ImperialDate date={market.latestDate} /> : la filière de production, les chocs de
            marché, la géographie de la cité et ce que deviennent les recettes. Des pistes, pas des
            verdicts ; les chiffres en violet sont estimés par KNX.
          </p>
        </div>
      </header>
      <SupplyChain />
      <Shock />
      <Districts />
      <Quality />
    </div>
  );
}
