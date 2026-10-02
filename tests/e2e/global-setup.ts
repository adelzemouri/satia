import postgres from "postgres";

/** Les parcours e2e partent d'une base vide (jamais exécuté contre la production). */
export default async function globalSetup() {
  if (process.env.E2E_BASE_URL) return;
  const sql = postgres(process.env.DATABASE_URL ?? "postgres://satia:satia@localhost:5432/satia", { max: 1 });
  await sql`truncate table access_links, accounts, sessions, two_factors, verifications, goals, profiles,
    users, households, app_settings, rate_limits restart identity cascade`;
  await sql.end();
}
