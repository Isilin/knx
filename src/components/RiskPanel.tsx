import {
  formatCompact,
  formatDecimal,
  formatInteger,
  formatPercent,
  formatShare,
} from "../domain/numbers.ts";
import { REGIMES } from "../domain/regimes.ts";
import {
  RISK_INDICES,
  RISK_LEVEL_LABELS,
  RISK_METHOD,
  type CompanyRisk,
  type RiskIndex,
  type RiskLevel,
} from "../domain/risk.ts";
import { ImperialDate, Score } from "./figures.tsx";
import "./RiskPanel.css";

const LEVELS: readonly RiskLevel[] = [1, 2, 3, 4, 5, 6, 7];

/** A level of 6 or 7 is an alert; lower levels read in plain ink. */
const alerting = (level: RiskLevel | null) => level !== null && level >= 6;

/** A span of days in imperial years (one per real month, about 30 days): `4,2 ans`. */
export function ImperialSpan({ days }: { days: number }) {
  if (days < 30) {
    const n = Math.max(0, Math.round(days));
    return (
      <>
        {n}
        <span className="amount__unit"> j</span>
      </>
    );
  }
  const years = days / 30;
  if (years >= 100)
    return (
      <>
        plus de 100<span className="amount__unit"> ans</span>
      </>
    );
  return (
    <>
      {formatDecimal(years)}
      <span className="amount__unit"> {years < 2 ? "an" : "ans"}</span>
    </>
  );
}

/** The seven-step scale, the selected step marked; empty when the profile is not established. */
export function RiskScale({ level }: { level: RiskLevel | null }) {
  return (
    <div className="risk-scale">
      <ol
        className="risk-scale__steps"
        aria-label={
          level === null
            ? "Profil de risque non établi"
            : `Profil de risque ${level} sur 7, ${RISK_LEVEL_LABELS[level]}`
        }
      >
        {LEVELS.map((step) => (
          <li
            key={step}
            className={`risk-scale__step${step === level ? " is-on" : ""}`}
            aria-current={step === level ? "true" : undefined}
          >
            {step}
          </li>
        ))}
      </ol>
      <div className="risk-scale__ends" aria-hidden="true">
        <span>Plus faible</span>
        <span>Plus élevé</span>
      </div>
    </div>
  );
}

/** Seven short segments filled up to the level. */
function Ticks({ level }: { level: RiskLevel }) {
  return (
    <span className="risk-ticks" aria-hidden="true">
      {LEVELS.map((step) => (
        <i key={step} className={step <= level ? "is-on" : undefined} />
      ))}
    </span>
  );
}

function Flag({ children, title }: { children: string; title: string }) {
  return (
    <span className="risk-flag" title={title}>
      {children}
    </span>
  );
}

function Measure({ index }: { index: RiskIndex }) {
  const { value, flag } = index;
  switch (index.id) {
    case "volatility":
      return value === null ? null : (
        <span className="estimated" title="Estimation KNX : écart type des recettes mensuelles">
          {formatShare(value)}
        </span>
      );
    case "trend":
      return value === null ? null : <Score value={value} />;
    case "runway":
      if (flag === "not-declining")
        return <span className="risk-index__quiet">capital stable</span>;
      return value === null ? null : (
        <span className="estimated" title="Estimation KNX au rythme de baisse de la fenêtre">
          <ImperialSpan days={value} />
        </span>
      );
    case "retention":
      if (flag === "capped")
        return (
          <Flag title="Le capital frôle le seuil de piratage : ses sorties servent surtout à rester dessous, la rétention ne mesure plus la rentabilité.">
            plafonnée
          </Flag>
        );
      return value === null ? null : (
        <span className="estimated" title="Estimation KNX : variation du capital ÷ CA généré">
          {formatPercent(value)}
        </span>
      );
    case "reserve":
      return value === null ? null : (
        <span className="risk-index__pair">
          {flag === "dormant" ? (
            <Flag
              title={`Plus de ${Math.round(RISK_METHOD.dormantReserveDays / 30)} ans de recettes en caisse`}
            >
              dormant
            </Flag>
          ) : null}
          <span
            className="estimated"
            title="Estimation KNX : capital ÷ recette des 30 derniers jours"
          >
            <ImperialSpan days={value} />
          </span>
        </span>
      );
    case "team":
      return value === null ? null : (
        <span>
          {formatInteger(value)}
          <span className="amount__unit"> {value > 1 ? "personnes" : "personne"}</span>
        </span>
      );
    case "exposure":
      return value === null ? null : (
        <span className="risk-index__pair">
          {flag === "exposed" ? (
            <Flag title="Capital au-delà du seuil : la corporation peut être piratée">exposée</Flag>
          ) : null}
          <span
            title={`Capital rapporté au seuil de ${formatCompact(RISK_METHOD.piracyThreshold)} ¢`}
          >
            {formatShare(value)}
            <span className="amount__unit"> du seuil</span>
          </span>
        </span>
      );
  }
}

/** Under the measure: what the figure means in words, where a number alone says too little. */
function caption(index: RiskIndex, risk: CompanyRisk): string | null {
  if (index.id === "trend" && risk.regime)
    return REGIMES.find((r) => r.id === risk.regime)?.label ?? null;
  return null;
}

export function RiskPanel({ risk }: { risk: CompanyRisk }) {
  const { profile } = risk;
  return (
    <div className="risk">
      <div className="risk__profile">
        <RiskScale level={profile} />
        {profile === null ? (
          <p className="risk__verdict">Profil non établi</p>
        ) : (
          <p className="risk__verdict">
            Risque{" "}
            <span
              className={`estimated${alerting(profile) ? " is-alert" : ""}`}
              title="Profil calculé par KNX"
            >
              {RISK_LEVEL_LABELS[profile]}
            </span>
          </p>
        )}
        <p className="company__note">
          {profile === null
            ? `${risk.measured} indice${risk.measured > 1 ? "s" : ""} mesurable${risk.measured > 1 ? "s" : ""} sur 7 : il en faut ${RISK_METHOD.minMeasured} pour établir le profil.`
            : `Moyenne pondérée de ${risk.measured} indices sur 7. Une autonomie ou une exposition au piratage critique relève le profil, quel que soit le reste.`}
        </p>
        {risk.lastAboveThreshold ? (
          <p className="risk__alert">
            Capital au-dessus de {formatCompact(RISK_METHOD.piracyThreshold)} ¢ au relevé du{" "}
            <ImperialDate date={risk.lastAboveThreshold} />.
          </p>
        ) : null}
      </div>

      <dl className="risk__indices">
        {risk.indices.map((index) => {
          const info = RISK_INDICES.find((i) => i.id === index.id);
          const words = caption(index, risk);
          return (
            <div key={index.id} className="risk-index">
              <dt>
                <span className="risk-index__label">{info?.label}</span>
                <span className="risk-index__help">{info?.help}</span>
              </dt>
              <dd className="risk-index__measure">
                <Measure index={index} />
                {index.value === null && index.flag === null ? (
                  <span className="amount--none">—</span>
                ) : null}
                {words ? <small>{words}</small> : null}
              </dd>
              <dd className="risk-index__level">
                {index.level === null ? (
                  <span className="risk-index__quiet">
                    {index.flag === "capped" ? "écartée" : "non mesuré"}
                  </span>
                ) : (
                  <>
                    <Ticks level={index.level} />
                    <span
                      className={alerting(index.level) ? "is-alert" : undefined}
                      title={RISK_LEVEL_LABELS[index.level]}
                    >
                      {index.level}
                      <span className="amount__unit">/7</span>
                    </span>
                  </>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
