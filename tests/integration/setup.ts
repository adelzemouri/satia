import { vi } from "vitest";

// `server-only` refuse d'être importé hors de Next.js ; inutile dans les tests.
vi.mock("server-only", () => ({}));

// Valeurs du docker compose local, surchargées par la CI si besoin.
process.env.DATABASE_URL ??= "postgres://satia:satia@localhost:5432/satia";
process.env.S3_ENDPOINT ??= "http://localhost:9000";
process.env.S3_BUCKET ??= "satia-photos";
process.env.S3_ACCESS_KEY_ID ??= "satia";
process.env.S3_SECRET_ACCESS_KEY ??= "satia-secret";
process.env.S3_FORCE_PATH_STYLE ??= "true";
