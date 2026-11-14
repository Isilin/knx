# API du module de jeu

Contrat entre KNX et le module (userscript) qui envoie le rapport « Corporations » depuis le jeu.
Le module vit dans un autre projet : ce document est la référence côté module.

- **Adresse :** `https://<domaine KNX>/api/v1` (fonctions Vercel du dossier `api/`).
- **Authentification :** en-tête `Authorization: Bearer knx_<64 caractères hexadécimaux>`.
- **Clés :** créées par un opérateur dans **Relevés → Clés du module de jeu**. La clé n'est affichée
  qu'une fois : KNX n'en garde qu'une empreinte (sha256). Une clé révoquée est refusée tout de suite.
- **Validation :** un envoi ne publie rien. Il attend dans **Relevés → Envois du jeu en attente**,
  comparé au relevé précédent (nouvelles, disparues, renommages, valeurs aberrantes), puis
  l'opérateur le publie ou le rejette. C'est le seul chemin d'entrée des relevés.

## `POST /api/v1/releves`

Dépose le relevé d'un jour. Corps JSON, 64 Kio au plus :

```json
{
  "date": "2026-11-13",
  "rows": [
    { "name": "Armacham Technology", "rank": 1, "chiffre": "677.085", "capital": "27.120.847", "employees": 4 },
    { "name": "Seven", "rank": 2, "chiffre": 4700, "capital": null, "employees": null }
  ]
}
```

| Champ | Règle |
|---|---|
| `date` | Date **grégorienne** `AAAA-MM-JJ` du relevé, jour de Paris (pas la date impériale). De J-7 à J+1. |
| `rows` | De 1 à 200 corporations. |
| `name` | Nom exact du jeu, caractère pour caractère (seuls les espaces autour sont retirés). 100 caractères au plus, sans doublon. |
| `rank` | Colonne `Class.`. Tous les rangs ou aucun ; sans rang, KNX classe par chiffre. |
| `chiffre` | Obligatoire, entier ≥ 0. |
| `capital` | Facultatif, entier (peut être négatif). |
| `employees` | Facultatif, entier ≥ 0. |

Les nombres s'envoient en entier JSON **ou** en texte tel que le jeu l'affiche (`"27.120.847"`,
`"677 085"`). Les autres champs sont ignorés.

**Réponse acceptée** (`201` à la création, `200` sinon) :

```json
{
  "ok": true,
  "status": "pending",
  "outcome": "created",
  "date": "2026-11-13",
  "rows": 52,
  "message": "Relevé du 6/393.2 reçu : en attente de validation."
}
```

| `outcome` | Cas |
|---|---|
| `created` | Premier envoi pour ce jour. |
| `replaced` | Nouvel envoi de la **même clé** pour un jour encore en attente : il remplace le précédent. |
| `unchanged` | Envoi identique à celui qui attend déjà (quelle que soit la clé) : rien ne change. |

Un seul relevé par jour : renvoyer après une correction est sans risque tant que l'opérateur n'a pas
publié.

## `GET /api/v1/status[?date=AAAA-MM-JJ]`

Vérifie la clé et dit où en est le relevé d'un jour (aujourd'hui, heure de Paris, par défaut). Sert
au bouton « tester la clé » du module, et à ne pas renvoyer un relevé déjà publié.

```json
{
  "ok": true,
  "key": { "name": "Module principal" },
  "date": "2026-11-13",
  "state": "pending",
  "lastPublished": "2026-11-12"
}
```

`state` vaut `absent`, `pending` ou `published`.

## Erreurs

Corps : `{ "ok": false, "error": { "code": "…", "message": "…", "details": ["…"] } }`. Le message
est en français, prêt à afficher ; `details` n'existe que pour `releve_invalide`.

| HTTP | `code` | Cas |
|---|---|---|
| 400 | `requete_invalide` | JSON illisible, paramètre `date` mal formé |
| 401 | `cle_absente` | pas d'en-tête `Authorization` |
| 401 | `cle_invalide` | clé mal formée, inconnue ou révoquée |
| 405 | `methode_non_autorisee` | mauvaise méthode (en-tête `Allow`) |
| 409 | `deja_publie` | un relevé est déjà publié pour ce jour |
| 409 | `deja_en_attente` | un envoi **différent**, d'une autre clé, attend déjà pour ce jour |
| 413 | `trop_volumineux` | corps de plus de 64 Kio |
| 422 | `releve_invalide` | relevé refusé ; `details` liste les lignes fautives |
| 500 | `erreur_interne`, `service_non_configure` | problème côté KNX ; réessayer plus tard |

## Côté module

- **Tampermonkey / Violentmonkey :** `GM_xmlhttpRequest` avec `// @connect <domaine KNX>` contourne
  CORS. Un `fetch` depuis la page marche aussi : l'API répond au preflight et autorise toutes les
  origines par défaut (variable Vercel `KNX_CORS_ORIGINS` pour restreindre). Aucune session ni cookie.
- **La clé** se saisit dans le module et se garde avec `GM_setValue` ; jamais écrite dans le code
  publié du script.
- Les réponses ne sont jamais mises en cache (`Cache-Control: no-store`).

```js
// ==UserScript==
// @name     KNX — envoi du relevé
// @match    https://<site du jeu>/*
// @grant    GM_xmlhttpRequest
// @grant    GM_getValue
// @connect  <domaine KNX>
// ==/UserScript==

function sendReport(date, rows) {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: "POST",
      url: "https://<domaine KNX>/api/v1/releves",
      headers: {
        Authorization: `Bearer ${GM_getValue("knxKey")}`,
        "Content-Type": "application/json",
      },
      data: JSON.stringify({ date, rows }),
      onload: (response) => resolve({ status: response.status, body: JSON.parse(response.responseText) }),
      onerror: reject,
    });
  });
}
```

## Essai à la main

```bash
curl -i "https://<domaine KNX>/api/v1/status" -H "Authorization: Bearer $KNX_KEY"
```

```bash
curl -i -X POST "https://<domaine KNX>/api/v1/releves" -H "Authorization: Bearer $KNX_KEY" -H "Content-Type: application/json" -d '{"date":"2026-11-13","rows":[{"name":"Armacham Technology","rank":1,"chiffre":"677.085","capital":"27.120.847","employees":4}]}'
```

Sur un déploiement de prévisualisation protégé par Vercel, ajouter
`-H "x-vercel-protection-bypass: <secret>"`. La prévisualisation écrit dans la même base que la
production : rejeter ensuite l'envoi d'essai dans Relevés.
