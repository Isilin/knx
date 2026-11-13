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
  relevés. Tout le calcul vit là, testé ; voir aussi la page Méthodologie.
- `scripts/import-sheet.ts` : lit l'export `.xlsx` du tableur historique (valeurs uniquement) et
  écrit `public/data/history.json` et `supabase/seed.sql`.

```bash
node scripts/import-sheet.ts "data/source/Données entreprises.xlsx" \
  --report "data/source/releves/2026-11-13.txt=2026-11-13"
```

`data/source/` est ignoré par git : on n'y versionne pas l'export brut.

## Brancher Supabase et Vercel

1. Créer le projet sur Vercel (import du dépôt GitHub), puis ajouter l'intégration **Supabase**
   depuis le Marketplace Vercel : elle crée la base et injecte `NEXT_PUBLIC_SUPABASE_URL` et la clé
   publique (`NEXT_PUBLIC_SUPABASE_ANON_KEY` ou `…_PUBLISHABLE_KEY`). KNX les lit telles quelles.
2. Dans l'éditeur SQL Supabase, exécuter `supabase/migrations/20261113000000_init.sql`, puis
   `supabase/seed.sql` pour charger l'historique.
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

**Limite d'e-mails.** Le service d'e-mail intégré de Supabase n'envoie que 2 e-mails par heure pour
tout le projet (liens de connexion compris) ; au-delà, la page Relevés affiche « trop de liens
demandés ». Pour lever la limite, configurer un SMTP (Authentication → SMTP Settings, par exemple
Resend ou Brevo), puis ajuster Authentication → Rate Limits.

En local, copier les deux variables publiques dans `.env.local` pour travailler sur la vraie base.

`vercel.json` installe pnpm via corepack et sert l'app en SPA. Si le build Vercel refuse corepack,
définir `ENABLE_EXPERIMENTAL_COREPACK=1` dans les variables du projet.

## CI

`.github/workflows/ci.yml` lance `vp check --deny-warnings`, `vp test` et `vp build` sur chaque push
vers `main` et chaque pull request.

## Plus tard

- Indices (général, par groupe, par secteur).
- Userscript in-game qui envoie le relevé directement : il appellera `publish_snapshot` avec un
  compte opérateur ; l'aperçu des différences est déjà commun à toutes les sources.
