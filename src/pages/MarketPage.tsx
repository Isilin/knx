import { useMemo, useState } from "react";
import { Link } from "react-router";
import { CoteTable } from "../components/CoteTable.tsx";
import { Change, Estimated, groupColor, RankChange } from "../components/figures.tsx";
import { PeriodPicker, periodStart, type PeriodId } from "../components/PeriodPicker.tsx";
import { Seal } from "../components/Seal.tsx";
import { TimeChart, type ChartSeries } from "../components/TimeChart.tsx";
import { useMarket } from "../data/DataProvider.tsx";
import { formatLongDate, formatShortDate } from "../domain/dates.ts";
import { smoothedRealDaily, type CompanySeries } from "../domain/market.ts";
import { computeMovers } from "../domain/movers.ts";
import { formatInteger } from "../domain/numbers.ts";
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

export function MarketPage() {
  const market = useMarket();
  const { focused, setFocused } = useFocus();
  const { followed } = useFollowed();
  const [period, setPeriod] = useState<PeriodId>("30");
  const [metric, setMetric] = useState<"chiffre" | "real">("chiffre");
  const movers = useMemo(() => computeMovers(market, 4), [market]);
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
      <h1 className="sr-only">Marché du {formatLongDate(market.latestDate)}</h1>

      <dl className="facts" aria-label="Faits du relevé">
        <Fact
          label="Relevé"
          detail={`n° ${market.dates.length} depuis le ${formatShortDate(market.dates[0])}/${market.dates[0].slice(0, 4)}`}
        >
          {formatShortDate(facts.date)}
          <span className="fact__year">{facts.date.slice(0, 4)}</span>
        </Fact>
        <Fact
          label="Écart"
          detail={
            facts.previousDate
              ? `depuis le ${formatShortDate(facts.previousDate)}`
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
              {formatShortDate(market.dates[0])}/{market.dates[0].slice(0, 4)} au{" "}
              {formatShortDate(market.latestDate)}/{market.latestDate.slice(0, 4)}.
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

      <section className="market__cote" aria-labelledby="cote">
        <div className="section-head">
          <h2 id="cote">La cote</h2>
          <p>Relevé du {formatLongDate(facts.date)}</p>
          <Link className="push backlink" to="/corporations">
            Vue analytique complète
          </Link>
        </div>
        <CoteTable
          companies={market.companies}
          variant="compact"
          caption={`La cote du ${formatLongDate(facts.date)}`}
        />
      </section>
    </div>
  );
}
