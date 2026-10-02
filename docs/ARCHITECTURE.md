# Architecture — Satia

Ce document couvre la **v1** (phases 0 à 5 de `docs/PLAN.md`). Les versions
suivantes viendront compléter le modèle de données à leur phase ; seule la notion
de foyer est posée dès maintenant pour ne pas bloquer la v2.

## 1. Stack et hébergement

| Couche | Choix |
|---|---|
| Langage | TypeScript strict (`strict`, `noUncheckedIndexedAccess`), Node.js 24 LTS, pnpm |
| Application | Next.js (App Router), Server Components + Route Handlers, sortie `standalone` |
| Base | PostgreSQL 16 + Drizzle ORM / drizzle-kit, extensions `pg_trgm` et `unaccent` |
| Validation | Zod (entrées API, formulaires, sorties LLM) |
| Auth | Better Auth (bibliothèque) : email + mot de passe argon2, sessions en base, TOTP |
| UI | Tailwind CSS v4, primitives Radix, design tokens en variables CSS |
| i18n | next-intl, `fr` par défaut, `en` en second |
| PWA | Serwist (service worker), IndexedDB via Dexie pour le hors-ligne |
| Photos | Stockage objet S3 (SDK AWS v3), bucket privé, URL signées de 5 min |
| Tests | Vitest (unitaires, intégration sur un vrai Postgres), Playwright (e2e) |
| Qualité | ESLint (+ jsx-a11y), Prettier, `tsc --noEmit` |
| CI/CD | GitHub Actions |

### Hébergement retenu : 0 €/mois hors LLM

Consigne d'Adel du 2026-10-02 : l'hébergeur le moins cher, l'UE n'est plus
obligatoire. Les trois offres gratuites ci-dessous gardent malgré tout les données
en UE, sans surcoût.

| Besoin | Service | Région | Coût | Limites qui comptent (vérifiées le 2026-10-02) |
|---|---|---|---|---|
| App + previews par PR | Vercel Hobby | fonctions en `fra1` (Francfort) | 0 € | Usage personnel non commercial ; 4 h de CPU actif / mois ; fonctions ≤ 300 s ; cron 1×/jour max |
| PostgreSQL | Neon Free | `aws-eu-central-1` (Francfort) | 0 € | 1 Go ; 100 CU-h / mois ; mise en veille après 5 min ; restauration sur 6 h seulement |
| Photos + sauvegardes | Cloudflare R2 | juridiction `eu` | 0 € | 10 Go ; 1 M écritures et 10 M lectures / mois ; sortie gratuite |
| Tâches planifiées | Vercel Cron (quotidien) + GitHub Actions `schedule` (plus fréquent) | — | 0 € | Actions : 2 000 min / mois sur dépôt privé |

Compensations des limites :
- **Sauvegardes** : la restauration Neon gratuite ne couvre que 6 h. Un workflow
  GitHub Actions quotidien fait un `pg_dump` chiffré vers R2 (rétention 30 jours).
  La procédure de restauration est documentée en phase 15, testée dès la phase 0.
- **Cron fréquents** (rappels, v2) : un workflow Actions appelle toutes les 15 min
  une route `/api/cron/*` protégée par `CRON_SECRET`.
- **Portabilité** : le `Dockerfile` (sortie `standalone`) et `docker compose`
  (app + Postgres + MinIO) restent la référence locale ; changer pour un hébergeur
  à conteneurs (Scaleway, Fly, Render…) ne demande que de nouvelles variables d'env.
- **Si les quotas gratuits sont dépassés** : Vercel Pro (20 $/mois) ou bascule du
  conteneur chez Scaleway (≈ 5 à 10 €/mois). Le code ne change pas.

