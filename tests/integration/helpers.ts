import { sql } from "drizzle-orm";

import { db } from "@/db/client";

/**
 * Vide toutes les tables applicatives entre deux tests, en gardant la table Ciqual importée
 * (un TRUNCATE ... CASCADE sur les utilisateurs viderait aussi les aliments).
 */
export async function resetDatabase(): Promise<void> {
  await db().execute(sql`
    truncate table access_links, accounts, sessions, two_factors, verifications, goals, profiles,
      meal_entries, water_logs, weight_entries, favorites, recipe_items, rate_limits, llm_calls, photos,
      food_corrections, containers, personal_expressions, shared_meals, shared_meal_shares, metabolism_checks, larger_days, daily_checkins restart identity
  `);
  await db().execute(sql`delete from foods where source <> 'ciqual'`);
  await db().execute(sql`delete from users`);
  await db().execute(sql`delete from households`);
  await db().execute(sql`delete from app_settings where key <> 'ciqual_dataset_sha256'`);
}
