---
name: KNX — Kessler & Nomura Exchange
description: La cote des corporations de Dreadcast, présentée comme le rapport annuel d'une mégacorpo.
colors:
  laque: "#0d0d10"
  laque-2: "#131317"
  laque-3: "#1a1a20"
  filet: "#26262c"
  filet-fort: "#3a3a43"
  ivoire: "#ecebe6"
  gris: "#a5a39c"
  gris-2: "#8f8d86"
  or: "#d6c29a"
  or-clair: "#ead9b4"
  or-sombre: "#6f6350"
  hausse: "#3ddc84"
  baisse: "#ff6b74"
  estime: "#b99cff"
  alerte: "#ff8a3d"
  g-cyan: "#22e4ff"
  g-magenta: "#ff3ccf"
  g-ambre: "#ffb21a"
  g-bleu: "#5b8cff"
typography:
  display:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 1.4rem + 2vw, 3rem)"
    fontWeight: 300
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  figure:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 300
    lineHeight: 1.15
    letterSpacing: "-0.01em"
    fontFeature: "\"tnum\", \"lnum\""
  headline:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"tnum\", \"lnum\""
  body-small:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    letterSpacing: "0.12em"
rounded:
  none: "0px"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-5: "24px"
  s-6: "32px"
  s-7: "48px"
  s-8: "64px"
  gutter: "clamp(16px, 2.4vw, 32px)"
  page-max: "1640px"
components:
  button-primary:
    backgroundColor: "{colors.ivoire}"
    textColor: "{colors.laque}"
    rounded: "{rounded.none}"
    padding: "0 24px"
    height: "38px"
  button-primary-hover:
    backgroundColor: "color-mix(in oklab, {colors.ivoire}, white 45%)"
  button-primary-disabled:
    backgroundColor: "{colors.laque-3}"
    textColor: "{colors.gris-2}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ivoire}"
    rounded: "{rounded.none}"
    padding: "0 24px"
    height: "38px"
  button-quiet-hover:
    backgroundColor: "{colors.laque-2}"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.gris}"
    typography: "{typography.body-small}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "32px"
  chip-selected:
    textColor: "{colors.ivoire}"
  input:
    backgroundColor: "{colors.laque-2}"
    textColor: "{colors.ivoire}"
    rounded: "{rounded.none}"
    padding: "8px 12px"
    height: "38px"
  segmented-tab:
    backgroundColor: "transparent"
    textColor: "{colors.gris}"
    typography: "{typography.body-small}"
    padding: "4px 0"
  segmented-tab-active:
    textColor: "{colors.ivoire}"
  tooltip:
    backgroundColor: "{colors.laque-2}"
    textColor: "{colors.ivoire}"
    typography: "{typography.body-small}"
    rounded: "{rounded.none}"
    padding: "12px 16px"
---

# Design System: KNX — Kessler & Nomura Exchange

## Overview

**Creative North Star: "Le Rapport annuel de la mégacorpo"**

KNX se lit comme le rapport annuel imprimé d'un conglomérat : une laque noire légèrement froide, des filets graphite d'un pixel, de grands chiffres fins en Hanken Grotesk 300, une grille suisse stricte. La rigueur vient de l'alignement et de la retenue, pas de la décoration. La dorure champagne ne marque que l'identité et la sélection ; tout le reste est ivoire sur laque.

La densité est celle d'une place boursière de référence : faits du relevé en colonnes à filet de tête, graphique multi-séries, cote tabulaire complète. L'univers passe par la matière (laque, dorure, sceaux guillochés générés depuis le nom de chaque corporation, bandes néon des groupes), jamais par une structure exotique. Le système refuse explicitement le tableau de bord sombre générique à cartes KPI arrondies et le costume de terminal néon.

Le système est sombre uniquement : la laque est le seul fond livré (`color-scheme: dark`). Un thème clair est différé et n'a aucun token.

**Key Characteristics:**
- Laque noire, filets d'un pixel, aucun arrondi, aucune ombre décorative.
- Dorure réservée à l'identité et à la sélection ; boutons primaires ivoire.
- Grands chiffres en graisse 300, chiffres tabulaires et alignés partout.
- Trois codes sémantiques stricts : variation (vert/rouge + triangle), estimation (violet pointillé), alerte (orange).
- Une fine bande néon par groupe de corporations.
- Sceau guilloché unique par entreprise, tracé une fois à l'ouverture de sa fiche.

