import { Link } from "react-router";
import type { CompanySeries } from "../domain/market.ts";
import { formatScore, formatShare } from "../domain/numbers.ts";
import {
  SECTOR_COVERAGE,
  type SectorSharePoint,
  type SectorSummary,
} from "../domain/sectorStats.ts";
import { sectorPlural } from "../domain/sectors.ts";
import { ImperialDate, Score } from "./figures.tsx";
import { Seal } from "./Seal.tsx";
import { TimeChart, type ChartMarker } from "./TimeChart.tsx";
import "./SectorPanel.css";

/** `1ʳᵉ`, `2ᵉ`: a corporation's place, feminine. */
const ordinal = (rank: number) => (rank === 1 ? "1ʳᵉ" : `${rank}ᵉ`);

/**
 * A corporation among the others of its sector: its share of the sector's revenue, its rank, how
 * its dynamics compare with the sector's median, the listed peers side by side, and its share
 * over time.
 */
export function SectorPanel({
  company,
  summary,
  peers,
  history,
  markers,
}: {
  company: CompanySeries;
  summary: SectorSummary;
  /** Listed corporations of the sector, heaviest first. */
  peers: readonly CompanySeries[];
  history: readonly SectorSharePoint[];
  markers: readonly ChartMarker[];
}) {
  const plural = sectorPlural(summary.id);
  const heaviest = Math.max(0, ...peers.map((p) => p.scores.sectorWeight ?? 0));
  const drawn = history.filter((p) => p.value !== null);
  const { sectorRank, scores } = company;

  return (
    <section className="company__sector" aria-labelledby="secteur">
      <div className="section-head">
        <h2 id="secteur">Dans son secteur</h2>
        <p>
          {summary.label} · {summary.listed} corporation{summary.listed > 1 ? "s" : ""} cotée
          {summary.listed > 1 ? "s" : ""}
        </p>
        <Link className="push backlink" to={`/corporations?secteur=${summary.id}`}>
          Les {plural} dans la cote
        </Link>
      </div>

      <dl className="kpis kpis--sector">
        <div className="kpi">
          <dt className="label">Poids dans le secteur</dt>
          <dd className="kpi__value">
            {scores.sectorWeight === null ? (
              "—"
            ) : (
              <span className="estimated" title="Estimé par KNX">
                {formatShare(scores.sectorWeight)}
              </span>
            )}
          </dd>
          <dd className="kpi__detail">des recettes des {plural} sur 30 jours</dd>
        </div>
        <div className="kpi">
          <dt className="label">Rang dans le secteur</dt>
          <dd className="kpi__value">
            {sectorRank ? (
              <span className="estimated" title="Classement KNX par les recettes estimées">
                {ordinal(sectorRank.rank)}
                <span className="amount__unit"> sur {sectorRank.of}</span>
              </span>
            ) : (
              "—"
            )}
          </dd>
          <dd className="kpi__detail">par les recettes des 30 derniers jours</dd>
        </div>
        <div className="kpi">
          <dt className="label">Face au secteur</dt>
          <dd className="kpi__value">
            <Score value={scores.dynamicsVsSector} />
          </dd>
          <dd className="kpi__detail">
            {scores.dynamics !== null && summary.dynamics !== null ? (
              <span>
                dynamique {formatScore(scores.dynamics)} contre {formatScore(summary.dynamics)} pour
                la médiane
                {scores.activityVsSector !== null
                  ? ` · activité ${formatScore(scores.activityVsSector)}`
                  : ""}
              </span>
            ) : (
              "dynamique non mesurable"
            )}
          </dd>
        </div>
        <div className="kpi">
          <dt className="label">Le secteur</dt>
          <dd className="kpi__value">
            {summary.weight === null ? (
              "—"
            ) : (
              <span className="estimated" title="Estimé par KNX">
                {formatShare(summary.weight)}
              </span>
            )}
          </dd>
          <dd className="kpi__detail">
            des recettes du marché
            {summary.dynamics !== null
              ? ` · dynamique médiane ${formatScore(summary.dynamics)}`
              : ""}
          </dd>
        </div>
      </dl>

      <div className="company__sector-grid">
        <div>
          <h3 className="label">Les {plural} cotées</h3>
          <ol className="sector-peers">
            {peers.map((peer) => {
              const self = peer.slug === company.slug;
              const share = peer.scores.sectorWeight;
              return (
                <li
                  key={peer.slug}
                  className={self ? "is-self" : undefined}
                  aria-current={self ? "true" : undefined}
                >
                  <span className="sector-peers__rank">{peer.sectorRank?.rank ?? "—"}</span>
                  <Seal seed={peer.sealSeed} size={20} />
                  <span className="sector-peers__name">
                    {self ? peer.name : <Link to={`/corporations/${peer.slug}`}>{peer.name}</Link>}
                  </span>
                  <span className="sector-peers__bar" aria-hidden="true">
                    {share !== null && heaviest > 0 ? (
                      <span style={{ width: `${(share / heaviest) * 100}%` }} />
                    ) : null}
                  </span>
                  <span className="sector-peers__share">
                    {share === null ? "—" : <span className="estimated">{formatShare(share)}</span>}
                  </span>
                  <Score value={peer.scores.dynamics} />
                </li>
              );
            })}
          </ol>
          <p className="company__note">
            Part de chaque corporation dans les recettes estimées du secteur sur 30 jours, et sa
            dynamique (30 derniers jours face aux 90 précédents). « Face au secteur » compare la
            dynamique de la corporation à la médiane des corporations cotées du secteur : un pic de
            recettes isolé ne déplace pas la référence.
          </p>
        </div>

        <div>
          <h3 className="label">Part du secteur dans le temps</h3>
          {drawn.length > 1 ? (
            <TimeChart
              label={`Part de ${company.name} dans les recettes des ${plural}`}
              formatValue={(v) => formatShare(v)}
              height={240}
              zeroBased
              markers={markers}
              series={[
                {
                  id: "share",
                  label: "Part du secteur",
                  color: "var(--estime)",
                  kind: "trend",
                  points: [...history],
                },
              ]}
            />
          ) : (
            <p className="company__empty">Pas assez de relevés mesurables pour tracer la part.</p>
          )}
          <p className="company__note">
            Recettes des 30 jours précédant chaque relevé. Les secteurs des corporations fermées ne
            sont pas tous connus : la part n'est tracée qu'aux relevés où les corporations classées
            font au moins {Math.round(SECTOR_COVERAGE * 100)} % des recettes du marché
            {drawn.length > 0 ? (
              <>
                , depuis le <ImperialDate date={drawn[0].date} />
              </>
            ) : null}
            .
          </p>
        </div>
      </div>
    </section>
  );
}
