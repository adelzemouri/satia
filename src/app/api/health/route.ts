import { sql } from "drizzle-orm";

import { db } from "@/db/client";
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

/** Vérifie que la base et le stockage objet répondent. Ne divulgue aucun détail. */
export async function GET() {
  const [database, storage] = await Promise.all([probe(() => db().execute(sql`select 1`)), probe(() => checkBucket())]);
  const ok = database === "ok" && storage === "ok";
  return Response.json({ status: ok ? "ok" : "degraded", database, storage }, { status: ok ? 200 : 503 });
}