## Colors

Une palette de laque et d'encres, où chaque teinte saturée porte un sens unique et ne sert jamais d'ornement.

### Primary
- **Dorure champagne** (or): la marque KNX, la règle de tête de la cote et du premier fait, le soulignement d'onglet actif et de sélection, la bordure de puce sélectionnée, l'anneau de focus, le curseur de saisie, la sélection de texte, les sceaux. Jamais un fond de bouton, jamais une série de données.
- **Dorure claire** (or-clair): nom d'une corporation suivie dans la cote.
- **Dorure éteinte** (or-sombre): soulignement des liens, séparateurs internes des faits, réticule de survol du graphique.

### Secondary
- **Violet d'estimation** (estime): toute valeur que KNX calcule plutôt que lit dans le jeu (CA réel, date de création et âge, indicateurs, poids économique), toujours avec un soulignement pointillé ou un trait pointillé à extrémités rondes. Survolable, avec la marge d'incertitude en infobulle.

### Tertiary
- **Vert de hausse** (hausse) et **Rouge de baisse** (baisse): variations uniquement (pourcentages, rangs, scores), toujours doublés d'un triangle dessiné ou d'un signe.
- **Orange d'alerte** (alerte): statut (radiée, inactive), fiabilité moyenne, avertissements de saisie.
- **Néons de groupe**: Armacham cyan (g-cyan), Sovereign magenta (g-magenta), Donnellys ambre (g-ambre), bleu de réserve (g-bleu) pour un groupe nouveau. Portés par une bande de 14 × 2 px dans les étiquettes et légendes, et comme couleur de série dans les graphiques. Les indépendantes sont ivoire dans les graphiques.

### Neutral
- **Laque** (laque): fond unique de l'application, des en-têtes de tableau collants, du contour des points de survol.
- **Laque relevée** (laque-2): survol de ligne, champs de saisie, notes, infobulles et listes de recherche.
- **Laque haute** (laque-3): option active dans une liste, bouton désactivé.
- **Filet** (filet): séparateurs de lignes et de sections, grille du graphique, bordure de champ et de puce au repos.
- **Filet fort** (filet-fort): règle de tête des faits secondaires et des KPI, bordure d'en-tête de tableau, bordures des boutons discrets et des élévations.
- **Ivoire** (ivoire): texte principal, chiffres, fond du bouton primaire.
- **Gris** (gris): texte secondaire, libellés, unités, axes.
- **Gris éteint** (gris-2): valeurs absentes (—), compteurs, notes de source, texte de bouton désactivé.

### Named Rules
**The Gold Is Identity Rule.** La dorure marque qui parle (KNX, le sceau) et ce qui est choisi (onglet, tri, puce, focus). Si un élément doré n'est ni l'un ni l'autre, il est faux.

**The Violet Means Estimated Rule.** Toute valeur estimée est violette et pointillée ; aucune valeur publiée par le jeu ne l'est jamais. Le lecteur doit pouvoir séparer publié et estimé sans lire une légende.

**The Colour Never Alone Rule.** Vert et rouge n'apparaissent que sur une variation, et toujours avec un triangle dessiné, un signe ou un `=`.

## Typography

**Display Font:** Hanken Grotesk Variable (auto-hébergée, avec ui-sans-serif, system-ui)
**Body Font:** Hanken Grotesk Variable
**Label/Mono Font:** la même famille ; pas de monospace.

**Character:** une grotesque unique, du 300 très fin pour les grands chiffres et titres jusqu'au 600 de la marque. Le contraste vient de la graisse et de l'échelle, pas d'une deuxième famille.

### Hierarchy
- **Display** (300, clamp 2–3rem, 1.05, -0.02em): titre de page et nom de l'entreprise sur sa fiche.
- **Figure** (300, 1.875rem, 1.15, -0.01em): valeurs des faits du relevé et des KPI ; unités et années associées en 1rem gris.
- **Headline** (500, 1.375rem, -0.01em): titres de section.
- **Body** (400, 0.875rem, 1.5): texte et cellules de la cote ; noms d'entreprises en 500.
- **Body small** (400, 0.8125rem): contrôles, notes, légendes, infobulles.
- **Label** (500, 0.75rem, 0.12em, capitales): libellés de données (dt), en-têtes de colonnes (0.1em), libellés de champs et de listes.
- **Marque** (600, 1rem, 0.34em, or): « KNX » seulement.

