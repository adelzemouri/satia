import "server-only";

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url(),
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET doit faire au moins 32 caractères"),
  /** Jeton à saisir pour créer le compte admin, tant qu'aucun compte n'existe. */
  SETUP_TOKEN: z.string().min(16).optional(),
  /** Secret des tâches planifiées (purge des photos), envoyé par le cron de l'hébergeur. */
  CRON_SECRET: z.string().min(16).optional(),
  /** Domaines personnalisés supplémentaires, séparés par des virgules. */
  APP_HOSTS: z
    .string()
    .optional()
    .transform((value) =>
      value
        ?.split(",")
        .map((host) => host.trim())
        .filter(Boolean),
    ),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type Env = z.infer<typeof envSchema>;

/** Noms des variables absentes ou invalides (jamais leurs valeurs). */
export function invalidEnvKeys(source: Record<string, string | undefined>): string[] {
  const result = envSchema.safeParse(source);
  return result.success ? [] : [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const missing = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))].join(", ");
    throw new Error(`Variables d'environnement invalides ou manquantes : ${missing}`);
  }
  return result.data;
}

let cached: Env | undefined;

/** Lecture paresseuse : le build Next.js ne doit pas exiger les secrets. */
export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
