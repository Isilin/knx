import { Link } from "react-router";
import { OperationsManager } from "../components/OperationsManager.tsx";
import { ValuationSettingsForm } from "../components/ValuationSettingsForm.tsx";
import { useData } from "../data/DataProvider.tsx";
import { SignIn } from "./ReportsPage.tsx";
import "./BoursePage.css";

/** The operator's side of the Bourse: the levers of the value and the operations on securities. */
export function BourseAdminPage() {
  const { state, session, source } = useData();

  return (
    <div className="bourse">
      <header className="page-head">
        <div>
          <h1>Réglages de la Bourse</h1>
          <p>
            Les leviers de la valeur KNX et les opérations sur titres des corporations. Tout ce qui
            est publié ici paraît sur la <Link to="/bourse">page Bourse</Link> : la cote suit une
            méthode lisible par tous.
          </p>
        </div>
        {source.kind === "supabase" && session?.state === "signed-in" ? (
          <p className="reports__who">
            Connecté : {session.email}{" "}
            <button type="button" className="linklike" onClick={() => source.signOut()}>
              se déconnecter
            </button>
          </p>
        ) : null}
      </header>

      {session === null ? (
        <p className="state" role="status">
          Vérification de l'accès…
        </p>
      ) : session.state === "anonymous" ? (
        <SignIn />
      ) : !session.isAdmin ? (
        <p className="note note--warn">
          <strong>Accès en lecture seule.</strong> Ce compte n'est pas opérateur de KNX.
        </p>
      ) : state.status !== "ready" ? (
        <p className="state" role="status">
          Chargement de la cote…
        </p>
      ) : (
        <>
          <ValuationSettingsForm
            key={state.market.valuation.versions.length}
            market={state.market}
          />
          <OperationsManager market={state.market} dataset={state.dataset} />
        </>
      )}
    </div>
  );
}
