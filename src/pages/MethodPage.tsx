import { Link } from "react-router";
import "./MethodPage.css";

export function MethodPage() {
  return (
    <article className="method">
      <header className="page-head">
        <div>
          <h1>Méthodologie</h1>
          <p>
            KNX ne publie que ce que le jeu affiche, et signale tout ce qu'il en déduit. Voici
            comment se lisent les chiffres de la cote et comment naissent les estimations en violet.
          </p>
        </div>
      </header>

      <div className="method__body">
        <section>
          <h2>Ce que publie le jeu</h2>
          <p>
            Chaque jour, le rapport « Corporations » de Dreadcast donne pour chaque entreprise son
            rang, son <strong>chiffre</strong>, son capital et son nombre d'employés. Le chiffre
            n'est pas la recette du jour : c'est le chiffre d'affaires cumulé depuis la création,
            divisé par le nombre de jours d'activité. Il bouge donc très lentement chez les
            entreprises anciennes.
          </p>
          <p className="formula">chiffre = CA cumulé / jours d'activité</p>
        </section>

        <section>
          <h2>Retrouver l'âge d'une entreprise</h2>
          <p>
            Le jeu ne donne pas la date de création. KNX la déduit d'un fait simple : une recette
            n'est jamais négative. Entre deux relevés, si le chiffre baisse, c'est que l'entreprise
            a gagné moins que sa moyenne, et cette baisse plafonne son âge :
          </p>
          <p className="formula">
            âge au second relevé ≤ chiffre₁ × écart en jours / (chiffre₁ − chiffre₂)
          </p>
          <p>
            L'égalité tient quand l'entreprise n'a rien gagné entre les deux relevés. KNX croise
            toutes les paires de relevés de l'historique et retient le plafond le plus serré, élargi
            d'un crédit pour l'arrondi du jeu. Le tableur d'origine prenait la médiane de ces
            plafonds, ce qui vieillissait les entreprises de plusieurs années.
          </p>
          <ul className="method__list">
            <li>
              <strong>Fiabilité élevée</strong> : plusieurs paires de relevés concordent.
            </li>
            <li>
              <strong>Fiabilité moyenne ou faible</strong> : une seule paire porte l'estimation ;
              une coquille dans un relevé suffirait à la fausser.
            </li>
            <li>
              <strong>Historique trop court</strong> : aucune baisse observée, l'âge reste inconnu.
            </li>
            <li>
              <strong>Date saisie</strong> : l'opérateur a renseigné la date à la main ; elle prime
              sur l'estimation.
            </li>
          </ul>
        </section>

        <section>
          <h2>Le CA réel</h2>
          <p>
            Une fois l'âge connu, le chiffre redevient un cumul, et la différence entre deux cumuls
            donne la recette de la période :
          </p>
          <p className="formula">
            CA réel par jour = (chiffre₂ × âge₂ − chiffre₁ × âge₁) / écart en jours
          </p>
          <p>
            Le jeu arrondit le chiffre au crédit près ; multiplié par l'âge, cet arrondi devient une
            marge d'environ ± âge en jours, en crédits par jour. Une entreprise de neuf ans a donc
            un CA réel connu à ± 3 300 ¢ près. Quand la recette estimée est plus petite que sa
            marge, KNX affiche « ≈ 0 ».
          </p>
        </section>

        <section>
          <h2>Mouvements et indicateurs</h2>
          <ul className="method__list">
            <li>
              <strong>Au-dessus ou sous la moyenne</strong> : CA réel de la dernière période comparé
              au chiffre publié. +50 % signifie que l'entreprise a gagné une fois et demie sa
              moyenne historique par jour.
            </li>
            <li>
              <strong>Dynamique</strong> : recettes des 30 derniers jours face aux 90 jours
              précédents, ramenées entre −100 et +100.
            </li>
            <li>
              <strong>Activité</strong> : recettes des 30 derniers jours face à la moyenne
              historique, entre −100 et +100.
            </li>
            <li>
              <strong>Poids économique</strong> : part de l'entreprise dans les recettes de tout le
              marché sur 30 jours.
            </li>
          </ul>
          <p>
            Ces fenêtres en jours remplacent les lignes fixes du tableur d'origine, pour que les
            indicateurs gardent le même sens quel que soit le rythme des relevés.
          </p>
        </section>

        <section>
          <h2>Statuts</h2>
          <ul className="method__list">
            <li>
              <strong>À l'arrêt</strong> : le jeu publie un chiffre de 0.
            </li>
            <li>
              <strong>Fermée</strong> : l'entreprise a disparu du rapport. La fermeture est
              définitive ; KNX garde son historique.
            </li>
            <li>
              <strong>Consortiums et secteurs</strong> : renseignés par l'opérateur de KNX, pas par
              le jeu.
            </li>
          </ul>
        </section>

        <section>
          <h2>Identité des corporations</h2>
          <p>
            KNX suit chaque corporation par un identifiant, pas par son nom. Avant chaque
            publication, l'opérateur confirme ce que le rapport du jour ne dit pas :
          </p>
          <ul className="method__list">
            <li>
              <strong>Renommage</strong> : une corporation disparaît et une autre apparaît avec un
              nom proche, ou avec les mêmes chiffres (CA publié, capital, effectif). L'historique
              continue sous le nouveau nom ; l'ancien nom reste cherchable et ses liens mènent à la
              fiche.
            </li>
            <li>
              <strong>Refondation</strong> : le nom reste, mais le CA publié retombe à 0 ou le
              capital revient à un montant de départ. Le CA publié étant une moyenne depuis la
              création, il ne retombe jamais à 0 tant que l'entreprise vit : l'ancienne est fermée,
              une nouvelle commence avec un historique vierge.
            </li>
            <li>
              <strong>Homonyme</strong> : un nom déjà porté par une corporation fermée désigne une
              nouvelle corporation. Les deux fiches se renvoient l'une à l'autre.
            </li>
          </ul>
          <p>
            <Link to="/">Retour à la cote</Link>
          </p>
        </section>
      </div>
    </article>
  );
}
