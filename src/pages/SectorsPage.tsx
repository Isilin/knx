import { useMemo, useState } from "react";
import { Link } from "react-router";
import { groupColor, ImperialDate, Score } from "../components/figures.tsx";
import { Seal } from "../components/Seal.tsx";
import { useMarket } from "../data/DataProvider.tsx";
import { slugify } from "../domain/market.ts";
import { formatCompact, formatDecimal, formatInteger, formatShare } from "../domain/numbers.ts";
import {
  concentrationOf,
  sectorConsortiumMatrix,
  type SectorSummary,
} from "../domain/sectorStats.ts";
import { sectorPlural } from "../domain/sectors.ts";
import "./SectorsPage.css";

interface Measure {
  id: string;
  label: string;
  value: (s: SectorSummary) => number | null;
  format: (v: number) => string;
  help: string;
  /** Estimated by KNX (violet), rather than read from the report. */
  estimated: boolean;
}

const MEASURES: readonly Measure[] = [
  {
    id: "revenue",
    label: "Recettes",
    value: (s) => s.weight,
    format: formatShare,
    help: "Part du secteur dans les recettes estimées de tout le marché sur les 30 derniers jours.",
    estimated: true,
  },
  {
    id: "listed",
    label: "Corporations",
    value: (s) => s.listed,
    format: formatInteger,
    help: "Corporations cotées classées dans le secteur.",
    estimated: false,
  },
  {
    id: "employees",
    label: "Effectif",
    value: (s) => s.employees,
    format: (v) => `${formatInteger(v)} employés`,
    help: "Effectif publié par le jeu, DG compris, de toutes les corporations cotées du secteur.",
    estimated: false,
  },
  {
    id: "capital",
    label: "Capital",
    value: (s) => s.capital,
    format: (v) => `${formatCompact(v)} ¢`,
    help: "Capital publié par le jeu de toutes les corporations cotées du secteur.",
    estimated: false,
  },
  {
    id: "perEmployee",
    label: "Recette par employé",
    value: (s) => s.revenuePerEmployee,
    format: (v) => `${formatInteger(v)} ¢/j`,
    help: "Médiane des corporations actives du secteur : recette réelle estimée par jour sur 30 jours, divisée par l'effectif publié (DG compris). Une médiane : un pic de recettes isolé ne la déplace pas.",
    estimated: true,
  },
  {
    id: "toCapital",
    label: "Recettes / capital",
    value: (s) => s.revenueToCapital,
    format: formatShare,
    help: "Médiane des corporations actives du secteur : recettes estimées des 30 derniers jours rapportées au capital publié. Beaucoup de corporations gardent leur capital sous 30 M¢, le seuil de piratage : le ratio dit ce que rapporte le capital qu'elles conservent.",
    estimated: true,
  },
];

