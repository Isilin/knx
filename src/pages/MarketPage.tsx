import { useMemo, useState } from "react";
import { Link } from "react-router";
import { CoteTable } from "../components/CoteTable.tsx";
import {
  Amount,
  Change,
  Estimated,
  groupColor,
  ImperialDate,
  RankChange,
} from "../components/figures.tsx";
import { PeriodPicker, periodStart, type PeriodId } from "../components/PeriodPicker.tsx";
import { Seal } from "../components/Seal.tsx";
import { TimeChart, type ChartSeries } from "../components/TimeChart.tsx";
import { useMarket } from "../data/DataProvider.tsx";
import { formatImperialDate, formatPti } from "../domain/imperial.ts";
import { smoothedRealDaily, type CompanySeries } from "../domain/market.ts";
import { computeMovers } from "../domain/movers.ts";
import { formatCompact, formatDecimal, formatInteger } from "../domain/numbers.ts";
import { marketTreasury, type MarketTreasuryPoint } from "../domain/treasury.ts";
import { useFocus } from "../hooks/focus.tsx";
import { useFollowed } from "../hooks/useFollowed.ts";
import "./MarketPage.css";

function Fact({
  label,
  children,
  detail,
}: {
  label: string;
  children: React.ReactNode;
  detail?: React.ReactNode;
}) {
  return (
    <div className="fact">
      <dt className="label">{label}</dt>
      <dd className="fact__value">{children}</dd>
      {detail ? <dd className="fact__detail">{detail}</dd> : null}
    </div>
  );
}

function names(list: string[]): string {
  if (list.length === 0) return "aucune";
  return list.length <= 2
    ? list.join(", ")
    : `${list.slice(0, 2).join(", ")} et ${list.length - 2} autre${list.length > 3 ? "s" : ""}`;
}

function MoverRow({ company, kind }: { company: CompanySeries; kind: "performance" | "rank" }) {
  const { focused, setFocused } = useFocus();
  return (
    <li
      className={focused === company.slug ? "is-focused" : undefined}
      onMouseEnter={() => setFocused(company.slug)}
      onMouseLeave={() => setFocused(null)}
    >
      <Seal name={company.name} size={20} />
      <span className="mover__name">
        <Link to={`/corporations/${company.slug}`}>{company.name}</Link>
        {kind === "performance" ? (
          <small>
            CA réel{" "}
            <Estimated value={company.latest.realDaily} noise={company.latest.realDailyNoise} />
          </small>
        ) : (
          <small>
            rang {company.previous?.rank} → {company.latest.rank}
          </small>
        )}
      </span>
      {kind === "performance" ? (
        <Change ratio={company.latest.performance} estimated />
      ) : (
        <RankChange value={company.rankChange} />
      )}
    </li>
  );
}

/** Capital and headcount of the whole listing, on the reports that publish them. */
function TreasurySection({ points }: { points: MarketTreasuryPoint[] }) {
  const [period, setPeriod] = useState<PeriodId>("all");
  if (points.length === 0) return null;
  const start = periodStart(period, points[points.length - 1].date);
  // The latest report is always inside the period, so `visible` is never empty.
  const visible = points.filter((p) => !start || p.date >= start);
  const first = visible[0];
  const last = visible[visible.length - 1];
  const ratio = (to: number, from: number) => (visible.length > 1 && from ? to / from - 1 : null);
  let steepest: { drop: number; date: string } | null = null;
  for (let k = 1; k < visible.length; k++) {
    const drop = visible[k].capital - visible[k - 1].capital;
    if (drop < 0 && (!steepest || drop < steepest.drop)) steepest = { drop, date: visible[k].date };
  }

  return (
    <section className="market__treasury" aria-labelledby="tresorerie">
      <div className="section-head">
        <h2 id="tresorerie">Trésorerie de la cote</h2>
        <p>capital et effectifs publiés, toutes corporations cotées</p>
        <div className="push">
          <PeriodPicker value={period} onChange={setPeriod} />
        </div>
      </div>
      <div className="treasury-pair">
        <div>
          <dl className="treasury-figure">
            <dt className="label">Capital total</dt>
            <dd className="treasury-figure__value">
              <Amount value={last.capital} />
            </dd>
            <dd className="treasury-figure__detail">
              <Change ratio={ratio(last.capital, first.capital)} /> depuis le{" "}
              <ImperialDate date={first.date} />
              {steepest ? (
                <>
                  {" "}
                  · plus forte baisse sur un relevé : −{formatCompact(-steepest.drop)} ¢ le{" "}
                  <ImperialDate date={steepest.date} />
                </>
              ) : null}
            </dd>
          </dl>
          <TimeChart
            label={`Capital total des corporations cotées, ${period === "all" ? "depuis le premier relevé du capital" : `${period} derniers ans impériaux`}`}
            formatValue={(v) => `${formatInteger(v)} ¢`}
            height={220}
            series={[
              {
                id: "capital",
                label: "Capital total",
                color: "var(--ivoire)",
                points: visible.map((p) => ({ date: p.date, value: p.capital })),
              },
            ]}
          />
        </div>
        <div>
          <dl className="treasury-figure">
            <dt className="label">Effectif total</dt>
            <dd className="treasury-figure__value">
              {formatInteger(last.employees)}
              <span className="fact__unit">employés</span>
            </dd>
            <dd className="treasury-figure__detail">
              <Change ratio={ratio(last.employees, first.employees)} /> · {last.companies}{" "}
              corporations, {formatDecimal(last.employees / last.companies)} employés par
              corporation
            </dd>
          </dl>
          <TimeChart
            label="Effectif total des corporations cotées"
            formatValue={(v) => `${formatInteger(v)} employés`}
            height={220}
            series={[
              {
                id: "employees",
                label: "Effectif total",
                color: "var(--ivoire)",
                points: visible.map((p) => ({ date: p.date, value: p.employees })),
              },
            ]}
          />
        </div>
      </div>
      <p className="chart-note">
        Sommes des valeurs publiées par le jeu pour les corporations cotées ce jour-là : une entrée
        ou une radiation déplace aussi le total.{" "}
        <span className="chart-note__source">
          Source : rapport « Corporations », capital et effectifs relevés depuis le{" "}
          <ImperialDate date={points[0].date} /> ({points.length} relevés).
        </span>
      </p>
    </section>
  );
}

