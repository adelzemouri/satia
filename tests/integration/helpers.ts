import { sql } from "drizzle-orm";

import { db } from "@/db/client";

/** Vide toutes les tables applicatives entre deux tests. */
export async function resetDatabase(): Promise<void> {
  await db().execute(sql`
    truncate table access_links, accounts, sessions, two_factors, verifications, goals, profiles,
      users, households, app_settings, rate_limits restart identity cascade
  `);
}
