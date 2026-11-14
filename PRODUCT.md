# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Choisi par l'utilisateur·rice (2026-11-13) :
- **Vite+** complet (toolchain unifiée : dev/build, tests, lint, format) ;
- **TypeScript 7** ;
- **React 19** ;
- hébergement **Vercel**, base **Supabase** via l'intégration Vercel ;
- CI **GitHub Actions**.

Contrainte structurante : lecture publique pour toute la communauté, saisie des relevés réservée à l'opérateur·rice (accès protégé).

## Users

- **Lecteurs : la communauté des joueurs de Dreadcast** (JdR cyberpunk par navigateur, ~90 connectés simultanés, record ~214 sur 7 jours). Ils consultent la place boursière comme une institution de la cité : situer une corporation, suivre une tendance, nourrir le roleplay (articles EDC, forum, events).
- **Opérateur·rice : le porteur du projet.** Relève chaque jour le rapport « Corporations » en jeu et l'injecte dans l'app. Remplace aujourd'hui ce travail par un tableur Google.

## Product Purpose

**KNX — Kessler & Nomura Exchange.** Remplacer le tableur de relevés par une place boursière in-universe : injecter le relevé quotidien, accumuler l'historique, et rendre lisible l'évolution des corporations par des graphiques et des tableaux de bord (des indices viendront plus tard). Succès : la communauté s'y réfère pour savoir qui monte, qui chute et pourquoi ; la saisie quotidienne prend moins d'une minute.

## Positioning

Le jeu ne publie qu'un instantané quotidien, et sa colonne « Chiffre » est une moyenne lissée depuis la création. Cette app est la seule à garder la mémoire des relevés et à reconstituer le chiffre d'affaires réel de chaque jour, à partir d'une estimation de la date de création de chaque corporation. Elle se présente comme une institution du monde de Dreadcast, pas comme un outil de fan.

## Operating Context

- **Source :** rapport « Corporations » consultable en jeu, mis à jour une fois par jour, copié en texte brut. Colonnes : `Class.`, `Nom`, `Chiffre`, `Capital`, `Employés`, séparées par tabulations ; milliers séparés par des points (`677.085`, `27.120.847`).
- **Monnaie :** le crédit impérial, noté le plus souvent `¢`, parfois `Cr`.
- **Sémantique confirmée :** `Chiffre` = chiffre d'affaires quotidien moyen = CA cumulé total ÷ nombre de jours d'activité depuis la création. CA cumulé ≈ Chiffre × jours d'activité ; CA du jour ≈ cumul(J) − cumul(J−1).
- **Date de création :** non publiée directement ; l'opérateur·rice a une méthode d'estimation dans le tableur, à reprendre et à affiner.
- **Monde :** la cité de Dreadcast, bâtie par les frères Enclism après l'effondrement ; l'Impérium gouverne ; les insurgés de la Lame Sanglante tiennent leur propre secteur. Espace communautaire EDC (articles de joueurs), forum, wiki DC.

## Capabilities and Constraints

- Surfaces confirmées : tableau de bord de toutes les entreprises ; fiche détaillée de chaque entreprise ; d'autres vues à venir.
- **Pas d'indices pour l'instant** : le premier périmètre ne porte que sur les entreprises et leurs données brutes et calculées. Les indices (composite, par groupe, par secteur) viendront plus tard.
- Ingestion d'un relevé par le userscript du jeu, qui envoie le rapport à l'app ; l'envoi attend la validation d'un·e opérateur·rice, avec contrôle avant publication (noms nouveaux, disparus, renommages, valeurs aberrantes). La saisie manuelle (formulaire, collage du rapport) a été retirée.
- Import de l'historique existant depuis le tableur Google.
- Calculs dérivés : reprendre les formules du tableur (âge estimé, CA réel journalier, facteur d'activité, chiffre normalisé…) en les affinant ; variations.
- Les noms contiennent apostrophes, accents, `™` ; ils doivent rester exacts au caractère près.
- Corporations qui apparaissent, disparaissent, ou sont à `0` (ex. `Advenio`, `Paradox`) ; effectifs à `0` possibles.
- **Non décidé :** méthodologie des futurs indices ; regroupements (groupes apparents par nom : Armacham, Sovereign, Donnellys ; secteurs : banques, bars, immobilier…) à confirmer.

## Brand Commitments

- **Nom : KNX — Kessler & Nomura Exchange.** Monnaie affichée : crédit impérial, `¢`.
- **In-universe :** l'app est un objet du monde de Dreadcast. Noms, textes et ton écrits comme si l'institution existait dans la cité.
- Cohérence avec le lore officiel (Impérium, Lame Sanglante, cité de Dreadcast) ; ne rien inventer qui contredise le canon.
- **Structure de place boursière classique** (préférence exprimée le 2026-11-13 après deux relances) : organisation et lisibilité au niveau des plateformes de référence (TradingView, Boursorama, Yahoo Finance). L'univers passe par la matière et les détails, jamais par une structure exotique.
- Ambiance cyberpunk « corpo efficace » demandée ; éléments appréciés : rosettes guillochées des titres, clarté du tableau de bord standard.

## Evidence on Hand

- Relevé réel du 2026-11-13 : `E:\Downloads\Corporations.txt` (52 corporations ; Chiffre de 0 à 677.085 ; Capital de 3.340 à 29.394.042 ; Employés de 0 à 8).
- Tableur Google existant (historique, méthode d'estimation de date de création) : https://docs.google.com/spreadsheets/d/1n1pHCh0fOi7Rnoov6uicRU7J0ZeNU6YufPD4fmAyeOM — accès à obtenir.
- Absents, à ne pas fabriquer : secteurs officiels des corporations, dates de création réelles, propriétaires, actualités économiques du jeu.

## Product Principles

1. **Le relevé du jeu fait foi.** Toute valeur estimée (CA réel, date de création) est marquée comme telle et distinguée de la valeur publiée.
2. **L'évolution avant l'instantané.** Le jeu donne déjà le classement du jour ; chaque écran apporte du temps : tendance, rupture, mouvement.
3. **Une institution de la cité, une méthode lisible.** Voix in-universe, mais un joueur doit pouvoir comprendre d'où sort chaque indice.
4. **Validation quotidienne en moins d'une minute.** Le module envoie, l'opérateur·rice vérifie et publie.
5. **Tenir avec peu de données.** Premiers jours d'historique, nouvelles corporations, valeurs nulles : aucun écran ne casse ni ne ment.
