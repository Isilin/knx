import { useMemo, useState } from "react";
import { Link } from "react-router";
import { groupColor, ImperialDate, Score } from "../components/figures.tsx";
import { PeriodPicker, periodStart, type PeriodId } from "../components/PeriodPicker.tsx";
import { Seal } from "../components/Seal.tsx";
import { TimeChart, type ChartSeries } from "../components/TimeChart.tsx";
import { Waterfall } from "../components/Waterfall.tsx";
import { useMarket } from "../data/DataProvider.tsx";
import {
  consortiumEffect,
  consortiumPortfolios,
  groupRace,
  growthContribution,
  type ConsortiumPortfolio,
  type EffectRow,
} from "../domain/groupHistory.ts";
import { slugify } from "../domain/market.ts";
import { marketMarkers } from "../domain/marketEvents.ts";
import {
  formatCompact,
  formatDecimal,
  formatInteger,
  formatScore,
  formatShare,
} from "../domain/numbers.ts";
import { sectorShort } from "../domain/sectors.ts";
import "./SectorsPage.css";
import "./ConsortiumsPage.css";

const WINDOWS = [30, 90] as const;

/** A window picker for the contribution: the last 30 or 90 days against the ones before. */
function WindowPicker({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  return (
    <div className="segmented" role="group" aria-label="Fenêtre">
      {WINDOWS.map((days) => (
        <button
          key={days}
          type="button"
          aria-pressed={value === days}
          onClick={() => onChange(days)}
        >
          {days} jours
        </button>
      ))}
    </div>
  );
}

function Race() {
  const market = useMarket();
  const [period, setPeriod] = useState<PeriodId>("12");
  // The independents earn several times any consortium: shown, they flatten the other lines.
  const [withIndependents, setWithIndependents] = useState(false);
  const start = periodStart(period, market.latestDate) ?? market.dates[0];
  const all = useMemo(() => groupRace(market, start, "consortium"), [market, start]);
  const races = withIndependents ? all : all.filter((r) => r.group.consortium !== null);
  const markers = useMemo(() => marketMarkers(market.marketEvents), [market.marketEvents]);
  const series: ChartSeries[] = races.map((r) => ({
    id: r.group.id,
    label: r.group.label,
    color: groupColor(r.group.consortium),
    points: r.points,
  }));
  const span =
    period === "all"
      ? "depuis le premier relevé"
      : period === "1"
        ? "sur la dernière année impériale"
        : `sur les ${period} dernières années impériales`;

  return (
    <section className="sectors__section" aria-labelledby="course-consortiums">
      <div className="section-head">
        <h2 id="course-consortiums">La course des consortiums</h2>
        <p>
          <span className="estimated">recette réelle cumulée</span> {span}
        </p>
        <div className="push market__map-tools">
          <div className="segmented" role="group" aria-label="Lignes">
            <button
              type="button"
              aria-pressed={!withIndependents}
              onClick={() => setWithIndependents(false)}
            >
              Consortiums seuls
            </button>
            <button
              type="button"
              aria-pressed={withIndependents}
              onClick={() => setWithIndependents(true)}
            >
              Avec les indépendantes
            </button>
          </div>
          <PeriodPicker value={period} onChange={setPeriod} />
        </div>
      </div>
      <TimeChart
        series={series}
        label={`Recette réelle estimée de chaque consortium et des indépendantes, cumulée ${span}`}
        formatValue={(v) => `${formatInteger(v)} ¢`}
        height={400}
        markers={markers}
        endLabel={(s, compact) => {
          const race = races.find((r) => r.group.id === s.id);
          if (compact) return s.label.slice(0, 3);
          return `${formatCompact(race?.total ?? 0)}  ${s.label}`;
        }}
      />
      <p className="sectors__note">
        Ce que chaque consortium a encaissé depuis le début de la période, toutes ses corporations
        réunies, fermées comprises. La recette d'une corporation va au consortium dont elle était
        membre le jour où elle l'a encaissée : si elle change de consortium, sa recette passe d'une
        ligne à l'autre à cette date. Les indépendantes, réunies, encaissent plusieurs fois plus que
        chaque consortium : affichées, elles écrasent les autres lignes.
      </p>
    </section>
  );
}

function Contribution() {
  const market = useMarket();
  const [days, setDays] = useState<number>(30);
  const growth = useMemo(() => growthContribution(market, days, "consortium"), [market, days]);
  return (
    <section className="sectors__section" aria-labelledby="contribution-consortiums">
      <div className="section-head">
        <h2 id="contribution-consortiums">Contribution à la croissance</h2>
        <p>
          <span className="estimated">recette réelle par jour</span>, les {days} derniers jours face
          aux {days} précédents
        </p>
        <div className="push">
          <WindowPicker value={days} onChange={setDays} />
        </div>
      </div>
      <Waterfall before={growth.before} after={growth.after} groups={growth.groups} days={days} />
      <p className="sectors__note">
        Ce que chaque consortium a gagné ou perdu de recette par jour d'une fenêtre à l'autre : les
        écarts s'additionnent pour donner celui du marché. Une corporation qui change de consortium
        compte pour chacun le temps qu'elle y a passé.
      </p>
    </section>
  );
}

function Portfolio({ portfolio }: { portfolio: ConsortiumPortfolio }) {
  const { consortium, members } = portfolio;
  const heaviest = Math.max(0, ...members.map((c) => c.recentRate ?? 0));
  return (
    <article className="portfolio" aria-labelledby={`portefeuille-${consortium.id}`}>
      <header className="portfolio__head">
        <i style={{ background: groupColor(consortium) }} aria-hidden="true" />
        <h3 id={`portefeuille-${consortium.id}`}>
          <Link to={`/corporations?groupe=${slugify(consortium.name)}`}>{consortium.name}</Link>
        </h3>
        <span>
          {members.length} membre{members.length > 1 ? "s" : ""} ·{" "}
          <span className="estimated">{formatShare(portfolio.weight)}</span> du marché
        </span>
      </header>

      <dl className="portfolio__facts">
        <div>
          <dt className="label">Recette par jour</dt>
          <dd className="estimated">{formatInteger(portfolio.recentRate)} ¢</dd>
        </div>
        <div>
          <dt
            className="label"
            title="Part des recettes du consortium faite par son premier membre"
          >
            Dépendance
          </dt>
          <dd>
            {portfolio.dependency === null ? (
              "—"
            ) : (
              <span className="estimated">{formatShare(portfolio.dependency)}</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="label">Secteurs</dt>
          <dd>{portfolio.bySector.length}</dd>
        </div>
      </dl>

      <ol className="portfolio__members">
        {members.map((c) => (
          <li key={c.slug}>
            <Seal seed={c.sealSeed} size={18} />
            <Link to={`/corporations/${c.slug}`}>{c.name}</Link>
            <span className="portfolio__sector">{c.sector ? sectorShort(c.sector) : "—"}</span>
            <span className="portfolio__bar" aria-hidden="true">
              {heaviest > 0 ? (
                <span style={{ width: `${((c.recentRate ?? 0) / heaviest) * 100}%` }} />
              ) : null}
            </span>
            <span className="portfolio__share">
              {portfolio.recentRate > 0 && c.recentRate !== null ? (
                <span className="estimated">
                  {formatShare(c.recentRate / portfolio.recentRate)}
                </span>
              ) : (
                "—"
              )}
            </span>
          </li>
        ))}
      </ol>

      <p className="portfolio__line">
        <span className="label">Par secteur</span>{" "}
        {portfolio.bySector.length === 0
          ? "—"
          : portfolio.bySector.map((s, i) => (
              <span key={s.group.id}>
                {i > 0 ? " · " : ""}
                {s.group.sector ? sectorShort(s.group.sector) : s.group.label}{" "}
                <span className="estimated">{formatShare(s.share)}</span>
              </span>
            ))}
      </p>
      <p className="portfolio__line">
        <span className="label">Mouvements</span>{" "}
        {portfolio.moves.length === 0
          ? "aucun mouvement daté"
          : portfolio.moves.slice(0, 6).map((m, i) => (
              <span key={`${m.company.slug}-${m.kind}-${m.date}`}>
                {i > 0 ? " · " : ""}
                {m.kind === "join" ? "entrée de " : "départ de "}
                <Link to={`/corporations/${m.company.slug}`}>{m.company.name}</Link> le{" "}
                <ImperialDate date={m.date} />
              </span>
            ))}
      </p>
      {portfolio.former.length > 0 ? (
        <p className="portfolio__line">
          <span className="label">Anciens membres</span>{" "}
          {portfolio.former.map((c, i) => (
            <span key={c.slug}>
              {i > 0 ? ", " : ""}
              <Link to={`/corporations/${c.slug}`}>{c.name}</Link>
              {c.status === "delisted" ? " (fermée)" : ""}
            </span>
          ))}
        </p>
      ) : null}
    </article>
  );
}

function effectValue(row: EffectRow, value: number | null): string {
  if (value === null) return "—";
  if (row.unit === "points") return formatScore(value);
  if (row.unit === "level") return `${formatDecimal(value)} /7`;
  return `${value >= 0 ? "+" : "−"}${formatShare(Math.abs(value))}`;
}

function Effect() {
  const market = useMarket();
  const effect = useMemo(() => consortiumEffect(market), [market]);
  return (
    <section className="sectors__section" aria-labelledby="effet-consortium">
      <div className="section-head">
        <h2 id="effet-consortium">Effet consortium</h2>
        <p>
          membres et indépendantes, chacune face à son secteur, sur les{" "}
          <span className="estimated">indicateurs KNX</span> du dernier relevé
        </p>
      </div>
      <div className="sectors__scroll">
        <table className="sectors__table effect">
          <thead>
            <tr>
              <th scope="col">Indicateur, médiane</th>
              <th scope="col" className="num">
                Membres <small>{effect.members} corporations</small>
              </th>
              <th scope="col" className="num">
                Indépendantes <small>{effect.independents} corporations</small>
              </th>
              <th scope="col">Lecture</th>
            </tr>
          </thead>
          <tbody>
            {effect.rows.map((row) => {
              // Below these gaps, small samples say nothing: 5 points, 5 %, half a level.
              const tolerance = row.unit === "level" ? 0.5 : 0.05;
              const gap =
                row.members === null || row.independents === null
                  ? null
                  : row.members - row.independents;
              const better =
                gap === null || Math.abs(gap) < tolerance ? null : gap > 0 === row.higherIsBetter;
              return (
                <tr key={row.id}>
                  <th scope="row">
                    {row.label}
                    <small>{row.help}</small>
                  </th>
                  <td className="num">
                    <span className="estimated">{effectValue(row, row.members)}</span>
                  </td>
                  <td className="num">
                    <span className="estimated">{effectValue(row, row.independents)}</span>
                  </td>
                  <td className="effect__reading">
                    {gap === null
                      ? "non mesurable"
                      : better === null
                        ? "écart faible"
                        : better
                          ? "à l'avantage des membres"
                          : "à l'avantage des indépendantes"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="sectors__note">
        Corporations actives classées par secteur. Chaque indicateur est lu face à la médiane du
        secteur de la corporation, pour que les secteurs de tailles inégales ne pèsent pas : une
        description sur de petits effectifs, pas la preuve qu'un consortium fait la différence.
      </p>

      <h3 className="label effect__moves-title">Avant et après chaque mouvement</h3>
      {effect.moves.length === 0 ? (
        <p className="sectors__note">
          Aucune adhésion ni aucun départ n'est encore daté. Datez-les depuis la fiche de chaque
          corporation : KNX comparera ici sa recette des 30 jours qui précèdent le mouvement à celle
          des 30 jours qui le suivent.
        </p>
      ) : (
        <div className="sectors__scroll">
          <table className="sectors__table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Mouvement</th>
                <th scope="col" className="num">
                  30 jours avant
                </th>
                <th scope="col" className="num">
                  Après
                </th>
                <th scope="col" className="num">
                  Écart
                </th>
              </tr>
            </thead>
            <tbody>
              {effect.moves.map((m) => (
                <tr key={`${m.company.slug}-${m.kind}-${m.date}`}>
                  <td>
                    <ImperialDate date={m.date} />
                  </td>
                  <td>
                    <Link to={`/corporations/${m.company.slug}`}>{m.company.name}</Link>{" "}
                    {m.kind === "join" ? "rejoint" : "quitte"} {m.consortium.name}
                  </td>
                  <td className="num">
                    <span className="estimated">{formatInteger(m.before ?? 0)} ¢/j</span>
                  </td>
                  <td className="num">
                    {m.after === null ? (
                      "trop récent"
                    ) : (
                      <span className="estimated">{formatInteger(m.after)} ¢/j</span>
                    )}
                  </td>
                  <td className="num">
                    {m.after === null || !m.before ? (
                      "—"
                    ) : (
                      <Score value={Math.tanh(m.after / m.before - 1)} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function ConsortiumsPage() {
  const market = useMarket();
  const portfolios = useMemo(() => consortiumPortfolios(market), [market]);
  const memberships = market.companies.flatMap((c) => c.memberships);
  const dated = memberships.some((m) => m.joinedOn !== null || m.leftOn !== null);
  const members = portfolios.reduce((sum, p) => sum + p.members.length, 0);

  return (
    <div className="sectors consortiums-page">
      <header className="page-head">
        <div>
          <h1>Consortiums</h1>
          <p>
            {portfolios.length} consortiums, {members} corporations cotées membres au relevé du{" "}
            <ImperialDate date={market.latestDate} /> : ce que chacun encaisse, d'où viennent ses
            recettes et ce que l'appartenance change. Les chiffres en violet sont estimés par KNX.
          </p>
          {!dated ? (
            <p className="consortiums-page__warning">
              Aucune adhésion n'est encore datée : chaque consortium compte ses membres actuels sur
              tout l'historique. Datez entrées et départs depuis la fiche des corporations.
            </p>
          ) : null}
        </div>
      </header>
      {portfolios.length === 0 ? (
        <p className="sectors__note">Aucun consortium n'est encore déclaré.</p>
      ) : (
        <>
          <Race />
          <Contribution />
          <section className="sectors__section" aria-labelledby="portefeuilles">
            <div className="section-head">
              <h2 id="portefeuilles">Portefeuilles</h2>
              <p>
                chaque consortium comme une holding, sur les{" "}
                <span className="estimated">recettes des 30 jours</span>
              </p>
            </div>
            <div className="portfolios">
              {portfolios.map((p) => (
                <Portfolio key={p.consortium.id} portfolio={p} />
              ))}
            </div>
          </section>
          <Effect />
        </>
      )}
    </div>
  );
}
