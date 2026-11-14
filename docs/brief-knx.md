# Brief de design — KNX (Kessler & Nomura Exchange)

Validé le 2026-11-13 (impeccable shape). Produit : voir `PRODUCT.md`.
Direction choisie au 3e tour : « Rapport Annuel de Mégacorpo » (carte `grounded-rapport`, registre safer, `seed:3e5398f409ea3c1a`). Build code-led.
Référence de composition : `.impeccable/mocks/decision/grounded-rapport.html`.

## 1. Pour qui, pour quoi
- **Lecteurs :** communauté des joueurs de Dreadcast, après le relevé du jour : qui monte, qui chute, situer une entreprise.
- **Opérateur·rice :** injecte le relevé.
- **Mode :** Operate (outil de consultation). Clarté et repères boursiers avant expression.

## 2. Résultat attendu
- Relevé du jour compris en moins de 10 s : classement, hausses et baisses, nouvelles et disparues.
- Saisie quotidienne en moins d'une minute.
- Estimé (CA réel reconstitué, âge) jamais confondu avec publié.
- Formules du tableur reprises et affinées : âge estimé, CA réel du jour, facteur d'activité, chiffre normalisé, CA Evol.

## 3. Direction : « Rapport Annuel de Mégacorpo »
- Laque noire, dorure champagne, grille suisse stricte ; grands chiffres en graisse fine (Hanken Grotesk, auto-hébergée) ; montants en `¢`.
- Estimations en violet pointillé. Bande néon de marque par groupe, seulement si un groupe est défini ; or sinon.
- **Signature, « le sceau » :** rosette guillochée générée de façon déterministe par entreprise, à partir de données stables (nom, date de création), jamais de métriques quotidiennes. Identité partout : cote, légendes, en grand en tête de fiche.
- Structure de place boursière classique. La rangée d'indices de l'esquisse devient les **faits du relevé** (n°, date, cotées, actives / à l'arrêt, nouvelles, radiées).

## 4. Périmètre v1
| Écran | Contenu |
|---|---|
| **Marché** (accueil) | Faits du relevé ; mouvements du jour ; graphique du top 10 dans le temps, entreprise survolée ou suivie mise en avant, autres atténuées *(proposition)* ; cote complète des 52 triable, recherche, filtres groupe/secteur une fois saisis |
| **Fiche entreprise** | Sceau ; rang et historique ; CA publié et CA réel estimé ; capital ; employés ; âge estimé avec marge d'erreur ; ratios ; groupe, secteur ; faits marquants (record, chute, entrée ou sortie du top 10) |
| **Relevés** (protégé) | Formulaire simple ou collage du rapport → aperçu des différences (nouvelles, disparues, aberrantes) → publication ; import de l'historique du tableur ; journal ; groupes, secteurs, alias |
| **Méthodologie** | Calcul du CA réel, de l'âge et des valeurs dérivées, voix de KNX |

- **Plus tard :** indices (général, groupes, secteurs) et leurs pages ; userscript in-game qui envoie les relevés. Dès la v1, la saisie passe par un point d'entrée qui accueillera le userscript ; même aperçu des différences quelle que soit la source.
- **Exclus :** reproduire les onglets du tableur, costume de terminal Bloomberg, néon décoratif sur les données, fausses actualités, secteurs présentés comme officiels.

## 5. Données et cas
- 40 à 80 entreprises ; Chiffre 0 → ~700 000 ¢ ; Capital 3 000 → 30 M ¢ ; 0 à 8 employés.
- Entreprise à 0 (« à l'arrêt ») ; nouvelle sans historique ; disparue (« radiée », historique conservé) ; jours manquants ; relevé du jour non publié ; doublon ; rapport mal formé (espaces avant tabulations, CRLF) ; âge estimé aberrant ; CA réel calculé négatif.

## 6. Interaction et mise en page
- Onglets en haut, recherche globale tolérante aux accents.
- Tableaux triables ; périodes 7 j / 30 j / 90 j / tout ; survol des courbes avec valeurs exactes.
- Entreprises suivies mémorisées par navigateur, mises en avant d'écran en écran.
- Couleur jamais seule porteuse : signe et flèche pour les variations, libellé pour les groupes.
- Mobile : faits du relevé en défilement horizontal ; cote réduite à rang, nom, CA, variation ; fiche en une colonne.
- Animations sobres : chiffres au changement de période, sceau tracé une fois à l'ouverture de la fiche.

## 7. Contraintes et décisions ouvertes
- **Stack :** Vite+ complet, TypeScript 7, React 19 ; Vercel ; Supabase via l'intégration Vercel (lecture publique, admin protégé) ; GitHub Actions.
- **Ouvert :**
  1. Formules du tableur à lire (seules les valeurs ont été récupérées via gviz).
  2. Fiabilité du CA réel : erreur d'arrondi amplifiée par l'âge ; écart exact en jours entre relevés requis ; âge estimé de façon robuste (médiane, rejet des aberrations). Exemple réel : [Import] → relevé du 13.11 donne un CA réel négatif pour Armacham Technology.
  3. Groupes et secteurs (filtres) : groupes déduits des noms (Armacham ×5, Sovereign ×5, Donnellys ×2 ; Donnestyle à trancher) ; secteurs à définir.
  4. ~~Envoi par userscript : publication directe ou validation ?~~ Tranché : validation. L'envoi attend dans Relevés et se publie en un clic (`docs/api-module-jeu.md`).
  5. Graphique d'accueil : top 10 dans le temps, à confirmer.
  6. Thème clair éventuel plus tard ; sombre par défaut.
- Français uniquement, nombres au format français, contrastes WCAG AA.

**Ordre de construction :** modèle de données et import historique → admin des relevés (formulaire, collage) → Marché → fiche entreprise → Méthodologie.
