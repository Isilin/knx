import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <div className="state">
      <h1>Cette page n'est pas à la cote</h1>
      <p>L'adresse ne correspond à aucune section de KNX.</p>
      <Link className="button button--quiet" to="/">
        Retour au marché
      </Link>
    </div>
  );
}
