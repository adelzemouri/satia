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

- Production : chaque fusion sur `main` est déployée par Vercel (région `fra1`) ;
  les migrations Drizzle sont appliquées avant le build (`pnpm vercel-build`).
- Chaque pull request reçoit une preview Vercel avec sa propre branche de base Neon.
- `GET /api/health` vérifie la base et le stockage objet.
- Variables requises sur Vercel en plus de la base et du stockage :
  `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) et `SETUP_TOKEN`. `APP_HOSTS`
  (facultatif) liste les domaines personnalisés, séparés par des virgules.

## Sauvegardes

Le workflow `Sauvegarde de la base` fait chaque nuit un `pg_dump` chiffré (GPG AES-256)
dans `s3://<bucket>/backups/`, conservé 30 jours. Secrets GitHub requis :
`BACKUP_DATABASE_URL`, `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`,
`BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`, `BACKUP_PASSPHRASE`.

Restauration :

```bash
aws s3 cp s3://<bucket>/backups/<fichier>.dump.gpg . --endpoint-url <endpoint>
gpg --decrypt <fichier>.dump.gpg > satia.dump
pg_restore --no-owner --clean --if-exists -d "<DATABASE_URL cible>" satia.dump
```
