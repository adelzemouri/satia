-- Toutes les recettes deviennent communes au foyer de leur auteur (voir DECISIONS 031).
UPDATE "foods" SET "household_id" = "users"."household_id", "owner_user_id" = NULL, "updated_at" = now()
FROM "users"
WHERE "foods"."owner_user_id" = "users"."id" AND "foods"."source" = 'recipe';--> statement-breakpoint
-- Leurs aliments perso aussi, sinon les autres membres ne verraient pas les ingrédients.
UPDATE "foods" SET "household_id" = "users"."household_id", "owner_user_id" = NULL, "updated_at" = now()
FROM "users"
WHERE "foods"."owner_user_id" = "users"."id"
  AND EXISTS (SELECT 1 FROM "recipe_items" WHERE "recipe_items"."food_id" = "foods"."id");
