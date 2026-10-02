import { sql } from "drizzle-orm";

import { db } from "@/db/client";
import { invalidEnvKeys } from "@/server/env";
import { checkBucket } from "@/server/storage";

export const dynamic = "force-dynamic";

type Check = "ok" | "error";

async function probe(fn: () => Promise<unknown>): Promise<Check> {
  try {
    await fn();
    return "ok";
  } catch (error) {
    console.error("[health]", error);
    return "error";
  }
}

/**
 * Vérifie la configuration, la base et le stockage objet. Seuls les noms des variables
 * d'environnement en défaut sont exposés, jamais leurs valeurs.
 */
export async function GET() {
  const invalid = invalidEnvKeys(process.env);
  const config = invalid.length === 0 ? "ok" : invalid;
  const [database, storage] = await Promise.all([probe(() => db().execute(sql`select 1`)), probe(() => checkBucket())]);
  const ok = config === "ok" && database === "ok" && storage === "ok";
  return Response.json({ status: ok ? "ok" : "degraded", config, database, storage }, { status: ok ? 200 : 503 });
}
