# KNX — Kessler & Nomura Exchange

La place boursière des corporations de Dreadcast : la cote quotidienne, l'historique de chaque
entreprise et les estimations que le jeu ne publie pas (âge, CA réel). Produit : `PRODUCT.md` ·
brief de design : `docs/brief-knx.md`.

## Stack

Vite+ (dev, build, tests, lint, format) · TypeScript 7 · React 19 · React Router 8 ·
Supabase (Postgres + Auth) · Vercel · GitHub Actions.

## Démarrer

```bash
pnpm install        # ou : vp install
vp dev              # http://localhost:5173
```

Sans variables Supabase, KNX tourne en **mode local** : il lit `public/data/history.json` et les
relevés saisis dans la page Relevés restent dans le navigateur.

| Commande | Rôle |
|---|---|
| `vp check` | format (Oxfmt), lint (Oxlint) et types (TypeScript 7) |
| `vp test` | tests du domaine (Vitest) |
| `vp build` | build de production dans `dist/` |
| `pnpm import:sheet` | régénère l'historique depuis le tableur |

## Données

- `src/domain/` : parsing du rapport, estimation de l'âge, CA réel, indicateurs, contrôle des
  relevés. Tout le calcul vit là, testé.
- `scripts/import-sheet.ts` : lit l'export `.xlsx` du tableur historique (valeurs uniquement) et
  écrit `public/data/history.json` et `supabase/seed.sql`.
- **Fiches et vies.** Une vie (`companies`) va de la fondation d'une corporation à sa fermeture :
  âge, CA moyen, CA réel, indicateurs et risque se calculent par vie, comme dans le jeu. Un nom
  absent puis revenu, ou dont le chiffre retombe à 0, ouvre une nouvelle vie ; une vie fermée ne
  rouvre pas. Une corporation détruite puis refondée sous le même nom garde sa **fiche**
  (`company_profiles` : adresse, sceau, logo, consortium, secteur, masquage, historique) : la fiche
  montre toutes ses vies sur une frise continue, coupée à chaque destruction, et ses indicateurs
  portent sur la vie en cours. À la publication, une refondation ou un retour sous un ancien nom
  est proposé au rattachement (coché par défaut) ; décoché, c'est une corporation distincte.
- Fiche : logo, consortiums, secteur et date de fondation se modifient depuis la page de la
  corporation (opérateurs) ; la liste des consortiums se gère sur la page Relevés.
- **Consortiums datés.** Une corporation peut quitter son consortium et en rejoindre un autre :
  l'appartenance est une suite de périodes (`consortium_memberships` : du jour d'entrée inclus au
  jour de départ exclu ; une seule à la fois). La fiche affiche le consortium du dernier relevé,
  l'historique écrit chaque mouvement, et tout chiffre lu par consortium dans le temps prend
  l'appartenance de la date du relevé (`consortiumOn`, `src/domain/market.ts`). Supprimer un
  consortium efface aussi ses périodes. L'historique de
  chaque fiche mêle faits lus dans les relevés, renommages enregistrés à la publication et
  évènements saisis. Les évènements de marché (une règle du jeu, une faille) se gèrent sur la page
  Relevés : chacun s'affiche dans l'historique de toutes les corporations cotées à sa date et sur
  les graphiques.
- Notation de l'Agence impériale : un opérateur note une corporation depuis sa fiche (« Noter »).
  KNX remplit les critères qu'il sait lire (croissance, trésorerie, rentabilité, équipe), l'Agence
  apprécie les autres ; la catégorie (Ω, α, ß, Γ, Δ, ε) et l'indice de confiance se calculent en
  direct. Une notation publiée est figée ; pour la corriger, la retirer et noter à nouveau. Barèmes,
  pondérations et seuils : `RATING_METHOD` dans `src/domain/rating.ts` (méthode `v1`).
  La cote affiche la note (colonne et filtre), la page Marché sa répartition et les dernières
  notations. Une note passe « sous surveillance » quand, depuis sa publication, la recalculer sur
  le dernier relevé changerait sa catégorie, ou après un changement de DG, une fermeture, une sortie
  hors CA d'un quart du disponible, un capital au-delà de 30 M¢ ou un évènement de marché ; elle est
  « à revoir » au-delà d'un trimestre (`WATCH_RULES`, `src/domain/agency.ts`). La page Relevés liste
  les notations à revoir.