### Named Rules
**The Thin Figures Rule.** Plus un chiffre est grand, plus il est fin : faits, KPI et rangs de la cote sont en 300.

**The Tabular Rule.** Tout le corps est en chiffres tabulaires et alignés (`tabular-nums lining-nums`), pour que les colonnes s'alignent sans effort.

**The Readable Thousands Rule.** Les milliers sont groupés par une espace insécable ordinaire (U+00A0), car l'espace fine U+202F d'Intl fait moins de 2 px dans Hanken Grotesk. Les petits pourcentages reçoivent des décimales supplémentaires plutôt que de s'afficher à 0,0 %. Le signe moins est le vrai `−`.

## Layout

Grille suisse dans un conteneur centré de 1640 px au plus, gouttière fluide clamp(16px, 2.4vw, 32px). Rythme d'espacement sur une échelle 4/8 (4, 8, 12, 16, 24, 32, 48, 64 px). Les sections se séparent par des filets horizontaux d'un pixel, pas par des cartes.

- **En-tête collant** de 60 px, laque à 94 % avec flou d'arrière-plan, filet en bas : marque à gauche, onglets, date et recherche à droite.
- **Rangées de faits / KPI** : 6 (marché) ou 5 (fiche) colonnes égales, chacune coiffée d'une règle de tête ; 3 colonnes sous 1200 px, 2 sous 640 px.
- **Zone principale du marché** : graphique fluide + colonne de 360 px séparée par un filet vertical ; empilée sous 1200 px.
- **Fiche entreprise** : sceau, titre, actions sur une grille à trois colonnes.
- **Mobile** : sous 760 px, les onglets passent sur leur propre ligne défilante (cibles de 44 px) ; sous 860 px, les colonnes secondaires de la cote se masquent ; sous 640 px, les étiquettes de fin de ligne du graphique ne gardent que le rang.

## Elevation & Depth

Système plat. La profondeur vient des tons de laque (laque → laque-2 → laque-3) et des filets, jamais d'ombres. Seuls les éléments réellement flottants au-dessus du contenu portent une ombre ambiante.

### Shadow Vocabulary
- **Infobulle du graphique** (`box-shadow: 0 10px 28px rgb(0 0 0 / 0.45)`): détache l'infobulle des séries.
- **Liste de recherche** (`box-shadow: 0 14px 32px rgb(0 0 0 / 0.5)`): popover des suggestions sous le champ.

### Named Rules
**The Only Floaters Cast Shadows Rule.** Une ombre signifie « posé au-dessus du contenu » : infobulle et popover uniquement. Aucune carte, aucun bouton, aucune section n'en porte.

## Shapes

Angles vifs partout (0 px) : boutons, champs, puces, infobulles, popovers. Le langage formel est fait de filets : 1 px pour séparer, 2 px dorés pour la règle de tête principale, soulignement intérieur de 1 px pour la sélection. Les seules courbes sont celles des sceaux guillochés et des extrémités rondes des tracés du graphique. Les marqueurs de couleur sont des bandes de 12–14 × 2 px, jamais des pastilles.

## Components

### Buttons
Sobres et nets, comme des cartouches imprimés.
- **Shape:** angles vifs (0 px), hauteur 38 px, padding horizontal 24 px.
- **Primary:** fond et bordure ivoire, texte laque en 600 ; survol blanc pur ; transition 160 ms sur fond et bordure.
- **Quiet:** transparent, texte ivoire, bordure filet fort ; au survol fond laque-2 et bordure dorée.
- **Disabled:** fond laque-3, bordure filet, texte gris éteint.
- **Suivre:** bouton discret de 36 px avec étoile au trait doré, pleine quand l'entreprise est suivie ; variante compacte de 28 px dans la cote, visible au survol de la ligne, au focus ou une fois activée.

### Chips
- **Style:** transparent, bordure filet d'1 px, texte gris en 0.8125rem, hauteur 32 px ; bande de couleur de groupe optionnelle et compteur en gris éteint.
- **State:** survol filet fort et ivoire ; sélectionnée bordure dorée et ivoire.

