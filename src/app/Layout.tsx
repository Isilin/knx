import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from "react-router";
import { Search } from "../components/Search.tsx";
import { useData } from "../data/DataProvider.tsx";
import { formatLongDate } from "../domain/dates.ts";
import { FocusProvider } from "../hooks/focus.tsx";
import "./Layout.css";

const SECTIONS = [
  { to: "/", label: "Marché", end: true },
  { to: "/corporations", label: "Corporations", end: false },
  { to: "/releves", label: "Relevés", end: false },
  { to: "/methodologie", label: "Méthodologie", end: false },
];

/** Pages that work without a loaded market (publishing the very first report, reading the method). */
const STANDALONE = ["/releves", "/methodologie"];

export function Layout() {
  const { state, reload } = useData();
  const { pathname } = useLocation();
  const standalone = STANDALONE.some((p) => pathname.startsWith(p));

  return (
    <FocusProvider>
      <a className="skip" href="#contenu">
        Aller au contenu
      </a>
      <header className="masthead">
        <div className="masthead__inner">
          <Link to="/" className="brand" aria-label="KNX, Kessler & Nomura Exchange : accueil">
            <span className="brand__mark">KNX</span>
            <span className="brand__name">Kessler &amp; Nomura Exchange</span>
          </Link>
          <nav className="sections" aria-label="Sections">
            {SECTIONS.map((s) => (
              <NavLink key={s.to} to={s.to} end={s.end}>
                {s.label}
              </NavLink>
            ))}
          </nav>
          <div className="masthead__meta">
            {state.status === "ready" ? (
              <>
                <p className="masthead__date">
                  Relevé du{" "}
                  <time dateTime={state.market.latestDate}>
                    {formatLongDate(state.market.latestDate)}
                  </time>
                </p>
                <Search companies={state.market.companies} />
              </>
            ) : null}
          </div>
        </div>
      </header>

      <main id="contenu" className="page" tabIndex={-1}>
        {state.status === "ready" || standalone ? (
          <Outlet />
        ) : state.status === "loading" ? (
          <div className="state" role="status">
            <span className="state__rule" aria-hidden="true" />
            <p>Chargement des relevés…</p>
          </div>
        ) : (
          <div className="state state--error" role="alert">
            <h1>La cote est indisponible</h1>
            <p>{state.message}</p>
            <div className="state__actions">
              <button type="button" className="button" onClick={reload}>
                Réessayer
              </button>
              <Link to="/releves" className="button button--quiet">
                Publier un relevé
              </Link>
            </div>
          </div>
        )}
      </main>

      <footer className="colophon">
        <div className="colophon__inner">
          <p>
            KNX publie le rapport « Corporations » de Dreadcast tel qu'il paraît chaque jour. Les
            valeurs en <span className="estimated">violet pointillé</span> sont des estimations de
            KNX.
          </p>
          <Link to="/methodologie">Comment KNX calcule ses estimations</Link>
        </div>
      </footer>
      <ScrollRestoration />
    </FocusProvider>
  );
}