- **Secteurs.** La cote complète se filtre par secteur (puces, ou le secteur sous chaque nom) ;
  ses filtres vivent dans l'adresse (`/corporations?secteur=banque&groupe=armacham&statut=actives`),
  qu'on peut partager. Deux colonnes : le poids de la corporation dans les recettes de son secteur
  sur 30 jours, et l'écart de sa dynamique à la médiane du secteur (une médiane plutôt qu'une
  somme : un pic de recettes, presque gratuit à fabriquer en jeu, ne déplace pas la référence).
  La fiche montre son rang dans le secteur, ses concurrents côte à côte et sa part du secteur dans
  le temps ; cette part n'est tracée qu'aux relevés où les corporations classées font au moins
  90 % des recettes du marché, les secteurs des corporations fermées n'étant pas tous connus
  (`src/domain/sectorStats.ts`).
- **Page Secteurs** (`/secteurs`), sur le dernier relevé : les secteurs côte à côte sur une mesure
  au choix (recettes, corporations, effectif, capital, recette par employé et recettes rapportées
  au capital, ces deux dernières en médiane des corporations actives) ; la concentration de chaque
  secteur (indice de Herfindahl, concurrents équivalents, leader et sa part) ; le tableau
  secteur × consortium. La carte du marché se regroupe aussi par secteur ou par consortium.
  S'y ajoutent la contribution de chaque secteur à la croissance (recette par jour des 30 ou 90
  derniers jours face à la fenêtre précédente, en cascade) et les régimes des secteurs (activité
  et dynamique médianes, avec leur chemin sur trois mois).
- **Page Consortiums** (`/consortiums`) : la course des consortiums (recette réelle cumulée, chaque
  corporation comptant pour le consortium dont elle était membre le jour où elle a encaissé), leur
  contribution à la croissance, un portefeuille par consortium (membres, dépendance au premier,
  secteurs, mouvements datés, anciens membres) et l'effet consortium : membres et indépendantes
  comparés chacun à la médiane de son secteur, puis la recette avant et après chaque adhésion ou
  départ daté (`src/domain/groupHistory.ts`). Tant qu'aucune adhésion n'est datée, chaque
  consortium compte ses membres actuels sur tout l'historique ; la page le signale.
- **Page Études** (`/etudes`), lectures exploratoires (`src/domain/studies.ts`) : la filière de
  production en trois étages, usines → boutiques et bars → ateliers (`SUPPLY_CHAIN` : recettes
  semaine par semaine, et pour chaque maillon la corrélation des variations selon le décalage ;
  technopôles, banques et agences immobilières hors chaîne), le choc de chaque évènement de marché par secteur (capital avant et après,
  corporations au-delà de 30 M¢, recettes autour), les quartiers × secteurs, et la qualité des
  recettes (rétention du profil de risque, médiane par secteur, corporations tenues sous le seuil
  de piratage écartées). Des pistes, pas des verdicts : chaque section dit ses limites.
- Corporations masquées : une corporation qui n'est pas une entreprise de joueurs (MJ Immo, tenue
  par les MJ) se masque depuis la page Relevés. Elle disparaît de la cote, des graphiques, des
  décomptes et des parts de marché, mais ses lignes restent lues et publiées avec chaque relevé ;
  les rangs restent ceux imprimés par le jeu.

```bash
node scripts/import-sheet.ts "data/source/Données entreprises.xlsx" \
  --report "data/source/releves/2026-11-13.txt=2026-11-13"
```

`data/source/` est ignoré par git : on n'y versionne pas l'export brut.

### Corporations détruites : l'historique des versions du tableur

Les colonnes des corporations détruites ont été supprimées du tableur au fil du temps ; leurs
relevés ne vivent plus que dans l'historique des versions. L'API Drive n'en liste que quelques
révisions consolidées, mais l'export accepte tous les numéros de révision (une suite d'entiers,
environ 12 700 en novembre 2026).

1. Dans le tableur : Extensions → Apps Script, coller `scripts/sheet-versions.gs`, ajouter le
   service **Drive API**, lancer `scanRevisions` et autoriser l'accès. Le script parcourt
   « Chiffre quotidien » de 50 en 50 révisions, repère chaque colonne qui disparaît (ou est vidée
   puis recréée), cherche par dichotomie la dernière révision où elle est intacte et n'exporte que
   celles-là. Il s'arrête avant la coupure des 6 minutes et se relance seul (déclencheur) jusqu'à
   « Terminé » ; `scanStatus` dit où il en est, `resetScan` repart de zéro.
2. Télécharger le dossier Drive « KNX — révisions du tableur » et l'extraire dans
   `data/source/versions/`.
3. Relancer l'import avec les versions :

```bash
node scripts/import-sheet.ts "data/source/Données entreprises.xlsx" \
  --report "data/source/releves/2026-11-13.txt=2026-11-13" \
  --versions data/source/versions \
  --backfill supabase/backfill/20261117_corporations_detruites.sql   --renames supabase/backfill/20261118_renommages.sql
```

