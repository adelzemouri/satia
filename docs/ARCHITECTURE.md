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
  (app + Postgres + RustFS, un S3 local) restent la référence locale ; changer pour un hébergeur
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
├── docker-compose.yml      # app, postgres, rustfs (S3 local)
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

Conventions : identifiants UUID (générés par Postgres, `gen_random_uuid()`), `created_at`/`updated_at` partout, valeurs
nutritionnelles en grammes et kcal pour 100 g, poids en kg, tailles en cm. Toute
requête sur une donnée personnelle filtre sur `user_id` de la session côté serveur.

```
households ──< users ──< sessions, accounts, two_factors   (tables Better Auth)
    │            │
    └──< access_links           invitations et liens de nouveau mot de passe
                 ├── profiles (1–1)
                 ├──< goals                 historique des objectifs
                 ├──< meal_entries >── foods
                 ├──< favorites
                 ├──< water_logs
                 ├──< weight_entries
                 ├──< photos
                 ├──< llm_calls
                 ├──< food_corrections
                 ├──< containers
                 └──< personal_expressions
foods (recette) ──< recipe_items >── foods (ingrédient)
app_settings, rate_limits
```

| Table | Champs principaux | Notes |
|---|---|---|
| `households` | name | Un seul foyer en pratique ; prépare la v2. |
| `users` | household_id, email, name, role (`admin`/`member`), locale, theme, energy_unit (`kcal`/`kj`), deleted_at | Plus les tables Better Auth (`sessions`, `accounts` avec hash argon2, `two_factors`). |
| `access_links` | household_id, kind (`invite`/`password_reset`), token_hash, role, label, user_id, created_by, expires_at, used_at | Lien à usage unique (invitation 7 j, nouveau mot de passe 24 h), seul le hash SHA-256 du jeton est stocké. |
| `profiles` | first_name, sex (`female`/`male`, obligatoire), birth_date, height_cm, activity_level (1–5), goal, pace (`gentle`/`moderate`), target_weight_kg, diet, foods_to_avoid, meal_times (jsonb), disclaimer_accepted_at | Si âge < 18 ans, `goal` limité à maintien/équilibre (contrainte applicative). |
| `goals` | user_id, effective_from, kcal, protein_g, carbs_g, fat_g, water_ml, source (`formula`/`manual`) | Historisé pour que les jours passés gardent leur objectif. |
| `foods` | source (`ciqual`/`off`/`custom`/`recipe`), source_ref (code Ciqual ou EAN), owner_user_id (null si public), name_fr, name_en, brand, group_fr, search_name, kcal, protein, carbs, fat, fiber, sugars, salt (pour 100 g), density_g_ml, unit_weights (jsonb : portion, pièce, tranche), servings, fetched_at | `search_name` = nom normalisé (minuscules, sans accents) avec index GIN trigram (`pg_trgm`). Une recette est un aliment `recipe` dont les valeurs pour 100 g viennent de ses ingrédients, avec `unit_weights.portion` = poids total / portions. Les produits OFF choisis sont mis en cache ici. |
| `recipe_items` | recipe_id, food_id, grams, position | Ingrédients d'une recette personnelle. |
| `meal_entries` | user_id, date, slot (`breakfast`/`lunch`/`dinner`/`snack`), food_id (null si l'aliment a été supprimé), label, quantity, unit, grams, kcal, protein, carbs, fat, is_estimated, input_method (`manual`/`barcode`/`photo`/`voice`/`text`/`copy`), photo_id | Valeurs **figées** à la saisie : modifier un aliment ne réécrit pas l'historique. |
| `favorites` | user_id, food_id | Les récents sont calculés depuis `meal_entries`. |
| `water_logs` | user_id, date, glasses | Verres de 250 ml ; objectif dans `profiles.water_goal_glasses` (8 par défaut). |
| `weight_entries` | user_id, date, weight_kg | Une pesée par jour ; tendance lissée calculée à la volée. |
| `photos` | user_id, object_key, created_at | Purge quotidienne par cron : après la durée réglée par l'admin (défaut 90 j), ou dès le lendemain si aucun repas ne l'utilise. |
| `llm_calls` | user_id, feature, provider, model, tokens_in, tokens_out, cost_usd_micros, latency_ms, status | Alimente la page admin et le plafond mensuel. |
| `food_corrections` | user_id, ai_label, ai_grams, food_id, grams | Base des règles locales (§5). |
| `containers` | user_id, name, kind, volume_ml, diameter_cm, photo_id | « Mes contenants ». |
| `personal_expressions` | user_id, phrase_normalized, food_id ou recipe_id, quantity, unit | Reconnues sans appel LLM. |
| `app_settings` | key, value (jsonb) | Budget LLM, IA activée, planchers caloriques, durée de rétention des photos. |
| `rate_limits` | key, window_start, count | Fenêtre glissante simple, sans Redis. |

Le streak n'a pas de table : il se calcule depuis `meal_entries`, avec un jour de gel
appliqué automatiquement par semaine civile.

## Décisions produit (2026-10-02)

- Onboarding v1 sans les écrans mode de budget, coach et jeûne : ils arrivent à
  leur phase (7, 9, 14).
- Le sexe est obligatoire (femme ou homme) : il fixe la formule Mifflin-St Jeor
  et le plancher calorique.
- Le jour de gel du streak est appliqué automatiquement, une fois par semaine.

## Décisions de la phase 1 (comptes et onboarding)

- **Installation** : tant qu'aucun compte n'existe, `/setup` crée le foyer et le
  compte admin, protégé par la variable `SETUP_TOKEN`. La page se ferme ensuite.
- **Pas d'e-mail en v1** : l'admin génère les liens d'invitation et de nouveau
  mot de passe dans `/admin` et les transmet lui-même (aucun service d'envoi tiers).
  Un lien de nouveau mot de passe ferme toutes les sessions du membre.
- **Mots de passe** : argon2id (19 Mio, 2 itérations), 10 caractères minimum.
- **Limitation de débit** : 5 échecs de connexion par adresse et par 15 min, 30
  tentatives par IP et par minute, échecs 2FA comptés par IP. Seuls les échecs
  comptent, pour ne pas bloquer un usage normal.
- **Calcul de l'objectif** : Mifflin-St Jeor × facteur d'activité (1,2 à 1,9).
  Perte : 0,25 kg/sem (doux) ou 0,5 kg/sem (modéré), plafonnée à 1 % du poids par
  semaine ; prise : +150 ou +300 kcal. Planchers 1200/1500 kcal réglables par l'admin.
  Protéines 1,6 g/kg en perte, 1,8 en prise, 1,2 sinon (poids de référence à IMC 25
  si IMC > 30) ; lipides 30 % des kcal ; glucides le reste. Arrondi à 10 kcal.
- **Poids cible** : refusé s'il va dans le mauvais sens ou sous un IMC de 18,5.
- **Ton** : tutoiement en français.
- **Formulaires** : le hook `useFormAction` évite que React 19 vide les champs
  après une erreur, tout en gardant la soumission sans JavaScript.

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

Mise en œuvre (phase 4) :
- **Configuration** : `LLM_PROVIDER` vaut `openai` par défaut dès qu'une clé est fournie,
  `none` sinon (IA désactivée proprement). Tarifs `LLM_PRICE_{VISION,TEXT}_{INPUT,OUTPUT}`
  en dollars par million de tokens ; `LLM_JSON_MODE=json_object` pour les fournisseurs
  sans schéma JSON. `LLM_REASONING_EFFORT` (`low` conseillé pour Gemini 3, dont la réflexion
  ne se désactive pas) limite les tokens de réflexion, facturés en sortie. `/api/health` renvoie `llm` : `ok`, `disabled` ou les noms des
  variables en défaut.
- **Schéma envoyé** : réduit à la structure (types, champs, listes) pour être accepté par
  tous les fournisseurs ; les bornes sont vérifiées par Zod à la réception.
- **Plafond** : réglé par l'admin dans `app_settings.ai` (`enabled`, `monthlyBudgetUsd`),
  `LLM_MONTHLY_BUDGET_USD` servant de valeur par défaut. Le mois suit l'heure de Paris.
  Débit : 20 appels par 10 minutes et par utilisateur.
- **Tentatives** : une seule nouvelle tentative, et seulement pour une sortie illisible ou
  invalide ; une panne ou un délai dépassé (30 s) n'est pas retenté. Chaque tentative est
  journalisée et comptée dans le plafond.
- **Page admin** `/admin/ai` : état, test de connexion (appel minimal à chaque modèle),
  plafond, coûts des 12 derniers mois par membre. Un membre supprimé garde ses lignes
  `llm_calls` sans `user_id`, pour que le coût du mois reste juste ; ses appels figurent
  dans son export (`ai-calls.csv`).
- **Compression** : `features/ai/compress-image.ts` réduit la photo dans le navigateur
  (côté long ≤ 768 px, WebP qualité 0,7, JPEG si le navigateur n'encode pas le WebP),
  applique l'orientation EXIF et supprime les métadonnées.
- **Tests** : `LLM_PROVIDER=mock` en e2e ; en intégration, `setProviderForTests` simule
  pannes et sorties invalides.

Sorties volontairement minimales, par exemple pour une photo :
`{"items":[{"name":"riz basmati","grams":180,"confidence":0.7}]}`. Le LLM ne
renvoie jamais de valeurs nutritionnelles, sauf `estimateFoods` appelée uniquement
pour les aliments sans correspondance locale, dont le résultat est marqué « estimé ».

## 5. Saisie d'un repas par photo, voix ou texte (phase 5)

```
Téléphone                                     Serveur (Vercel fra1)                  Externe
─────────                                     ─────────────────────                  ───────
1. Photo (caméra/galerie)
   + précision libre, contenant facultatif
2. Canvas : côté long ≤ 768 px,
   WebP q≈0.7 (JPEG sur Safari), sans EXIF
3. Action serveur analyzePhoto ────────────▶ 4. Session ; signature JPEG/WebP ;
   (base64 ≤ 1,5 Mo, cookie de session)          garde §4 (config, admin, plafond, débit)
                                               5. Contexte compact : contenant choisi,
                                                  8 habitudes apprises au plus
                                               6. Appel vision, basse résolution ──────▶ LLM vision
                                                  ← {items:[{name, grams, confidence}]}
                                               7. Par élément : habitude apprise, sinon
                                                  1er résultat de la recherche trigram
                                                  (+ 4 alternatives)
                                               8. Éléments sans correspondance :
                                                  un seul appel texte groupé ─────────▶ LLM texte
                                                  → valeurs pour 100 g marquées « estimé »
                                               9. Image écrite dans R2 + ligne `photos` ─▶ R2 (privé)
   ◀─────────────────────────────────────────  10. Brouillon
11. Écran de confirmation éditable
    (aliment, quantité, unité, kcal/P/G/L, « estimé »,
     retrait, ajout, changement d'aliment)
12. Action serveur saveMeal ───────────────▶ 13. `meal_entries` (valeurs figées, photo_id)
                                               14. Proposition ≠ choix final
                                                   → `food_corrections`
```

- **Voix et texte libre** : la voix passe par la Web Speech API du navigateur (gratuite),
  puis suit le même chemin que le texte. Avant tout appel, le texte est découpé (virgules,
  « et », « puis »…) ; si chaque morceau est une expression du dictionnaire personnel ou
  une habitude apprise (avec un nombre ou un poids éventuel devant : « 2 ma tartine »,
  « 150 g de riz »), la saisie se fait sans IA, même quand elle est en pause. Sinon un
  seul appel au modèle texte, avec les contenants cités dans la phrase.
- **Habitudes apprises** : une correction est enregistrée quand l'aliment change ou que
  le poids bouge de plus de 10 %. Un nom proposé par l'IA corrigé au moins deux fois
  vers le même aliment devient une règle (aliment le plus choisi, poids médian) : elle
  remplace l'aliment proposé, résout le texte sans appel, et part dans le prompt photo.
- **Mes contenants** (`/containers`) : nom, type (bol, assiette, verre, mug), volume ou
  diamètre. La photo d'un contenant n'est pas gérée en v1.
- **Mon dictionnaire** (`/dictionary`) : expression → aliment, quantité, unité.
- **Photos** : clé `meals/{user_id}/{uuid}.webp|jpg`, affichées dans le journal par URL
  signée GET de 5 minutes ; le bucket n'est jamais public. Purge chaque nuit par Vercel
  Cron (`/api/cron/purge-photos`, `Authorization: Bearer $CRON_SECRET`), durée réglable
  dans `/admin/ai`. Supprimer un compte supprime aussi ses fichiers.
- **Prompts** : en français (les noms sont cherchés dans Ciqual), quelques lignes, schéma
  JSON imposé ; 2 048 tokens de sortie maximum pour laisser la place à la réflexion des
  modèles qui en ont une.

## Espace famille (phase 6)

- **Recettes du foyer** : une recette avec `foods.household_id` renseigné et
  `owner_user_id` nul. Elle est visible et modifiable par tous les membres du foyer
  (`visibleTo` / `editableBy` dans `src/server/foods.ts`) et le reste une fois commune.
  Elle ne peut pas contenir d'aliment personnel, qui serait invisible aux autres.
  Ses ingrédients peuvent être pré-remplis depuis une photo (même analyse que la phase 5).
- **Repas partagés** (`shared_meals`, `shared_meal_shares`) : l'auteur choisit un plat
  visible par tous, le nombre de parts et le poids total (celui de la recette par défaut).
  Sa portion entre tout de suite dans son journal. Les autres membres reçoivent le repas
  « à valider » : rien n'entre dans leur journal sans leur accord, avec leur portion
  (½, 1, 1½, 2 parts ou un poids en grammes). Les lignes créées ont `input_method = shared`
  et des valeurs figées comme toute saisie.
- **Confidentialité** : un membre ne voit que les partages qui lui sont adressés, jamais
  le journal des autres. Seuls les noms des membres sont exposés.

## Objectif adaptatif et budget hebdomadaire (phase 7)

- **Calcul pur** dans `src/domain/adaptive.ts` et `src/domain/weekly-budget.ts`, sans LLM.
- **Dépense mesurée** : sur les 28 derniers jours complets (14 au minimum), apport moyen
  des jours saisis − pente de la tendance de poids lissée × 7 700 kcal/kg. Il faut au moins
  3 pesées et 80 % des jours saisis ; sinon l'écran dit ce qui manque. Une dépense hors
  1 000–5 000 kcal est jugée incohérente et ne change rien.
- **Ajustement** : même logique que la formule de départ (déficit, surplus, 1 % du poids
  par semaine au plus, plancher), appliquée à la dépense mesurée, puis limitée à ±150 kcal
  par rapport à l'objectif actuel. Nouvel objectif `goals.source = adaptive`.
  L'utilisateur peut figer son objectif (`profiles.goal_locked`).
- **Bilan hebdomadaire** (`metabolism_checks`, un par utilisateur et par semaine ISO) :
  fait au premier passage sur l'accueil, « Ma semaine » ou « Mon métabolisme » à partir
  du lundi, idempotent (clé primaire + `on conflict do nothing`). Pas de cron : rien à
  configurer, et un compte inactif n'est pas recalculé à vide.
- **Budget hebdomadaire** (`profiles.budget_mode`) : 7 × objectif quotidien, le reste
  réparti sur les jours restants. Un jour passé sans saisie compte comme un jour à
  l'objectif (ne pas saisir ne libère rien). Les jours « plus larges » (`larger_days`)
  pèsent 1,3. Chaque jour reste entre max(plancher, 80 % de l'objectif) et +20 %
  (+50 % pour un jour plus large). Une semaine dépassée n'est pas reportée.
  Les protéines restent fixes, glucides et lipides suivent l'écart.

## Qualité nutritionnelle et habitudes (phase 8)

- **Données** : `foods.nutriscore` et `foods.nova_group` viennent d'Open Food Facts
  (`nutriscore_grade`, `nova_group`) ; Ciqual ne les fournit pas. Le Nutri-Score est affiché
  en texte, sans reprendre le logo officiel. `foods.fruit_veg_share` (0 à 1) vaut 1 pour
  les groupes Ciqual « fruits » et « légumes » et pour quelques catégories OFF (fruits et
  légumes frais, surgelés ou en conserve, hors boissons et produits sucrés). Pour une
  recette, c'est la part du poids cru de ses ingrédients. Fibres, sucres et sel d'une
  recette ne sont connus que si tous ses ingrédients les connaissent.
- **Repères du jour** (`src/domain/quality.ts`) : 30 g de fibres (ANSES) et 5 portions
  de 80 g de fruits et légumes (PNNS), calculés en joignant le journal aux aliments.
- **Bilan qualité** (`/quality`, 7 derniers jours) : part des calories ultra-transformées
  (NOVA 4) parmi celles dont le groupe est connu, avec cette couverture affichée ; fibres,
  sel, sucres et fruits/légumes moyens par jour saisi ; aliments les plus contributeurs ;
  une ou deux idées formulées en « ajouter », choisies par règles, sans LLM.
- **Repas habituel** : sur l'écran d'ajout, le même ensemble d'aliments saisi au moins
  3 fois sur ce créneau en 6 semaines est proposé, sauf si le créneau est déjà rempli.
  L'ajout recopie le jour le plus récent.
- **Ressenti du jour** (`daily_checkins`) : faim, énergie, humeur de 1 à 5, chaque réponse
  enregistrée seule. Privé, inclus dans l'export.

## Coach (phase 9)

- **Personnalités** : `profiles.coach_style` (pédagogue, enthousiaste, serein, gourmand),
  choisie à l'onboarding et modifiable sur `/coach`. Seul le ton du prompt système change ;
  les règles (tutoiement, 120 mots, pas d'avis médical, jamais sous le plancher ni plus de
  1 % du poids par semaine, aucun chiffre inventé) sont communes (`src/llm/prompts/coach.ts`).
- **Chat** (`coach_messages`, feature LLM `coach`, modèle texte) : chaque message part avec
  un contexte compact du jour (6 lignes au plus : calories et reste, plancher, macros, fibres
  et fruits/légumes, semaine en budget hebdo, tendance de poids, régime, ressenti) et les
  6 derniers messages. Sortie JSON `{reply}` validée par Zod. Le message n'est enregistré
  qu'avec sa réponse ; on garde les 100 derniers par personne.
- **Garde-fous locaux, sans appel au LLM** : une demande chiffrée sous le plancher
  (« 900 kcal par jour ») ou une question de dose ou de médicament reçoit une réponse
  traduite côté client (`notice` = `floor` ou `medical`).
- **Bilan hebdomadaire** (`coach_reviews`, feature `weekly_review`) : rédigé une seule fois
  par semaine écoulée, à la première visite de `/coach` (déclenché après l'affichage), à
  partir de données agrégées (jours saisis, moyennes, qualité, ajustement de l'objectif,
  lien énergie et protéines). Il faut au moins 3 jours saisis. Pas de cron : un appel par
  personne et par semaine au plus, et seulement pour qui ouvre le coach.
- **Plat suggéré** (accueil) : une recette (perso ou du foyer) ou un favori dont une portion
  tient dans le reste du jour et en utilise au moins un tiers, choisi par règles avec une
  graine (utilisateur, jour) : stable dans la journée, sans LLM.
- Conversation et bilans sont inclus dans l'export (`coach-messages.csv`,
  `coach-reviews.csv`) et supprimés avec le compte.

## 6. Sécurité (rappel des points structurants)

HTTPS imposé par l'hébergeur, en-têtes CSP/HSTS via le middleware Next.js, jeton
CSRF sur les mutations (Better Auth + vérification de l'origine), limitation de débit
sur la connexion et les routes `/api/ai/*`, autorisation systématique par `user_id`
de session, secrets uniquement en variables d'env (`.env.example` fourni).

## Base d'aliments (phase 2)

- **Ciqual 2020** (Anses, licence ouverte) : le workflow GitHub Actions « Données Ciqual »
  télécharge le XML officiel, le convertit avec `scripts/ciqual/build-dataset.ts` et
  commite `data/ciqual-2020.csv` (≈ 3 000 aliments complets, valeurs pour 100 g, plus
  des masses volumiques et poids unitaires usuels choisis pour l'app). `pnpm foods:import`
  charge ce CSV ; il ne refait rien si l'empreinte SHA-256 du fichier n'a pas changé. Il
  tourne dans `vercel-build`, en CI et dans le `docker compose` local.
- **Recherche** : nom normalisé + `pg_trgm` (`word_similarity`, `similarity`), tolérante
  aux accents et aux fautes. Ordre : aliments personnels, début du nom, premier mot, tous
  les mots présents, proximité, longueur.
- **Open Food Facts** (ODbL) : recherche à la demande quand la base locale ne suffit pas
  (8 recherches par minute et par utilisateur), produit choisi mis en cache dans `foods`.
  Attributions Ciqual et OFF affichées sur l'écran d'ajout.
- **Code-barres** (`/scan`) : `BarcodeDetector` natif quand le navigateur l'a (Chrome
  Android), sinon ZXing chargé à la demande (Safari iOS). Seuls les EAN-13/EAN-8/UPC-A
  à clé de contrôle valide sont acceptés (UPC-A ramené à 13 chiffres) ; saisie manuelle
  du code possible. Le produit est lu dans `foods` s'il a moins de 30 jours, sinon
  redemandé à OFF (`/api/v2/product/{code}.json`) ; si OFF est indisponible, l'ancienne
  version du cache sert. Fiche produit `/foods/{id}` (valeurs pour 100 g et par portion),
  puis ajout au journal avec `input_method = barcode`. `OFF_BASE_URL` / `OFF_SEARCH_URL`
  ne servent qu'aux tests e2e (serveur OFF simulé).
- **Unités** : g, kg, volumes (ml, cl, l, c. à café 5 ml, c. à soupe 15 ml, tasse 250 ml)
  si la masse volumique est connue, portion / pièce / tranche si le poids unitaire l'est.

En attendant l'espace Training (phase 12), l'onglet « Training » de la barre inférieure
est remplacé par « Poids ».
