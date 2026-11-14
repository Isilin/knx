import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import {
  Amount,
  Change,
  Estimated,
  GroupTag,
  groupColor,
  ImperialDate,
  RankChange,
} from "../components/figures.tsx";
import { CompanyEditor } from "../components/CompanyEditor.tsx";
import { CompanyTimeline } from "../components/CompanyTimeline.tsx";
import { FollowButton } from "../components/FollowButton.tsx";
import { PeriodPicker, periodStart, type PeriodId } from "../components/PeriodPicker.tsx";
import { RiskPanel } from "../components/RiskPanel.tsx";
import { Seal } from "../components/Seal.tsx";
import { TimeChart } from "../components/TimeChart.tsx";
import { TreasuryBridge } from "../components/TreasuryBridge.tsx";
import { useData, useMarket } from "../data/DataProvider.tsx";
import type { CreationEstimate } from "../domain/age.ts";
import { daysBetween } from "../domain/dates.ts";
import { formatImperialAge, imperialAge, type ImperialAge } from "../domain/imperial.ts";
import { smoothedRealDaily } from "../domain/market.ts";
import { marketEventsBetween, marketMarkers } from "../domain/marketEvents.ts";
import { formatInteger, formatPercent } from "../domain/numbers.ts";
import { RISK_LEVEL_LABELS } from "../domain/risk.ts";
import { sectorLabel } from "../domain/sectors.ts";
import { largestFlows, treasuryBridge } from "../domain/treasury.ts";
import { useTween } from "../hooks/useTween.ts";
import "./CompanyPage.css";

/** Imperial age with small units, like the other figures: `91 ans 1 hept. 4 j`. */
function AgeFigure({ age }: { age: ImperialAge }) {
  const parts = [
    { value: age.years, unit: age.years > 1 ? "ans" : "an" },
    { value: age.heptades, unit: "hept." },
    { value: age.days, unit: "j" },
  ].filter((p) => p.value > 0);
  const shown = parts.length > 0 ? parts : [{ value: 0, unit: "j" }];
  const full = formatImperialAge(age);
  return (
    <span className="age" title={full}>
      <span aria-hidden="true">
        {shown.map((p, i) => (
          <span key={p.unit}>
            {i > 0 ? " " : null}
            <span className="age__part">
              {p.value}
              <span className="amount__unit"> {p.unit}</span>
            </span>
          </span>
        ))}
      </span>
      <span className="sr-only">{full}</span>
    </span>
  );
}

function reliability(creation: CreationEstimate): { label: string; tone: "high" | "mid" | "low" } {
  if (creation.method === "manual") return { label: "date saisie", tone: "high" };
  if (creation.method === "first-seen") return { label: "historique trop court", tone: "low" };
  if (creation.support >= 3 || (creation.margin ?? Infinity) <= 7)
    return { label: "fiabilité élevée", tone: "high" };
  if ((creation.margin ?? Infinity) <= 60) return { label: "fiabilité moyenne", tone: "mid" };
  return { label: "fiabilité faible", tone: "low" };
}

