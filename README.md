# Satia

Application web de suivi nutritionnel familial (PWA). Spécification : `docs/PRD.md`,
plan : `docs/PLAN.md`, architecture : `docs/ARCHITECTURE.md`.

## Développement local

Prérequis : Node.js 22+ (24 recommandé), pnpm 10, Docker.

```bash
pnpm install
docker compose up            # app complète sur http://localhost:3000 (Postgres + S3 local)
```

Ou, pour itérer avec le rechargement à chaud :

```bash
docker compose up -d db storage setup
cp .env.example .env.local
pnpm dev
```

Le service `setup` applique les migrations et importe la table Ciqual
(`pnpm db:migrate && pnpm foods:import`, à relancer après un changement de schéma ou
de `data/ciqual-2020.csv`).

## Premier démarrage

Ouvrir `/setup` et saisir le jeton `SETUP_TOKEN` pour créer le foyer et le compte
admin. Les autres membres reçoivent ensuite un lien d'invitation généré dans
`/admin` (pas d'inscription publique).

## Vérifications

| Commande                                             | Rôle                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| `pnpm lint` / `pnpm format:check` / `pnpm typecheck` | Qualité statique                                              |
| `pnpm test`                                          | Tests unitaires                                               |
| `pnpm test:integration`                              | Routes et stockage sur un vrai Postgres + S3 (docker compose) |
| `pnpm build && pnpm test:e2e`                        | Parcours Playwright sur le build de production                |

## Sources des données

Valeurs nutritionnelles : table [Ciqual](https://ciqual.anses.fr) de l'Anses (licence
ouverte Etalab) et [Open Food Facts](https://world.openfoodfacts.org) (ODbL) pour les
produits du commerce.

## Déploiement

L'hébergement retenu ne coûte rien hors IA (détails et alternatives dans
`docs/ARCHITECTURE.md`) :

| Brique          | Service                          | Rôle                                         |
| --------------- | -------------------------------- | -------------------------------------------- |
| Application     | Vercel Hobby, région `fra1`      | Next.js, cron quotidien de purge des photos  |
| Base de données | Neon Free (Francfort)            | PostgreSQL, branche `main` = production      |
| Stockage objet  | Cloudflare R2 (bucket privé, UE) | Photos de repas et de progression, dumps     |
| Tâches et CI    | GitHub Actions (dépôt public)    | Tests, rappels toutes les 15 min, sauvegarde |

### Mise en place depuis zéro

1. **Neon** : créer un projet (région Francfort) et copier l'URL de connexion
   « pooled » de la branche `main`.
2. **Cloudflare R2** : créer un bucket privé (juridiction UE) et un jeton API
   « Object Read & Write » limité à ce bucket. Noter l'endpoint
   `https://<compte>.eu.r2.cloudflarestorage.com`, l'access key et le secret.
3. **Vercel** : importer le dépôt GitHub (framework Next.js, commande de build déjà
   fournie par `vercel.json`), puis renseigner les variables ci-dessous dans
   Settings > Environment Variables, environnement « Production ».
4. Déployer, ouvrir `/api/health` (tout doit être `ok`), puis `/setup` avec le
   `SETUP_TOKEN` pour créer le foyer et le compte admin.
5. Dans GitHub > Settings > Secrets and variables > Actions, ajouter les secrets des
   rappels et de la sauvegarde (tableau plus bas).

Chaque fusion sur `main` part ensuite en production. `pnpm vercel-build` applique les
migrations Drizzle et met à jour la table Ciqual avant le build ; une pull request
reçoit une preview Vercel avec sa propre branche de base Neon.

### Variables d'environnement (Vercel)

Un générateur de mots de passe du navigateur suffit pour les secrets (32 caractères
ou plus) ; `openssl rand -base64 32` fait la même chose en terminal.

| Variable                                   | Obligatoire      | Rôle                                                                                                          |
| ------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                             | oui              | URL « pooled » de Neon                                                                                        |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`    | oui              | Endpoint R2, nom du bucket, `auto`                                                                            |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | oui              | Jeton R2 ; `S3_FORCE_PATH_STYLE=false` pour R2                                                                |
| `BETTER_AUTH_SECRET`                       | oui              | Signe les sessions ; le changer déconnecte tout le monde                                                      |
| `SETUP_TOKEN`                              | oui              | Demandé une seule fois sur `/setup`                                                                           |
| `CRON_SECRET`                              | conseillé        | Protège les tâches planifiées (16 caractères minimum). Sans lui, la purge des photos passe au fil des visites |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`    | pour les rappels | Paire générée dans Administration > Notifications                                                             |
| `VAPID_SUBJECT`                            | non              | `mailto:` de contact pour les services de notification                                                        |
| `LLM_*`                                    | pour l'IA        | Fournisseur, clé, modèles et tarifs (voir `.env.example`) ; sans clé, la saisie manuelle reste disponible     |
| `APP_HOSTS`                                | non              | Domaines personnalisés, séparés par des virgules                                                              |

Si une variable manque ou est invalide, `/api/health` le dit dans son champ `config`.

### Secrets GitHub Actions

| Secret                                                   | Workflow                | Rôle                                                    |
| -------------------------------------------------------- | ----------------------- | ------------------------------------------------------- |
| `APP_URL`, `CRON_SECRET`                                 | `Notifications`         | Adresse de prod et même secret que sur Vercel           |
| `BACKUP_DATABASE_URL`                                    | `Sauvegarde de la base` | URL **directe** (non « pooled ») de Neon pour `pg_dump` |
| `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`                 | `Sauvegarde de la base` | Peut être le bucket des photos (préfixe `backups/`)     |
| `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` | `Sauvegarde de la base` | Jeton R2 avec droit d'écriture                          |
| `BACKUP_PASSPHRASE`                                      | `Sauvegarde de la base` | Chiffre les dumps : à garder aussi hors de GitHub       |

Un workflow dont les secrets manquent se termine sans erreur avec un avertissement.

## Tâches planifiées

| Tâche               | Déclencheur                                     | Ce qu'elle fait                                                                                                                                    |
| ------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purge des photos    | Cron Vercel à 3 h 30 UTC (`vercel.json`)        | Supprime les photos de repas après la durée choisie dans Administration > IA (90 jours par défaut) et celles jamais ajoutées au journal après 24 h |
| Purge (filet)       | Ouverture de l'accueil, au plus toutes les 20 h | Même purge, pour qu'elle tourne même sans `CRON_SECRET` ; bouton « Purger maintenant » côté admin                                                  |
| Rappels             | GitHub Actions toutes les 15 min (`notify.yml`) | Envoie les notifications dues (repas, eau, jeûne, traitement, bilan) ; Vercel Hobby n'a qu'un cron par jour                                        |
| Sauvegarde          | GitHub Actions à 2 h 17 UTC (`backup.yml`)      | `pg_dump` chiffré dans `backups/`, gardé 30 jours                                                                                                  |
| Bilan hebdo, jeûnes | À la première visite concernée                  | Calculés au besoin, sans tâche planifiée                                                                                                           |

Chaque workflow se lance aussi à la main depuis l'onglet Actions (« Run workflow »).
Les photos de progression (page Corps) ne sont jamais purgées automatiquement ; elles
partent avec le compte.

## Sauvegardes et restauration

Neon Free ne garde que 6 heures d'historique : la vraie sauvegarde est le dump chiffré
de chaque nuit (`s3://<bucket>/backups/satia-<date>.dump.gpg`, 30 jours). Pour en
faire un tout de suite : Actions > « Sauvegarde de la base » > Run workflow.

Restauration (un terminal avec `aws`, `gpg` et `pg_restore` 17) :

```bash
aws s3 ls s3://<bucket>/backups/ --endpoint-url <endpoint>
aws s3 cp s3://<bucket>/backups/<fichier>.dump.gpg . --endpoint-url <endpoint>
gpg --decrypt <fichier>.dump.gpg > satia.dump          # demande BACKUP_PASSPHRASE
pg_restore --no-owner --clean --if-exists -d "<URL directe de la base cible>" satia.dump
```

Conseils :

- **Tester d'abord** : créer une branche Neon vide (Branches > New branch), y restaurer
  le dump, vérifier les données, puis seulement restaurer sur `main` (ou promouvoir la
  branche en production depuis Neon).
- Restaurer sur `main` remplace les données de toute la famille : prévenir avant, et
  faire un dump juste avant si la base actuelle est encore lisible.
- Les photos ne sont pas dans le dump : elles restent dans R2. Une photo purgée entre
  la date du dump et la restauration apparaît simplement sans image.
- Après une restauration, les sessions restaurées peuvent être anciennes : chacun se
  reconnecte.

## Exploitation

- **État de santé** : `/api/health` vérifie la configuration, la base, le stockage et
  l'IA, et donne la région et la latence de la base. Vercel > Logs montre les erreurs
  serveur.
- **Membres** : Administration, section « Membres du foyer », pour inviter (lien à usage unique, à
  transmettre soi-même : il n'y a pas d'e-mail), générer un lien de nouveau mot de
  passe ou retirer un compte. Chaque membre peut exporter ses données (JSON et CSV) et
  supprimer son compte depuis son profil.
- **IA** : Administration > IA montre l'état, le coût du mois par membre et le
  plafond ; au-delà du plafond, les fonctions IA se mettent en pause et la saisie
  manuelle reste disponible. « Tester la connexion » vérifie la clé et le modèle.
- **Changer un secret** : modifier la variable sur Vercel puis redéployer (Deployments >
  ⋯ > Redeploy). `CRON_SECRET` doit rester identique sur Vercel et dans GitHub.
- **Mises à jour** : une pull request par changement ; la CI (lint, types, tests
  unitaires, d'intégration et e2e, image Docker) doit être verte avant la fusion.
- **Table Ciqual** : le workflow « Données Ciqual » régénère `data/ciqual-2020.csv`
  quand le script de conversion change ; l'import en production se fait au déploiement
  suivant.
- **Hors ligne** : l'accueil, le journal du jour et l'écran d'ajout sont gardés sur le
  téléphone ; un aliment noté sans réseau part au journal au retour de la connexion.
  La déconnexion efface ces pages du téléphone.
- **Changer d'hébergeur** : l'app est conteneurisée (`Dockerfile`) ; il suffit d'une
  base PostgreSQL, d'un stockage compatible S3 et d'un appel quotidien à
  `GET /api/cron/purge-photos` (et toutes les 15 min à `/api/cron/notify`) avec
  l'en-tête `Authorization: Bearer <CRON_SECRET>`.
