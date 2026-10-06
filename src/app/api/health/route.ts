import { sql } from "drizzle-orm";

import { db } from "@/db/client";
import { invalidLlmKeys, llmConfig } from "@/llm/config";
import { auth } from "@/server/auth";
import { rejectCron } from "@/server/cron";
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

/** Aller-retour vers la base (médiane de 3 requêtes après la première, qui peut réveiller la base). */
async function databaseRoundTripMs(): Promise<number | null> {
  try {
    const samples: number[] = [];
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      await db().execute(sql`select 1`);
      samples.push(performance.now() - start);
    }
    return Math.round(samples.sort((a, b) => a - b)[1]!);
  } catch {
    return null;
  }
}

/** Le détail est réservé à l'admin connecté (navigateur) ou à l'appel signé du secret cron. */
async function mayReadDetail(request: Request): Promise<boolean> {
  if (request.headers.has("authorization")) return rejectCron(request) === null;
  const session = await auth()
    .api.getSession({ headers: request.headers })
    .catch(() => null);
  return session?.user.role === "admin";
}

/**
 * Vérifie la configuration, la base, le stockage objet et la configuration du LLM. En public, seul l'état global
 * est donné ; le détail (noms des variables en défaut, jamais leurs valeurs, région, latence) va à l'admin.
 */
export async function GET(request: Request) {
  const invalid = invalidEnvKeys(process.env);
  const config = invalid.length === 0 ? "ok" : invalid;
  const [database, storage] = await Promise.all([probe(() => db().execute(sql`select 1`)), probe(() => checkBucket())]);
  // IA facultative : « disabled » sans fournisseur, noms des variables LLM en défaut sinon.
  const invalidLlm = invalidLlmKeys(process.env);
  const llm = invalidLlm.length > 0 ? invalidLlm : llmConfig().provider === "none" ? "disabled" : "ok";
  const ok = config === "ok" && database === "ok" && storage === "ok";
  const status = ok ? "ok" : "degraded";
  if (!(await mayReadDetail(request))) return Response.json({ status }, { status: ok ? 200 : 503 });
  // Diagnostic de lenteur : région des fonctions et latence vers la base (quelques ms si elles sont voisines).
  const timing = {
    region: process.env.VERCEL_REGION ?? "local",
    databaseMs: database === "ok" ? await databaseRoundTripMs() : null,
  };
  return Response.json({ status, config, database, storage, llm, timing }, { status: ok ? 200 : 503 });
}
