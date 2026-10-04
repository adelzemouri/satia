import { sql } from "drizzle-orm";

import { db } from "@/db/client";

/**
 * Vide toutes les tables applicatives entre deux tests, en gardant la table Ciqual et le catalogue de recettes importés
 * (un TRUNCATE ... CASCADE sur les utilisateurs viderait aussi les aliments).
 */
export async function resetDatabase(): Promise<void> {
  await db().execute(sql`
    truncate table access_links, accounts, sessions, two_factors, verifications, goals, profiles,
      meal_entries, water_logs, weight_entries, favorites, rate_limits, llm_calls, photos,
      food_corrections, containers, personal_expressions, shared_meals, shared_meal_shares, metabolism_checks, larger_days, daily_checkins, coach_messages, coach_reviews, push_subscriptions, notification_log, meal_plan_items, shopping_items, training_profiles, training_programs, training_sessions, custom_exercises, body_measurements, progress_photos, activities, daily_steps, fasting_plans, fasts, treatment_logs, treatments, saved_meals restart identity
  `);
  // Les recettes du catalogue (et leurs ingrédients) restent, comme en production.
  const catalog = sql`source = 'recipe' and source_ref like 'catalog:%'`;
  await db().execute(sql`delete from recipe_items where recipe_id not in (select id from foods where ${catalog})`);
  await db().execute(sql`delete from foods where source <> 'ciqual' and not (${catalog})`);
  await db().execute(sql`delete from users`);
  await db().execute(sql`delete from households`);
  await db().execute(
    sql`delete from app_settings where key not in ('ciqual_dataset_sha256', 'recipes_catalog_sha256')`,
  );
}
