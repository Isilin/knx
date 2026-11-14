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
  écrit `public/data/history.json` et `supabase/seed.sql`. Une corporation est suivie par un
  identifiant : un nom absent puis revenu, ou dont le chiffre retombe à 0, devient une nouvelle
  corporation (une fermeture est définitive).
- Fiche : logo, consortium, secteur et date de fondation se modifient depuis la page de la
  corporation (opérateurs) ; la liste des consortiums se gère sur la page Relevés. L'historique de
  chaque fiche mêle faits lus dans les relevés, renommages enregistrés à la publication et
  évènements saisis.

```bash
node scripts/import-sheet.ts "data/source/Données entreprises.xlsx" \
  --report "data/source/releves/2026-11-13.txt=2026-11-13"
```

`data/source/` est ignoré par git : on n'y versionne pas l'export brut.

## Brancher Supabase et Vercel

1. Créer le projet sur Vercel (import du dépôt GitHub), puis ajouter l'intégration **Supabase**
   depuis le Marketplace Vercel : elle crée la base et injecte `NEXT_PUBLIC_SUPABASE_URL` et la clé
   publique (`NEXT_PUBLIC_SUPABASE_ANON_KEY` ou `…_PUBLISHABLE_KEY`). KNX les lit telles quelles.
2. Dans l'éditeur SQL Supabase, exécuter dans l'ordre les fichiers de `supabase/migrations/` :
   `20261113000000_init.sql`, `20261113100000_userscript_api.sql` (clés et envois du module de
   jeu), `20261114000000_fiche_identite_historique.sql` et
   `20261114100000_publication_envois_identite.sql`, puis `supabase/seed.sql` pour charger
   l'historique. Sur une base déjà remplie, exécuter seulement les migrations manquantes : la
   fiche-identité garde les relevés, crée les consortiums, scinde Paradox (fermée puis rouverte le
   11 novembre 2026) et ajoute le bucket Storage `company-logos`. Le seed remplace tout le
   registre : ne pas le relancer après des modifications faites depuis le site.
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
`Authorization: Bearer knx_…`. L'envoi attend dans Relevés, contrôlé comme un rapport collé, jusqu'à
ce qu'un opérateur le publie ou le rejette. Contrat complet : `docs/api-module-jeu.md`.

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

- Indices (général, par groupe, par secteur).
- Module de jeu : envoyer le texte brut du rapport (`{ date, report }`) et le lire côté KNX ; corriger
  un envoi dans l'éditeur avant publication ; pastille du nombre d'envois en attente.
