import postgres from "postgres";

/**
 * Les parcours e2e partent d'une base vide (jamais exécuté contre la production),
 * en gardant la table Ciqual et les recettes du catalogue importées.
 */
export default async function globalSetup() {
  if (process.env.E2E_BASE_URL) return;
  const sql = postgres(process.env.DATABASE_URL ?? "postgres://pommelia:pommelia@localhost:5432/pommelia", { max: 1 });
  await sql`truncate table access_links, accounts, sessions, two_factors, verifications, goals, profiles,
    meal_entries, water_logs, weight_entries, favorites, rate_limits, llm_calls, photos, food_corrections, containers,
    personal_expressions, shared_meals, shared_meal_shares, metabolism_checks, larger_days, daily_checkins, coach_messages, coach_reviews, push_subscriptions, notification_log, meal_plan_items, shopping_items, training_profiles, training_programs, training_sessions, custom_exercises, body_measurements, progress_photos, activities, daily_steps, fasting_plans, fasts, treatment_logs, treatments, saved_meals restart identity`;
  // Pas de TRUNCATE ... CASCADE sur users : il viderait aussi la table des aliments.
  // On garde la table Ciqual et les recettes du catalogue (avec leurs ingrédients).
  const catalog = sql`source = 'recipe' and source_ref like 'catalog:%'`;
  await sql`delete from recipe_items where recipe_id not in (select id from foods where ${catalog})`;
  await sql`delete from foods where source <> 'ciqual' and not (${catalog})`;
  await sql`delete from users`;
  await sql`delete from households`;
  await sql`delete from app_settings where key not in ('ciqual_dataset_sha256', 'recipes_catalog_sha256')`;
  await sql.end();
}