### Segmented (périodes, filtres)
Onglets textuels sans cadre : gris, ivoire au survol, sélection marquée par un soulignement intérieur doré d'1 px.

### Inputs / Fields
- **Style:** fond laque-2, bordure filet d'1 px, 0 px d'arrondi, hauteur 38 px (36 px pour la recherche, avec loupe au trait gris).
- **Focus:** la bordure passe à l'or ; pas d'anneau extérieur. Curseur doré.
- **Notes:** bloc laque-2 à bordure filet ; variantes avertissement, erreur et succès par une bordure orange, rouge ou verte à ~50 %.

### Navigation
Onglets de l'en-tête en 500, gris au repos, ivoire au survol, actif ivoire avec soulignement intérieur doré d'1 px au ras du filet de l'en-tête. Sur mobile, ligne défilante pleine largeur sans barre de défilement.

### La cote (tableau)
Coiffée d'une règle dorée d'1 px ; en-têtes collants en libellés capitales gris, flèche de tri dorée quand active ; lignes séparées par des filets, survol et ligne focalisée en laque-2. Rang en 300, sceau de 26 px, nom en 500, sous-ligne en libellés. Colonnes numériques alignées à droite.

### Graphique temporel
Grille en filets nets, axes gris en 11.5 px, séries d'1.25 px à 38 % d'opacité ; la série survolée ou suivie passe à 2 px pleine encre, les autres tombent à 16 %. Top 10 multi-séries avec étiquettes de fin de ligne espacées pour éviter les collisions (rang + nom court, rang seul sous 640 px), reliées par un filet coudé. Séries estimées en violet pointillé (2/4), tendance en points ronds violets. Réticule de survol en or éteint pointillé, infobulle en laque-2 à bordure filet fort.

### Liaison croisée
Une entreprise survolée ou focalisée dans le graphique, la légende, les mouvements ou la cote est mise en avant partout à la fois via un contexte de focus partagé ; les autres éléments s'atténuent (légende à 45 %, étiquettes à 30 %).

### Sceau guilloché
Rosette générée de façon déterministe depuis le nom de l'entreprise (hachage stable), au trait doré sans remplissage. À 26 px dans la cote, trait d'un pixel non mis à l'échelle. À 168 px sur la fiche, tracé une seule fois à l'ouverture (stroke-dashoffset, 1500 ms, ease-out), affiché d'emblée sous mouvement réduit.

### Valeurs (Amount, Estimated, Change)
Montants suivis d'un `¢` gris à 86 % ; valeur absente en `—` gris éteint. Estimées en violet souligné pointillé, « ≈ 0 » quand la valeur est sous l'incertitude d'arrondi. Variations en 500 avec triangle dessiné de 8 px. Les chiffres s'interpolent (520 ms, ease-out exponentiel) au changement de période, instantanément sous mouvement réduit.

## Do's and Don'ts

### Do:
- **Do** séparer par des filets d'1 px (filet, filet fort) et coiffer les rangées de chiffres d'une règle de tête.
- **Do** réserver l'or à la marque, aux sceaux, aux règles de tête et à la sélection (onglet, tri, puce, focus).
- **Do** marquer chaque valeur estimée en violet avec soulignement ou trait pointillé, et expliquer l'incertitude au survol.
- **Do** doubler chaque variation colorée d'un triangle dessiné ou d'un signe.
- **Do** composer les grands chiffres en 300, en chiffres tabulaires, milliers séparés par U+00A0.
- **Do** limiter le mouvement au tracé unique du sceau, à l'interpolation des chiffres et aux transitions d'état courtes (120–180 ms, ease-out), toujours neutralisés sous mouvement réduit.

### Don't:
- **Don't** arrondir un angle ni poser une ombre sur une carte, un bouton ou une section.
- **Don't** faire des boutons primaires dorés : ils sont ivoire.
- **Don't** utiliser le violet ou le pointillé pour une valeur publiée par le jeu.
- **Don't** utiliser vert ou rouge hors variation, ni l'orange hors alerte et statut.
- **Don't** construire le tableau de bord sombre générique à cartes KPI arrondies, ni un costume de terminal néon.
- **Don't** utiliser l'or comme couleur de série de données.