L'import compare chaque version à la suivante : une colonne disparue (ou vidée puis recréée sous
le même nom, au moins trois chiffres perdus) est récupérée dans son dernier état, sans ses zéros
de fin. Une colonne dont les chiffres continuent sous un autre nom est un renommage : l'ancien nom
devient un ancien nom de la fiche (Hypercore, puis Kessler Distribution™ → NeuroCore Systems).
Il affiche les colonnes récupérées, les chiffres en conflit, les fiches à plusieurs vies et les
anciens noms : à relire avant de publier. Un homonyme sans lien avec son prédécesseur se déclare
dans `SEPARATE_NAMESAKES` (`scripts/import-sheet.ts`). `--backfill` écrit le SQL qui ajoute ces
vies et ces anciens noms à une base déjà remplie, sans toucher au reste ; `--renames` écrit les
changements de nom datés (moment où l'en-tête a changé), qui s'affichent dans l'historique des
fiches ; ce second fichier peut être rejoué sans doublon.

## Brancher Supabase et Vercel

1. Créer le projet sur Vercel (import du dépôt GitHub), puis ajouter l'intégration **Supabase**
   depuis le Marketplace Vercel : elle crée la base et injecte `NEXT_PUBLIC_SUPABASE_URL` et la clé
   publique (`NEXT_PUBLIC_SUPABASE_ANON_KEY` ou `…_PUBLISHABLE_KEY`). KNX les lit telles quelles.
2. Dans l'éditeur SQL Supabase, exécuter dans l'ordre les fichiers de `supabase/migrations/` :
   `20261113000000_init.sql`, `20261113100000_userscript_api.sql` (clés et envois du module de
   jeu), `20261114000000_fiche_identite_historique.sql`,
   `20261114100000_publication_envois_identite.sql`, `20261114200000_retrait_releve.sql`
   (retrait du dernier relevé depuis le journal), `20261115000000_evenements_marche.sql`
   (évènements de marché, dont la Faille ZD-385), `20261116000000_corporations_masquees.sql`
   (corporations masquées, dont MJ Immo), `20261117000000_notation_agence.sql` (notations et
   quartier des corporations), `20261118000000_fiches_vies.sql` (une fiche pour plusieurs
   vies), `20261119000000_adhesions_consortiums.sql` (consortiums datés : chaque consortium
   actuel devient une période ouverte, à dater ensuite depuis les fiches),
   `20261120000000_cours_theorique.sql` (réglages de la valeur KNX, opérations sur titres et
   bilans ; sans elle, le site tourne avec les réglages par défaut, sans corporation introduite
   ni bilan), `20261121000000_comptes_investisseurs.sql` (comptes des joueurs et mouvements
   de crédits) , `20261122000000_seances_marche.sql` (séances hebdomadaires, ordres, exécutions,
   initiés), `20261123000000_report_ordres_classement.sql` (report des ordres, classement
   des investisseurs volontaires), `20261124000000_modele_c_introduction.sql` (comptes de
   corporation, offres de titres, enchère entre investisseurs),
   `20261125000000_modele_c_dividendes_capital.sql` (politiques de distribution, dividendes,
   augmentations de capital) et `20261126000000_modele_c_successions.sql` (gel des comptes,
   successions, saisies), puis
   `supabase/seed.sql` pour charger l'historique. Sur une base déjà remplie, exécuter
   seulement les migrations manquantes : la fiche-identité garde les relevés, crée les
   consortiums, scinde Paradox (fermée puis rouverte le 11 novembre 2026) et ajoute le bucket
   Storage `company-logos` ; `fiches_vies` crée une fiche par nom (les deux vies de Paradox
   partagent la leur) et y déplace logo, consortium, secteur, quartier et masquage ; les
   notations restent attachées à la vie notée. Le seed remplace tout le registre, notations
   comprises : ne pas le relancer après des modifications faites depuis le site. Pour y ajouter
   les corporations détruites retrouvées dans l'historique du tableur, exécuter une fois
   `supabase/backfill/20261117_corporations_detruites.sql` (après une sauvegarde) : il refuse de
   passer deux fois.
3. Authentication → URL Configuration :
   - **Site URL** : l'adresse de production, par exemple `https://knx.vercel.app` (pas localhost :
     c'est l'adresse de repli quand une redirection n'est pas autorisée).
   - **Redirect URLs** : toutes les adresses d'où l'on peut se connecter, avec `/**` pour couvrir
     `/releves` :
     - `https://knx.vercel.app/**` (production, et chaque domaine personnalisé) ;
     - `https://*-<compte-vercel>.vercel.app/**` (déploiements de prévisualisation) ;
     - `http://localhost:5173/**` (développement).

   Le lien de connexion renvoie vers `<adresse courante>/releves` ; si cette adresse ne correspond à
   aucune entrée, Supabase redirige vers le Site URL. Un lien déjà envoyé garde l'ancienne
   redirection : en redemander un après la correction.
4. Authentication → Users → **Add user → Create new user** : adresse de l'opérateur, mot de passe,
   cocher « Auto Confirm User » (aucun e-mail envoyé). Puis l'enregistrer comme admin :
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'operateur@exemple.org';
   ```
   Si le compte existe déjà (invité sans mot de passe), lui en donner un en SQL (le mot de passe
   reste dans l'historique de l'éditeur : préférer la création ci-dessus quand c'est possible) :
   ```sql
   update auth.users
   set encrypted_password = extensions.crypt('mot-de-passe', extensions.gen_salt('bf'))
   where email = 'operateur@exemple.org';
   ```
5. Redéployer. La page Relevés propose la connexion par **mot de passe** (par défaut) ou par lien
   e-mail ; seuls les admins peuvent publier (RLS + fonction `publish_snapshot`).
6. Module de jeu : créer une clé dans **Relevés → Clés du module de jeu** et la saisir dans le
   userscript. Facultatif : `KNX_CORS_ORIGINS` (variable Vercel, origines séparées par des virgules)
   restreint les pages autorisées à appeler l'API avec `fetch` ; par défaut toutes, la clé suffisant
   à protéger l'API.
7. Comptes investisseurs : la création d'un compte joueur passe par la fonction `/api/v1/comptes`,
   qui a besoin de la **clé de service** Supabase dans les variables Vercel :
   `SUPABASE_SERVICE_ROLE_KEY` (ou `SUPABASE_SECRET_KEY`). L'intégration Vercel ↔ Supabase l'ajoute
   en général ; sinon la copier depuis Supabase (Project Settings → API keys). Elle ne quitte jamais
   le serveur. Les joueurs se connectent sur `/compte` avec leur identifiant de cinq chiffres ; leur
   adresse technique (`knx-<identifiant>@example.com`) ne reçoit jamais d'e-mail.

**Limite d'e-mails.** Le service d'e-mail intégré de Supabase n'envoie que 2 e-mails par heure pour
tout le projet (liens de connexion compris) ; au-delà, la page Relevés affiche « trop de liens
demandés ». Pour lever la limite, configurer un SMTP (Authentication → SMTP Settings, par exemple
Resend ou Brevo), puis ajuster Authentication → Rate Limits.

En local, copier les deux variables publiques dans `.env.local` pour travailler sur la vraie base.

`vercel.json` installe pnpm via corepack et sert l'app en SPA, sauf `/api/*` qui reste aux fonctions
Vercel. Si le build Vercel refuse corepack, définir `ENABLE_EXPERIMENTAL_COREPACK=1` dans les
variables du projet.

## API du module de jeu

Le userscript (projet séparé) envoie le rapport du jour à `POST /api/v1/releves` avec une clé
`Authorization: Bearer knx_…`. L'envoi attend dans Relevés, comparé au relevé précédent, jusqu'à ce
qu'un opérateur le publie ou le rejette. Contrat complet : `docs/api-module-jeu.md`.

- `api/v1/*.ts` : points d'entrée Vercel, trois lignes chacun.
- `src/server/` : logique HTTP testée (`vp test`), sans dépendance à Vercel.
- `src/domain/ingest.ts` : validation du relevé reçu ; la base refait les mêmes contrôles.
- La fonction n'utilise que la clé publique Supabase : les fonctions SQL `ingest_snapshot` et
  `api_key_status` vérifient la clé du module elles-mêmes.

`vp dev` ne sert pas `/api` : tester l'API sur un déploiement de prévisualisation (exemples `curl`
dans `docs/api-module-jeu.md`), ou avec `vercel dev`.

## CI

`.github/workflows/ci.yml` lance `vp check --deny-warnings`, `vp test` et `vp build` sur chaque push
vers `main` et chaque pull request.

## Plus tard

- Rattacher ou détacher une vie d'une fiche depuis le site (aujourd'hui : à la publication, ou
  dans `SEPARATE_NAMESAKES` pour l'historique).

- Indices (général, par groupe, par secteur).
- Module de jeu : envoyer le texte brut du rapport (`{ date, report }`) et le lire côté KNX ; corriger
  un envoi dans l'éditeur avant publication ; pastille du nombre d'envois en attente.