export function MarketPage() {
  const market = useMarket();
  const { focused, setFocused } = useFocus();
  const { followed } = useFollowed();
  const [period, setPeriod] = useState<PeriodId>("1");
  const [metric, setMetric] = useState<"chiffre" | "real">("chiffre");
  const movers = useMemo(() => computeMovers(market, 4), [market]);
  const treasury = useMemo(() => marketTreasury(market), [market]);
  const { facts } = market;

  const top = useMemo(
    () => market.companies.filter((c) => c.status === "active").slice(0, 10),
    [market],
  );
  const series = useMemo<ChartSeries[]>(() => {
    const start = periodStart(period, market.latestDate);
    return top.map((c) => {
      const values =
        metric === "chiffre"
          ? c.points.map((p) => ({ date: p.date, value: p.chiffre }))
          : smoothedRealDaily(c.points);
      return {
        id: c.slug,
        label: c.name,
        color: c.group ? groupColor(c.group) : "var(--ivoire)",
        points: values.filter((p) => !start || p.date >= start),
      };
    });
  }, [top, period, metric, market.latestDate]);

  const pinned = followed.filter((slug) => top.some((c) => c.slug === slug));

  return (
    <div className="market">
      <h1 className="sr-only">Marché du {formatImperialDate(market.latestDate)}</h1>

      <dl className="facts" aria-label="Faits du relevé">
        <Fact
          label="Relevé"
          detail={`${formatPti(facts.date)} · n° ${market.dates.length} depuis le ${formatImperialDate(market.dates[0])}`}
        >
          <ImperialDate date={facts.date} />
        </Fact>
        <Fact
          label="Écart"
          detail={
            facts.previousDate
              ? `depuis le ${formatImperialDate(facts.previousDate)}`
              : "premier relevé"
          }
        >
          {facts.gap ?? "—"}
          <span className="fact__unit">{facts.gap === 1 ? "jour" : "jours"}</span>
        </Fact>
        <Fact label="Cotées">{facts.listed}</Fact>
        <Fact label="Actives" detail={`${movers.silent.length} sans recette sur la période`}>
          {facts.active}
        </Fact>
        <Fact label="À l'arrêt" detail="chiffre publié à 0">
          {facts.idle}
        </Fact>
        <Fact
          label="Entrées · sorties"
          detail={`${names(facts.newcomers)} · ${names(facts.delisted)}`}
        >
          {facts.newcomers.length}
          <span className="fact__sep">·</span>
          {facts.delisted.length}
        </Fact>
      </dl>

      <div className="market__main">
        <section className="market__chart" aria-labelledby="top10">
          <div className="section-head">
            <h2 id="top10">Les dix premières</h2>
            <div className="segmented" role="group" aria-label="Mesure">
              <button
                type="button"
                aria-pressed={metric === "chiffre"}
                onClick={() => setMetric("chiffre")}
              >
                CA publié
              </button>
              <button
                type="button"
                aria-pressed={metric === "real"}
                onClick={() => setMetric("real")}
              >
                <span className="estimated">CA réel, moyenne 30 j</span>
              </button>
            </div>
            <div className="push">
              <PeriodPicker value={period} onChange={setPeriod} />
            </div>
          </div>
          <TimeChart
            series={series}
            label={`${metric === "chiffre" ? "CA publié" : "CA réel estimé, moyenne sur 30 jours,"} des dix premières corporations, ${period === "all" ? "tout l'historique" : `${period} derniers jours`}`}
            formatValue={(v) => `${formatInteger(v)} ¢/j`}
            focusId={focused}
            onFocus={setFocused}
            pinned={pinned}
            height={470}
            zeroBased={metric === "real"}
            endLabel={(s, compact) => {
              const company = top.find((c) => c.slug === s.id);
              if (compact) return company ? String(company.latest.rank) : "";
              const name = s.label.length > 19 ? `${s.label.slice(0, 18)}…` : s.label;
              return company ? `${company.latest.rank}  ${name}` : name;
            }}
          />
          <p className="chart-note">
            {metric === "chiffre"
              ? "Moyenne quotidienne depuis la création, telle que publiée par le jeu : elle bouge lentement chez les corporations anciennes."
              : "Recette par jour estimée par KNX, lissée sur les 30 jours précédant chaque relevé."}{" "}
            <span className="chart-note__source">
              Source : rapport « Corporations », {market.dates.length} relevés du{" "}
              <ImperialDate date={market.dates[0]} /> au <ImperialDate date={market.latestDate} />.
            </span>
          </p>
          <ol className="legend" aria-label="Légende">
            {top.map((c) => (
              <li
                key={c.slug}
                className={`${focused === c.slug ? "is-focused" : ""} ${focused && focused !== c.slug ? "is-dim" : ""}`}
                onMouseEnter={() => setFocused(c.slug)}
                onMouseLeave={() => setFocused(null)}
              >
                <i
                  style={{ background: c.group ? groupColor(c.group) : "var(--ivoire)" }}
                  aria-hidden="true"
                />
                <span className="legend__rank">{c.latest.rank}</span>
                <Link to={`/corporations/${c.slug}`}>{c.name}</Link>
              </li>
            ))}
          </ol>
        </section>

        <aside className="movers" aria-labelledby="movers">
          <div className="section-head">
            <h2 id="movers">Mouvements</h2>
            <p>
              sur {facts.gap ?? 0} jour{(facts.gap ?? 0) > 1 ? "s" : ""}, face à leur moyenne
            </p>
          </div>
          <h3 className="label">Au-dessus de leur moyenne</h3>
          {movers.up.length > 0 ? (
            <ul className="mover-list">
              {movers.up.map((c) => (
                <MoverRow key={c.slug} company={c} kind="performance" />
              ))}
            </ul>
          ) : (
            <p className="movers__empty">Aucune corporation n'a dépassé sa moyenne.</p>
          )}
          <h3 className="label">Sous leur moyenne</h3>
          {movers.down.length > 0 ? (
            <ul className="mover-list">
              {movers.down.map((c) => (
                <MoverRow key={c.slug} company={c} kind="performance" />
              ))}
            </ul>
          ) : (
            <p className="movers__empty">Aucune.</p>
          )}
          {movers.climbers.length > 0 ? (
            <>
              <h3 className="label">Places gagnées</h3>
              <ul className="mover-list">
                {movers.climbers.map((c) => (
                  <MoverRow key={c.slug} company={c} kind="rank" />
                ))}
              </ul>
            </>
          ) : null}
          <p className="movers__silent">
            <strong>{movers.silent.length}</strong> corporation{movers.silent.length > 1 ? "s" : ""}{" "}
            sans recette mesurable sur la période
            {movers.silent.length > 0 ? ` : ${names(movers.silent.map((c) => c.name))}.` : "."}
          </p>
        </aside>
      </div>

      <TreasurySection points={treasury} />

      <section className="market__cote" aria-labelledby="cote">
        <div className="section-head">
          <h2 id="cote">La cote</h2>
          <p>
            Relevé du <ImperialDate date={facts.date} />
          </p>
          <Link className="push backlink" to="/corporations">
            Vue analytique complète
          </Link>
        </div>
        <CoteTable
          companies={market.companies}
          variant="compact"
          caption={`La cote du ${formatImperialDate(facts.date)}`}
        />
      </section>
    </div>
  );
}