/** The sectors side by side on one measure, heaviest first. */
function SectorBars({ sectors }: { sectors: readonly SectorSummary[] }) {
  const [measureId, setMeasureId] = useState(MEASURES[0].id);
  const measure = MEASURES.find((m) => m.id === measureId) ?? MEASURES[0];
  const rows = sectors
    .map((sector) => ({ sector, value: measure.value(sector) }))
    .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
  const highest = Math.max(0, ...rows.map((r) => r.value ?? 0));

  return (
    <section className="sectors__section" aria-labelledby="secteurs-mesure">
      <div className="section-head">
        <h2 id="secteurs-mesure">Les secteurs</h2>
        <p>{measure.label.toLowerCase()}, du plus grand au plus petit</p>
        <div className="push">
          <div className="segmented" role="group" aria-label="Mesure">
            {MEASURES.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={m.id === measure.id}
                onClick={() => setMeasureId(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <ol className="sector-bars">
        {rows.map(({ sector, value }) => (
          <li key={sector.id}>
            <Link className="sector-bars__name" to={`/corporations?secteur=${sector.id}`}>
              {sector.label}
            </Link>
            <span className="sector-bars__bar" aria-hidden="true">
              {value !== null && highest > 0 ? (
                <span style={{ width: `${(Math.max(0, value) / highest) * 100}%` }} />
              ) : null}
            </span>
            <span className="sector-bars__value">
              {value === null ? (
                "—"
              ) : measure.estimated ? (
                <span className="estimated">{measure.format(value)}</span>
              ) : (
                measure.format(value)
              )}
            </span>
            <span className="sector-bars__detail">
              {sector.listed} corporation{sector.listed > 1 ? "s" : ""}
              <span className="sector-bars__dynamics" title="Dynamique médiane du secteur">
                dyn. <Score value={sector.dynamics} />
              </span>
            </span>
          </li>
        ))}
      </ol>
      <p className="sectors__note">
        {measure.help} La dynamique est la médiane des corporations cotées du secteur (30 derniers
        jours face aux 90 précédents). Chaque secteur ouvre la cote filtrée sur lui.
      </p>
    </section>
  );
}

/** How the revenue of each sector is shared out among its corporations. */
function Concentration({ sectors }: { sectors: readonly SectorSummary[] }) {
  const rows = sectors.filter((s) => s.hhi !== null).sort((a, b) => (b.hhi ?? 0) - (a.hhi ?? 0));
  return (
    <section className="sectors__section" aria-labelledby="concentration">
      <div className="section-head">
        <h2 id="concentration">Concentration</h2>
        <p>
          qui tient chaque secteur, sur les <span className="estimated">recettes des 30 jours</span>
        </p>
      </div>
      <div className="sectors__scroll">
        <table className="sectors__table">
          <thead>
            <tr>
              <th scope="col">Secteur</th>
              <th scope="col">Concentration</th>
              <th
                scope="col"
                className="num"
                title="Nombre de corporations de même taille qui donneraient la même concentration"
              >
                Concurrents équivalents
              </th>
              <th scope="col">Leader</th>
              <th scope="col" className="num">
                Part du leader
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((sector) => {
              const level = concentrationOf(sector.hhi ?? 0);
              return (
                <tr key={sector.id}>
                  <th scope="row">
                    <Link to={`/corporations?secteur=${sector.id}`}>{sector.label}</Link>
                    <small>
                      {sector.listed} corporation{sector.listed > 1 ? "s" : ""}
                    </small>
                  </th>
                  <td>
                    <span className={`concentration concentration--${level.id}`} title={level.help}>
                      {level.label}
                    </span>
                  </td>
                  <td className="num">
                    <span className="estimated">{formatDecimal(1 / (sector.hhi ?? 1))}</span>
                  </td>
                  <td>
                    {sector.leader ? (
                      <span className="sectors__company">
                        <Seal seed={sector.leader.company.sealSeed} size={18} />
                        <Link to={`/corporations/${sector.leader.company.slug}`}>
                          {sector.leader.company.name}
                        </Link>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="num">
                    {sector.leader ? (
                      <span className="estimated">{formatShare(sector.leader.share)}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="sectors__note">
        Indice de Herfindahl : la somme des carrés des parts de recettes des corporations cotées du
        secteur. « Concurrents équivalents » en est l'inverse : 2,0 se lit comme deux corporations
        de même taille, quel que soit le nombre réel. Ouvert sous 0,15, modérément concentré jusqu'à
        0,25, concentré jusqu'à 0,5, dominé au-delà : une corporation y fait l'essentiel des
        recettes.
      </p>
    </section>
  );
}

/** Each consortium sector by sector, the independent corporations last. */
function Matrix() {
  const market = useMarket();
  const matrix = useMemo(() => sectorConsortiumMatrix(market), [market]);
  return (
    <section className="sectors__section" aria-labelledby="matrice">
      <div className="section-head">
        <h2 id="matrice">Secteurs et consortiums</h2>
        <p>
          où chaque consortium est présent au relevé du <ImperialDate date={market.latestDate} />
        </p>
      </div>
      <div className="sectors__scroll">
        <table className="sectors__table sectors__matrix">
          <thead>
            <tr>
              <th scope="col">Secteur</th>
              {matrix.columns.map((col) => (
                <th key={col.consortium?.id ?? "independantes"} scope="col">
                  <span className="sectors__group">
                    {col.consortium ? (
                      <i style={{ background: groupColor(col.consortium) }} aria-hidden="true" />
                    ) : null}
                    {col.consortium ? (
                      <Link to={`/corporations?groupe=${slugify(col.consortium.name)}`}>
                        {col.consortium.name}
                      </Link>
                    ) : (
                      "Indépendantes"
                    )}
                  </span>
                  <small>
                    {col.listed} · <span className="estimated">{formatShare(col.weight)}</span>
                  </small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map(({ sector, cells }) => (
              <tr key={sector.id}>
                <th scope="row">
                  <Link to={`/corporations?secteur=${sector.id}`}>{sector.label}</Link>
                </th>
                {cells.map((cell, index) => (
                  <td key={matrix.columns[index].consortium?.id ?? "independantes"}>
                    {cell.length === 0 ? (
                      <span className="sectors__empty">—</span>
                    ) : (
                      <ul className="sectors__members">
                        {cell.map((c) => (
                          <li key={c.slug}>
                            <Link to={`/corporations/${c.slug}`}>{c.name}</Link>
                            {c.scores.sectorWeight !== null ? (
                              <span
                                className="estimated"
                                title={`${formatShare(c.scores.sectorWeight)} des recettes des ${sectorPlural(sector.id)}`}
                              >
                                {formatShare(c.scores.sectorWeight)}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sectors__note">
        En tête de colonne : corporations cotées et part des recettes du marché sur 30 jours. Dans
        chaque case, la part de la corporation dans les recettes de son secteur. Les consortiums
        sont ceux du dernier relevé.
        {matrix.unfiled.length > 0
          ? ` Sans secteur : ${matrix.unfiled.map((c) => c.name).join(", ")}.`
          : ""}
      </p>
    </section>
  );
}

export function SectorsPage() {
  const market = useMarket();
  const sectors = [...market.sectors.values()].filter((s) => s.listed > 0);
  const filed = sectors.reduce((sum, s) => sum + s.listed, 0);

  return (
    <div className="sectors">
      <header className="page-head">
        <div>
          <h1>Secteurs</h1>
          <p>
            Les {filed} corporations cotées classées en {sectors.length} secteurs au relevé du{" "}
            <ImperialDate date={market.latestDate} /> : ce que pèse chaque secteur, qui le tient et
            où sont les consortiums. Les chiffres en violet sont estimés par KNX.
          </p>
        </div>
      </header>
      {sectors.length === 0 ? (
        <p className="sectors__note">
          Aucune corporation cotée n'est encore classée par secteur : le secteur se renseigne depuis
          chaque fiche.
        </p>
      ) : (
        <>
          <SectorBars sectors={sectors} />
          <Concentration sectors={sectors} />
          <Matrix />
        </>
      )}
    </div>
  );
}
