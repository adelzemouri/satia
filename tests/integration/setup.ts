import { vi } from "vitest";

// `server-only` refuse d'être importé hors de Next.js ; inutile dans les tests.
vi.mock("server-only", () => ({}));

// Valeurs du docker compose local, surchargées par la CI si besoin.
process.env.DATABASE_URL ??= "postgres://pommelia:pommelia@localhost:5432/pommelia";
process.env.S3_ENDPOINT ??= "http://localhost:9000";
process.env.S3_BUCKET ??= "pommelia-photos";
process.env.S3_ACCESS_KEY_ID ??= "pommelia";
process.env.S3_SECRET_ACCESS_KEY ??= "pommelia-secret";
process.env.S3_FORCE_PATH_STYLE ??= "true";
process.env.BETTER_AUTH_SECRET ??= "integration-secret-integration-secret";
process.env.SETUP_TOKEN ??= "integration-setup-token";