/** Drawn chevron, the same stroke as the back link. */
function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
      <path
        d={direction === "left" ? "M7.5 2 3.5 6l4 4" : "M4.5 2l4 4-4 4"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function Gauge({ label, value, help }: { label: string; value: number | null; help: string }) {
  const pct = value === null ? null : Math.round(value * 100);
  return (
    <div className="gauge">
      <dt className="label" title={help}>
        {label}
      </dt>
      <dd>
        <span
          className={`gauge__value ${pct === null ? "" : `is-estimated ${pct > 15 ? "is-up" : pct < -15 ? "is-down" : ""}`}`}
          title="Indicateur estimé par KNX"
        >
          {pct === null ? "—" : `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct)}`}
        </span>
        <span className="gauge__track" aria-hidden="true">
          <span className="gauge__mid" />
          {pct !== null ? (
            <span
              className={`gauge__bar ${pct >= 0 ? "is-up" : "is-down"}`}
              style={
                pct >= 0
                  ? { left: "50%", width: `${pct / 2}%` }
                  : { right: "50%", width: `${-pct / 2}%` }
              }
            />
          ) : null}
        </span>
        <span className="gauge__help">{help}</span>
      </dd>
    </div>
  );
}

export function CompanyPage() {
  const { slug = "" } = useParams();
  const market = useMarket();
  const { session } = useData();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodId>("12");
  // Remembered per address, so moving to another corporation closes the form.
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const isAdmin = session?.state === "signed-in" && session.isAdmin;
  const company = market.bySlug.get(slug);

  const neighbours = useMemo(() => {
    const listed = market.companies.filter((c) => c.status !== "delisted");
    const index = listed.findIndex((c) => c.slug === slug);
    return {
      prev: index > 0 ? listed[index - 1] : null,
      next: index >= 0 && index < listed.length - 1 ? listed[index + 1] : null,
    };
  }, [market, slug]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest("input, textarea, select, [contenteditable]") ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      if (event.key === "j" && neighbours.next)
        void navigate(`/corporations/${neighbours.next.slug}`);
      if (event.key === "k" && neighbours.prev)
        void navigate(`/corporations/${neighbours.prev.slug}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [neighbours, navigate]);

  const start = company ? periodStart(period, market.latestDate) : null;
  const visible = useMemo(
    () => (company ? company.points.filter((p) => !start || p.date >= start) : []),
    [company, start],
  );
  const trend = useMemo(
    () =>
      company ? smoothedRealDaily(company.points).filter((p) => !start || p.date >= start) : [],
    [company, start],
  );
  const bridge = useMemo(
    () => (company ? treasuryBridge(company.points, start) : null),
    [company, start],
  );
  const flows = useMemo(
    () => (company ? largestFlows(company.points, start) : []),
    [company, start],
  );
  const markers = useMemo(() => marketMarkers(market.marketEvents), [market.marketEvents]);
  const periodChange =
    visible.length > 1 && visible[0].chiffre > 0
      ? visible[visible.length - 1].chiffre / visible[0].chiffre - 1
      : null;
  const tweenedChange = useTween(periodChange);

  if (!company) {
    const renamed = market.slugAliases.get(slug);
    if (renamed) return <Navigate to={`/corporations/${renamed}`} replace />;
    return (
      <div className="state">
        <h1>Corporation introuvable</h1>
        <p>
          Aucune corporation de la cote ne répond à cette adresse. Elle a peut-être changé de nom.
        </p>
        <Link className="button button--quiet" to="/corporations">
          Retour aux corporations
        </Link>
      </div>
    );
  }

  const { latest, creation } = company;
  const projection = company.status === "active" ? company.projection : null;
  const crossings = market.projection.crossings.filter(
    (x) => x.passer.slug === company.slug || x.passed.slug === company.slug,
  );
  const color = groupColor(company.consortium);
  const rel = creation ? reliability(creation) : null;
  const age =
    creation && creation.method !== "first-seen"
      ? imperialAge(creation.creation, market.latestDate)
      : null;
  const history = [...company.points].reverse().slice(0, 12);
  const hasCapital = company.points.some((p) => p.capital !== null);

  return (
    <article className="company" key={company.slug}>
      <nav className="company__crumbs" aria-label="Navigation entre corporations">
        <Link className="backlink" to="/">
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            <path d="M7.5 2 3.5 6l4 4" fill="none" stroke="currentColor" strokeWidth="1.4" />
          </svg>
          La cote
        </Link>
        <span className="company__pager">
          {neighbours.prev ? (
            <Link
              to={`/corporations/${neighbours.prev.slug}`}
              title="Corporation précédente (touche K)"
            >
              <Chevron direction="left" />
              {neighbours.prev.name}
            </Link>
          ) : null}
          {neighbours.next ? (
            <Link
              to={`/corporations/${neighbours.next.slug}`}
              title="Corporation suivante (touche J)"
            >
              {neighbours.next.name}
              <Chevron direction="right" />
            </Link>
          ) : null}
        </span>
      </nav>

      <header className="company__head" style={{ "--brand": color } as React.CSSProperties}>
        <Seal seed={company.sealSeed} size={168} draw className="company__seal" />
        <div className="company__title">
          <div className="company__name">
            {company.logoUrl ? (
              <span className="logo-frame company__logo">
                <img src={company.logoUrl} alt={`Logo de ${company.name}`} width={72} height={72} />
              </span>
            ) : null}
            <h1>{company.name}</h1>
          </div>
          <div className="company__meta">
            <GroupTag consortium={company.consortium} />
            {company.status === "delisted" ? (
              <span className="company__status">
                Fermée · dernier relevé le <ImperialDate date={latest.date} />
              </span>
            ) : company.status === "idle" ? (
              <span className="company__status">À l'arrêt · chiffre publié à 0</span>
            ) : null}
            {company.sector ? <span>{sectorLabel(company.sector)}</span> : null}
            {company.formerNames.length > 0 ? (
              <span>Anciennement {company.formerNames.toReversed().join(", ")}</span>
            ) : null}
            <span>
              Suivie par KNX depuis le <ImperialDate date={company.firstSeen} pti />
            </span>
          </div>
        </div>
        <div className="company__actions">
          <FollowButton slug={company.slug} name={company.name} />
          {isAdmin && editingSlug !== company.slug ? (
            <button
              type="button"
              className="button button--quiet"
              onClick={() => setEditingSlug(company.slug)}
            >
              Modifier la fiche
            </button>
          ) : null}
        </div>
      </header>

      {isAdmin && editingSlug === company.slug ? (
        <CompanyEditor
          company={company}
          consortiums={market.consortiums}
          onClose={() => setEditingSlug(null)}
        />
      ) : null}

      <dl className="kpis">
        <div className="kpi">
          <dt className="label">Rang</dt>
          <dd className="kpi__value">{company.status === "delisted" ? "—" : latest.rank}</dd>
          <dd className="kpi__detail">
            {company.rankChange ? <RankChange value={company.rankChange} /> : "inchangé"} · meilleur
            rang : {company.bestRank.rank}
          </dd>
        </div>
        <div className="kpi">
          <dt className="label">CA publié</dt>
          <dd className="kpi__value">
            <Amount value={latest.chiffre} />
          </dd>
          <dd className="kpi__detail">
            <Change ratio={company.chiffreChange} /> sur le relevé
          </dd>
        </div>
        <div className="kpi">
          <dt className="label">CA réel du dernier relevé</dt>
          <dd className="kpi__value">
            <Estimated value={latest.realDaily} noise={latest.realDailyNoise} />
          </dd>
          <dd className="kpi__detail">
            {latest.realDaily === null
              ? "pas de relevé précédent"
              : `par jour sur ${latest.gap} jour${(latest.gap ?? 0) > 1 ? "s" : ""}, à ± ${formatInteger(latest.realDailyNoise ?? 0)} ¢`}
          </dd>
        </div>
        <div className="kpi">
          <dt className="label">Capital</dt>
          <dd className="kpi__value">
            <Amount value={latest.capital} />
          </dd>
          <dd className="kpi__detail">
            {latest.employees === null
              ? "effectif non relevé"
              : `${latest.employees} employé${latest.employees > 1 ? "s" : ""}`}
          </dd>
        </div>
        <div className="kpi">
          <dt className="label">Âge estimé</dt>
          <dd className="kpi__value">
            {age === null ? (
              "—"
            ) : creation?.method === "manual" ? (
              <AgeFigure age={age} />
            ) : (
              <span className="estimated">
                <AgeFigure age={age} />
              </span>
            )}
          </dd>
          <dd className="kpi__detail">
            {creation && creation.method !== "first-seen" ? (
              <span>
                création {creation.method === "manual" ? "le" : "vers le"}{" "}
                <ImperialDate date={creation.creation} pti /> ·
              </span>
            ) : null}
            {rel ? <span className={`rel rel--${rel.tone}`}>{rel.label}</span> : "jamais active"}
          </dd>
        </div>
        <div className="kpi">
          <dt className="label">Profil de risque</dt>
          <dd className="kpi__value">
            {company.risk?.profile ? (
              <a className="kpi__link" href="#risque">
                <span className="estimated" title="Profil calculé par KNX">
                  {company.risk.profile}
                  <span className="amount__unit"> /7</span>
                </span>
              </a>
            ) : (
              "—"
            )}
          </dd>
          <dd className="kpi__detail">
            {company.status === "delisted"
              ? "corporation fermée"
              : company.status === "idle"
                ? "à l'arrêt, non évaluée"
                : company.risk?.profile
                  ? `${RISK_LEVEL_LABELS[company.risk.profile]} · cinq ans impériaux`
                  : `${company.risk?.measured ?? 0} indices mesurables sur 7`}
          </dd>
        </div>
      </dl>

      <section className="company__chart" aria-labelledby="ca">
        <div className="section-head">
          <h2 id="ca">Chiffre d'affaires</h2>
          <p>
            {tweenedChange === null
              ? "variation indisponible"
              : `${formatPercent(tweenedChange).replace("-", "−")} de CA publié sur la période`}
          </p>
          <div className="push">
            <PeriodPicker value={period} onChange={setPeriod} />
          </div>
        </div>
        <TimeChart
          label={`Chiffre d'affaires de ${company.name}`}
          formatValue={(v) => `${formatInteger(v)} ¢/j`}
          height={320}
          markers={markers}
          series={[
            {
              id: "trend",
              label: "CA réel, moyenne 30 j",
              color: "var(--estime)",
              kind: "trend",
              points: trend,
            },
            {
              id: "chiffre",
              label: "CA publié",
              color: "var(--ivoire)",
              points: visible.map((p) => ({ date: p.date, value: p.chiffre })),
            },
            ...(projection
              ? [
                  {
                    id: "projection",
                    label: "CA publié projeté",
                    color: "var(--estime)",
                    kind: "projection" as const,
                    points: projection.path,
                  },
                ]
              : []),
          ]}
        />
        <p className="company__legend">
          <span>
            <i className="swatch swatch--line" /> CA publié : moyenne quotidienne depuis la création
          </span>
          <span>
            <i className="swatch swatch--estimate" /> CA réel estimé : recette par jour, moyenne des
            30 jours précédant chaque relevé (le détail par relevé figure plus bas)
          </span>
          {projection ? (
            <span>
              <i className="swatch swatch--projection" /> CA publié projeté si la recette des 30
              derniers jours se maintient
            </span>
          ) : null}
          <span>
            Source : rapport « Corporations », {company.points.length} relevés depuis le{" "}
            <ImperialDate date={company.firstSeen} />.
          </span>
        </p>
      </section>

      {company.status === "active" ? (
        <section className="company__projection" aria-labelledby="projection">
          <div className="section-head">
            <h2 id="projection">Projection</h2>
            <p>
              si la recette des 30 derniers jours se maintient, jusqu'au{" "}
              <ImperialDate date={market.projection.horizon} />
            </p>
          </div>
          {projection ? (
            <>
              <dl className="kpis kpis--projection">
                <div className="kpi">
                  <dt className="label">CA d'équilibre</dt>
                  <dd className="kpi__value">
                    <Estimated value={projection.equilibrium} />
                  </dd>
                  <dd className="kpi__detail">valeur vers laquelle tend le CA publié</dd>
                </div>
                <div className="kpi">
                  <dt className="label">Dérive du CA publié</dt>
                  <dd className="kpi__value">
                    <Estimated
                      value={projection.drift}
                      unit={false}
                      signed
                      suffix={<span className="amount__unit"> ¢/j</span>}
                    />
                  </dd>
                  <dd className="kpi__detail">par jour, au dernier relevé</dd>
                </div>
                <div className="kpi">
                  <dt className="label">CA publié projeté</dt>
                  <dd className="kpi__value">
                    <Estimated value={projection.chiffre} />
                  </dd>
                  <dd className="kpi__detail">
                    <Change
                      ratio={latest.chiffre > 0 ? projection.chiffre / latest.chiffre - 1 : null}
                      estimated
                    />{" "}
                    d'ici l'horizon
                  </dd>
                </div>
                <div className="kpi">
                  <dt className="label">Rang projeté</dt>
                  <dd className="kpi__value">
                    <span className="estimated" title="Projection KNX">
                      {projection.rank}
                    </span>
                  </dd>
                  <dd className="kpi__detail">
                    {projection.rankChange ? (
                      <RankChange value={projection.rankChange} />
                    ) : (
                      "inchangé"
                    )}{" "}
                    face au rang actuel ({latest.rank})
                  </dd>
                </div>
              </dl>
              {crossings.length > 0 ? (
                <ol className="crossings">
                  {crossings.map((x) => {
                    const ahead = x.passer.slug === company.slug;
                    const other = ahead ? x.passed : x.passer;
                    return (
                      <li key={other.slug}>
                        <span>
                          {ahead ? "Passe devant " : "Dépassée par "}
                          <Link to={`/corporations/${other.slug}`}>{other.name}</Link>
                        </span>
                        <span className="estimated" title="Projection KNX">
                          dans ≈ {x.inDays} jour{x.inDays > 1 ? "s" : ""}
                        </span>
                        <ImperialDate date={x.date} />
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="company__empty">Aucun changement de rang attendu d'ici l'horizon.</p>
              )}
            </>
          ) : (
            <p className="company__empty">
              Projection indisponible : âge estimé inconnu ou recette des 30 derniers jours non
              mesurable.
            </p>
          )}
        </section>
      ) : null}

      <div className="company__pair">
        <section aria-labelledby="rang">
          <div className="section-head">
            <h2 id="rang">Rang</h2>
          </div>
          <TimeChart
            label={`Rang de ${company.name}`}
            formatValue={(v) => `rang ${v}`}
            height={200}
            invertY
            zeroBased={false}
            series={[
              {
                id: "rank",
                label: "Rang",
                color,
                kind: "step",
                points: visible.map((p) => ({ date: p.date, value: p.rank })),
              },
            ]}
          />
        </section>
        <section aria-labelledby="capital">
          <div className="section-head">
            <h2 id="capital">Capital</h2>
            {!hasCapital ? <p>relevé depuis août 2025</p> : null}
          </div>
          <TimeChart
            label={`Capital de ${company.name}`}
            formatValue={(v) => `${formatInteger(v)} ¢`}
            height={200}
            zeroBased={false}
            markers={markers}
            series={[
              {
                id: "capital",
                label: "Capital",
                color: "var(--ivoire)",
                points: visible.map((p) => ({ date: p.date, value: p.capital })),
              },
            ]}
          />
        </section>
      </div>

      <div className="company__pair company__pair--treasury">
        <section aria-labelledby="tresorerie">
          <div className="section-head">
            <h2 id="tresorerie">Trésorerie</h2>
            {bridge ? (
              <p>
                <Change
                  ratio={
                    bridge.start.capital > 0 ? bridge.end.capital / bridge.start.capital - 1 : null
                  }
                />{" "}
                de capital sur la période
              </p>
            ) : null}
          </div>
          {bridge ? (
            <>
              <TreasuryBridge bridge={bridge} />
              <p className="company__note">
                Le capital est publié par le jeu ; le CA généré se déduit des chiffres publiés et de
                l'âge estimé. Le reste, le flux hors CA, est ce que les recettes n'expliquent pas :
                négatif quand de l'argent est sorti, positif quand il en est entré.
              </p>
            </>
          ) : (
            <p className="company__empty">
              {hasCapital
                ? "Trésorerie non ventilable sur la période : il faut deux relevés du capital avec un chiffre publié non nul."
                : "Capital relevé depuis août 2025 seulement : aucun relevé pour cette corporation."}
            </p>
          )}
        </section>
        <section aria-labelledby="flux">
          <div className="section-head">
            <h2 id="flux">Principaux flux hors CA</h2>
            <p>sur la période, entre deux relevés</p>
          </div>
          {flows.length > 0 ? (
            <ol className="flows">
              {flows.map((f) => (
                <li key={f.date}>
                  <span className="flows__date">
                    <ImperialDate date={f.date} />
                    <small>
                      sur {daysBetween(f.previousDate, f.date)} jour
                      {daysBetween(f.previousDate, f.date) > 1 ? "s" : ""}
                    </small>
                    {marketEventsBetween(market.marketEvents, f.previousDate, f.date).map((e) => (
                      <small key={e.id} className="flows__market" title={e.description ?? e.title}>
                        {e.title}
                      </small>
                    ))}
                  </span>
                  <Estimated value={f.flow} noise={f.noise} signed />
                  <span
                    className="flows__share"
                    title="Part de l'argent disponible avant le flux : capital du relevé précédent plus CA généré entre les deux relevés"
                  >
                    {f.share === null ? (
                      "—"
                    ) : (
                      <>
                        <Change ratio={f.share} estimated /> du disponible
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="company__empty">Aucun flux hors CA mesurable sur la période.</p>
          )}
        </section>
      </div>

      {company.status !== "delisted" ? (
        <section className="company__risk" aria-labelledby="risque">
          <div className="section-head">
            <h2 id="risque">Risque</h2>
            <p>
              {company.risk ? (
                <>
                  sept indices KNX sur cinq ans impériaux, du{" "}
                  <ImperialDate date={company.risk.from} /> au{" "}
                  <ImperialDate date={company.risk.to} />
                </>
              ) : (
                "évalué pour les corporations actives"
              )}
            </p>
          </div>
          {company.risk ? (
            <RiskPanel risk={company.risk} />
          ) : (
            <p className="company__empty">
              Profil non établi : la corporation est à l'arrêt, ses chiffres ne décrivent plus une
              activité.
            </p>
          )}
        </section>
      ) : null}

      <div className="company__pair">
        <section aria-labelledby="scores">
          <div className="section-head">
            <h2 id="scores">Indicateurs</h2>
            <p>calculés par KNX sur les recettes estimées</p>
          </div>
          <dl className="gauges">
            <Gauge
              label="Dynamique"
              value={company.scores.dynamics}
              help="Recettes des 30 derniers jours face aux 90 jours précédents."
            />
            <Gauge
              label="Activité"
              value={company.scores.activity}
              help="Recettes des 30 derniers jours face à la moyenne historique."
            />
            <div className="gauge">
              <dt className="label">Poids économique</dt>
              <dd>
                <span className="gauge__value estimated">
                  {company.scores.weight === null
                    ? "—"
                    : formatPercent(company.scores.weight).replace("+", "")}
                </span>
                <span className="gauge__help">
                  Part des recettes de tout le marché sur 30 jours.
                </span>
              </dd>
            </div>
          </dl>
        </section>
        <CompanyTimeline
          company={company}
          events={market.events.get(company.id) ?? []}
          marketEvents={market.marketEvents}
          isAdmin={isAdmin}
        />
      </div>

      <section className="company__history" aria-labelledby="historique">
        <div className="section-head">
          <h2 id="historique">Derniers relevés</h2>
          <p>{company.points.length} relevés au total</p>
        </div>
        <div className="cote__scroll">
          <table className="history">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col" className="num">
                  Rang
                </th>
                <th scope="col" className="num">
                  CA publié
                </th>
                <th scope="col" className="num">
                  CA réel est.
                </th>
                <th scope="col" className="num secondary">
                  Capital
                </th>
                <th
                  scope="col"
                  className="num secondary"
                  title="Variation du capital que les recettes n'expliquent pas, estimée par KNX"
                >
                  Hors CA est.
                </th>
                <th scope="col" className="num secondary">
                  Empl.
                </th>
              </tr>
            </thead>
            <tbody>
              {history.map((p) => (
                <tr key={p.date}>
                  <th scope="row">
                    <ImperialDate date={p.date} />
                  </th>
                  <td className="num">{p.rank}</td>
                  <td className="num">
                    <Amount value={p.chiffre} unit={false} />
                  </td>
                  <td className="num">
                    <Estimated value={p.realDaily} noise={p.realDailyNoise} unit={false} />
                  </td>
                  <td className="num secondary">
                    <Amount value={p.capital} unit={false} />
                  </td>
                  <td className="num secondary">
                    <Estimated value={p.otherFlow} noise={p.otherFlowNoise} unit={false} signed />
                  </td>
                  <td className="num secondary">{p.employees ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </article>
  );
}