Environnements : local (`docker compose up`), preview par PR (Vercel, branche Neon
dédiée créée par la CI et supprimée à la fermeture), production sur `main`
(`https://<projet>.vercel.app` pour l'instant).

## 2. Arborescence

```
satia/
├── .github/workflows/
│   ├── ci.yml              # lint, format, typecheck, tests, build ; déploiement prod sur main
│   ├── preview.yml         # branche Neon + déploiement Vercel par PR
│   └── backup.yml          # pg_dump quotidien → R2
├── docker-compose.yml      # app, postgres, minio
├── Dockerfile
├── .env.example
├── drizzle/                # migrations SQL générées
├── public/                 # icônes PWA, polices auto-hébergées, illustrations SVG
├── scripts/
│   ├── import-ciqual.ts    # import de la table Ciqual (phase 2)
│   └── seed-dev.ts
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── (public)/   # connexion, invitation/[token]
│   │   │   ├── (app)/      # accueil, journal, ajout, profil, onboarding
│   │   │   └── admin/      # membres, LLM, coûts
│   │   ├── api/            # route handlers (repas, aliments, ia, cron, export)
│   │   └── sw.ts           # service worker Serwist
│   ├── config/app.ts       # APP_NAME et constantes produit
│   ├── db/
│   │   ├── schema/         # un fichier par domaine
│   │   └── client.ts
│   ├── domain/             # calcul pur, sans I/O, testé unitairement
│   │   ├── energy.ts       # BMR Mifflin-St Jeor, TDEE, planchers, rythme
│   │   ├── macros.ts
│   │   ├── units.ts        # conversions g/ml/c. à soupe/pièce…
│   │   ├── streak.ts       # streak + gel hebdomadaire
│   │   └── weight-trend.ts # moyenne lissée
│   ├── llm/                # unique point d'accès au LLM (§4)
│   ├── server/             # auth, autorisation, stockage S3, limitation de débit, budget
│   ├── features/           # composants et logique client par fonctionnalité
│   ├── ui/                 # composants génériques, tokens.css
│   └── i18n/messages/{fr,en}.json
└── tests/
    ├── integration/
    └── e2e/
```

## 3. Modèle de données (v1)

Conventions : identifiants UUID v7, `created_at`/`updated_at` partout, valeurs
nutritionnelles en grammes et kcal pour 100 g, poids en kg, tailles en cm. Toute
requête sur une donnée personnelle filtre sur `user_id` de la session côté serveur.

```
households ──< users ──< sessions, accounts, two_factors   (tables Better Auth)
    │            │
    └──< invitations
                 ├── profiles (1–1)
                 ├──< goals                 historique des objectifs
                 ├──< meal_entries >── foods / recipes
                 ├──< favorites
                 ├──< water_logs
                 ├──< weight_entries
                 ├──< photos
                 ├──< llm_calls
                 ├──< food_corrections
                 ├──< containers
                 └──< personal_expressions
foods ──< recipe_items >── recipes
app_settings, rate_limits
```

| Table | Champs principaux | Notes |
|---|---|---|
| `households` | name | Un seul foyer en pratique ; prépare la v2. |
| `users` | household_id, email, name, role (`admin`/`member`), locale, theme, energy_unit (`kcal`/`kj`), deleted_at | Plus les tables Better Auth (`sessions`, `accounts` avec hash argon2, `two_factors`). |
| `invitations` | household_id, email, token_hash, expires_at, used_at, invited_by | Lien à usage unique, seul le hash du jeton est stocké. |
| `profiles` | first_name, sex, birth_date, height_cm, activity_level (1–5), goal, pace (`gentle`/`moderate`), target_weight_kg, diet, foods_to_avoid, meal_times (jsonb), disclaimer_accepted_at | Si âge < 18 ans, `goal` limité à maintien/équilibre (contrainte applicative). |
| `goals` | user_id, effective_from, kcal, protein_g, carbs_g, fat_g, water_ml, source (`formula`/`manual`) | Historisé pour que les jours passés gardent leur objectif. |
| `foods` | source (`ciqual`/`off`/`custom`/`estimated`), source_ref (code Ciqual ou EAN), owner_user_id (null si public), name_fr, name_en, brand, kcal, protein, carbs, fat, fiber, sugars, salt (pour 100 g), density_g_ml, unit_weights (jsonb : pièce, tranche…), fetched_at | Index trigram sur `unaccent(name)`. Les produits OFF scannés sont mis en cache ici (phase 3). |
| `recipes` / `recipe_items` | owner_user_id, name, servings / food_id, grams | Recettes personnelles en v1. |
| `meal_entries` | user_id, date, slot (`breakfast`/`lunch`/`dinner`/`snack`), food_id ou recipe_id, label, quantity, unit, grams, kcal, protein, carbs, fat, is_estimated, input_method (`manual`/`barcode`/`photo`/`voice`/`text`/`copy`), photo_id | Valeurs **figées** à la saisie : modifier un aliment ne réécrit pas l'historique. |
| `favorites` | user_id, food_id ou recipe_id | Les récents sont calculés depuis `meal_entries`. |
| `water_logs` | user_id, date, glasses | Objectif dans `goals.water_ml`. |
| `weight_entries` | user_id, date, weight_kg | Une pesée par jour ; tendance lissée calculée à la volée. |
| `photos` | user_id, object_key, purge_after | Purge quotidienne par cron (défaut 90 j). |
| `llm_calls` | user_id, feature, provider, model, tokens_in, tokens_out, cost_usd_micros, latency_ms, status | Alimente la page admin et le plafond mensuel. |
| `food_corrections` | user_id, ai_label, ai_grams, food_id, grams | Base des règles locales (§5). |
| `containers` | user_id, name, kind, volume_ml, diameter_cm, photo_id | « Mes contenants ». |
| `personal_expressions` | user_id, phrase_normalized, food_id ou recipe_id, quantity, unit | Reconnues sans appel LLM. |
| `app_settings` | key, value (jsonb) | Budget LLM, IA activée, planchers caloriques, durée de rétention des photos. |
| `rate_limits` | key, window_start, count | Fenêtre glissante simple, sans Redis. |

Le streak n'a pas de table : il se calcule depuis `meal_entries`, avec un jour de gel
appliqué automatiquement par semaine civile.

## 4. Couche d'abstraction LLM (`src/llm/`)

```
src/llm/
├── index.ts            # API publique : analyzeMealPhoto, parseMealText, estimateFoods
├── types.ts            # LlmProvider, LlmRequest, LlmResponse, LlmUsage
├── config.ts           # lecture et validation Zod des variables d'env
├── providers/
│   ├── openai-compatible.ts   # OpenRouter, Gemini, Mistral, DeepSeek, Ollama…
│   ├── anthropic.ts
│   └── mock.ts                # déterministe, utilisé par tous les tests
├── prompts/            # prompts système courts, versionnés, fr/en
├── schemas.ts          # schémas Zod des sorties JSON
├── pricing.ts          # prix par million de tokens (env) → coût estimé
└── guard.ts            # session, débit, plafond mensuel, IA activée
```

```ts
interface LlmProvider {
  complete(req: LlmRequest): Promise<LlmResponse>;
}
type LlmRequest = {
  model: string;               // LLM_MODEL_VISION ou LLM_MODEL_TEXT
  system: string;              // court, marqué cacheable si le provider le permet
  user: string;
  images?: { mime: 'image/webp' | 'image/jpeg'; base64: string }[];
  jsonSchema: object;          // dérivé du schéma Zod
  maxOutputTokens: number;
  lowDetail?: boolean;         // `detail: "low"` côté OpenAI-compatible
};
type LlmResponse = { json: unknown; usage: { inputTokens: number; outputTokens: number }; latencyMs: number };
```

Chaque fonction publique suit la même chaîne :
1. **Garde** : session valide, limite de débit par utilisateur, IA activée, coût du
   mois < `LLM_MONTHLY_BUDGET_USD`. Sinon erreur typée `AiUnavailable`, que l'UI
   transforme en bascule vers la saisie manuelle.
2. **Règles locales d'abord** : dictionnaire personnel et corrections récurrentes ;
   si elles suffisent, aucun appel.
3. **Appel** au provider choisi par `LLM_PROVIDER` (`openai` | `anthropic` | `mock`),
   avec `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL_VISION`, `LLM_MODEL_TEXT`.
4. **Validation** Zod de la sortie ; une seule nouvelle tentative si invalide.
5. **Journalisation** dans `llm_calls` (modèle, tokens, coût estimé, latence, statut),
   y compris en cas d'échec.

Sorties volontairement minimales, par exemple pour une photo :
`{"items":[{"name":"riz basmati","grams":180,"confidence":0.7}]}`. Le LLM ne
renvoie jamais de valeurs nutritionnelles, sauf `estimateFoods` appelée uniquement
pour les aliments sans correspondance locale, dont le résultat est marqué « estimé ».

## 5. Flux de saisie d'un repas par photo

```
Téléphone                                     Serveur (Vercel fra1)                  Externe
─────────                                     ─────────────────────                  ───────
1. Photo (caméra/galerie)
   + note libre, contenant optionnel
2. Canvas : côté long ≤ 768 px,
   WebP q≈0.7 (~60–120 Ko)
   hors-ligne → file IndexedDB, envoi au retour réseau
3. POST /api/ai/meal-photo  ───────────────▶ 4. Garde (§4) ; image ≤ 400 Ko
   (multipart, cookie de session)              5. Écrit l'image dans R2 ──────────────▶ R2 (privé)
                                                  + ligne `photos` (purge_after)
                                               6. Contexte compact : 10 corrections
                                                  les plus fréquentes, contenant choisi
                                               7. Appel vision, basse résolution ──────▶ LLM vision
                                                  ← {items:[{name, grams, confidence}]}
                                               8. Matching local par élément :
                                                  expressions perso → corrections →
                                                  recherche trigram Ciqual/OFF/perso
                                               9. Éléments sans correspondance :
                                                  un seul appel texte groupé ─────────▶ LLM texte
                                                  → valeurs marquées « estimé »
   ◀─────────────────────────────────────────  10. Brouillon : aliments, grammes,
                                                   kcal/P/G/L calculés depuis la base
11. Écran de confirmation éditable
    (aliment, quantité, unité, valeurs, badge « estimé »)
12. POST /api/meals ───────────────────────▶ 13. Enregistre `meal_entries` (valeurs figées)
                                               14. Compare brouillon / validé
                                                   → `food_corrections`
```

L'affichage ultérieur d'une photo passe par une URL signée GET de 5 minutes ;
le bucket n'est jamais public.

## 6. Sécurité (rappel des points structurants)

HTTPS imposé par l'hébergeur, en-têtes CSP/HSTS via le middleware Next.js, jeton
CSRF sur les mutations (Better Auth + vérification de l'origine), limitation de débit
sur la connexion et les routes `/api/ai/*`, autorisation systématique par `user_id`
de session, secrets uniquement en variables d'env (`.env.example` fourni).
