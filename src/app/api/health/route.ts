import { sql } from "drizzle-orm";

import { db } from "@/db/client";
import { invalidLlmKeys, llmConfig } from "@/llm/config";
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
 * Vérifie la configuration, la base, le stockage objet et la configuration du LLM. Seuls les noms des variables
 * d'environnement en défaut sont exposés, jamais leurs valeurs.
 */
export async function GET() {
  const invalid = invalidEnvKeys(process.env);
  const config = invalid.length === 0 ? "ok" : invalid;
  const [database, storage] = await Promise.all([probe(() => db().execute(sql`select 1`)), probe(() => checkBucket())]);
  // IA facultative : « disabled » sans fournisseur, noms des variables LLM en défaut sinon.
  const invalidLlm = invalidLlmKeys(process.env);
  const llm = invalidLlm.length > 0 ? invalidLlm : llmConfig().provider === "none" ? "disabled" : "ok";
  const ok = config === "ok" && database === "ok" && storage === "ok";
  return Response.json({ status: ok ? "ok" : "degraded", config, database, storage, llm }, { status: ok ? 200 : 503 });
}
