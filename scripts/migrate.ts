/** Applique les migrations Drizzle. Lancé avant chaque build de déploiement et dans `docker compose`. */
import { existsSync } from "node:fs";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL manquante");

if (!existsSync("drizzle/meta/_journal.json")) {
  console.log("Aucune migration à appliquer.");
} else {
  const sql = postgres(url, { max: 1 });
  await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
  await sql.end();
  console.log("Migrations appliquées.");
}
