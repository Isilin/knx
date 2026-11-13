---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# Surface brief — KNX, application (Marché, Fiche entreprise, Relevés, Méthodologie)

- **Mode :** Operate. Lecteurs : joueurs de Dreadcast après le relevé du jour. Opérateur·rice : saisie quotidienne.
- **Tâches :** lire le relevé en moins de 10 s (classement, hausses/baisses, nouvelles/radiées) ; ouvrir la fiche d'une entreprise ; saisir un relevé en moins d'une minute.
- **Contenu :** relevé quotidien réel (52 entreprises), historique importé du tableur, valeurs dérivées (CA réel, âge estimé) toujours marquées estimées. Pas d'indices en v1.
- **Contraintes :** structure de bourse classique ; brief complet dans `docs/brief-knx.md`.
- **Moment mémorable :** le sceau guilloché de chaque entreprise, tracé à l'ouverture de sa fiche.
- **Non résolu :** formules du tableur (attente du .xlsx), taxonomie groupes/secteurs, graphique d'accueil (top 10 proposé), validation des envois du userscript.

## Direction contract

THESIS: La cote présentée comme le rapport annuel d'une mégacorpo : grille suisse stricte, chiffres fins et grands, rigueur de conglomérat. Refuse le tableau de bord sombre générique à cartes KPI arrondies et le costume de terminal néon.

OWN-WORLD: Laque noire légèrement froide, filets graphite, dorure champagne réservée à l'identité (marque, règles de tête, onglet actif, sceaux). Texte ivoire, chiffres Hanken Grotesk 300 à grande échelle, libellés en petites capitales espacées. Vert et rouge uniquement pour les variations ; violet pointillé pour tout ce qui est estimé ; une fine bande néon par groupe défini. Aucun arrondi, aucune ombre portée décorative.

STORY: Le lecteur voit d'abord les faits du relevé, puis qui bouge, puis la cote entière ; il comprend que KNX garde la mémoire que le jeu n'a pas, distingue publié et estimé, et ouvre la fiche d'une entreprise pour en lire l'histoire.

FIRST VIEWPORT: En-tête : marque KNX dorée à gauche, onglets (Marché, Corporations, Relevés, Méthodologie), date du relevé et recherche à droite. Rangée des faits du relevé, six colonnes à filet de tête. Zone principale : graphique du top 10 sur 30 jours (survolée ou suivie en pleine encre, autres atténuées), colonne droite des mouvements du jour. Sous le pli : la cote, chaque ligne avec son sceau.

FORM: Rapport annuel de mégacorporation (laque, dorure, grille suisse), troisième direction de la lignée « safer » présentée, choisie par l'utilisateur. seed:3e5398f409ea3c1a. Signature interaction : liaison croisée, survoler une entreprise dans le graphique ou la cote la met en avant partout ; motion : sceau tracé une fois à l'ouverture de la fiche, chiffres interpolés au changement de période, rien d'autre.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
