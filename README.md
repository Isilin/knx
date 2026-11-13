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
3. Authentication → URL Configuration : ajouter l'URL du site (et `http://localhost:5173`) aux
   redirections autorisées.
4. Authentication → Users : inviter l'adresse de l'opérateur, puis l'enregistrer comme admin :
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'operateur@exemple.org';
   ```
5. Redéployer. La page Relevés propose alors la connexion par lien e-mail ; seuls les admins
   peuvent publier (RLS + fonction `publish_snapshot`).

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
