import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/server/env";

import * as schema from "./schema";

function createClient() {
  // `prepare: false` : compatible avec le pooler de Neon (PgBouncer en mode transaction).
  const sql = postgres(env().DATABASE_URL, { max: 5, prepare: false });
  return drizzle(sql, { schema, casing: "snake_case" });
}

type Db = ReturnType<typeof createClient>;

const globalForDb = globalThis as unknown as { db?: Db };

export function db(): Db {
  globalForDb.db ??= createClient();
  return globalForDb.db;
}
