import "server-only";

import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { favorites, foods, mealEntries, recipeItems } from "@/db/schema";
import { kcalFromMacros, type Nutrients, nutrientsFor, recipePer100g } from "@/domain/nutrition";
import { normalizeForSearch } from "@/domain/search";

import { DomainError } from "./errors";

export type Food = typeof foods.$inferSelect;

/** Champs utiles à l'affichage et au calcul d'une ligne de journal. */
export const foodSummaryColumns = {
  id: foods.id,
  source: foods.source,
  ownerUserId: foods.ownerUserId,
  nameFr: foods.nameFr,
  brand: foods.brand,
  kcal: foods.kcal,
  proteinG: foods.proteinG,
  carbsG: foods.carbsG,
  fatG: foods.fatG,
  densityGPerMl: foods.densityGPerMl,
  unitWeights: foods.unitWeights,
  servings: foods.servings,
  imageUrl: foods.imageUrl,
};
export type FoodSummary = {
  id: string;
  source: Food["source"];
  ownerUserId: string | null;
  nameFr: string;
  brand: string | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  densityGPerMl: number | null;
  unitWeights: Food["unitWeights"];
  servings: number | null;
  imageUrl: string | null;
};

/** Aliments visibles par un utilisateur : publics, ou à lui. */
function visibleTo(userId: string) {
  return or(isNull(foods.ownerUserId), eq(foods.ownerUserId, userId));
}

export const SEARCH_LIMIT = 25;

/**
 * Recherche floue tolérante aux accents et aux fautes (trigrammes sur le nom normalisé).
 * Ordre : aliments personnels, puis les noms qui commencent par la recherche, puis par son
 * premier mot, puis ceux qui contiennent tous les mots, puis les plus proches et les plus courts.
 */
export async function searchFoods(userId: string, query: string): Promise<FoodSummary[]> {
  const q = normalizeForSearch(query);
  if (q.length < 2) return [];
  const words = q.split(" ").slice(0, 6);
  const allWords = sql.join(
    words.map((word) => sql`${foods.searchName} like ${`%${word}%`}`),
    sql` and `,
  );
  return db()
    .select(foodSummaryColumns)
    .from(foods)
    .where(
      and(
        visibleTo(userId),
        or(
          sql`(${allWords})`,
          sql`word_similarity(${q}, ${foods.searchName}) > 0.45`,
          sql`similarity(${foods.searchName}, ${q}) > 0.3`,
        ),
      ),
    )
    .orderBy(
      sql`(${foods.ownerUserId} is not null) desc`,
      sql`(${foods.searchName} like ${`${q}%`}) desc`,
      sql`(${foods.searchName} like ${`${words[0]}%`}) desc`,
      sql`(${allWords}) desc`,
      sql`word_similarity(${q}, ${foods.searchName}) desc`,
      sql`length(${foods.searchName})`,
    )
    .limit(SEARCH_LIMIT);
}

export async function getFood(userId: string, foodId: string): Promise<FoodSummary> {
  const [food] = await db()
    .select(foodSummaryColumns)
    .from(foods)
    .where(and(eq(foods.id, foodId), visibleTo(userId)));
  if (!food) throw new DomainError("not_found");
  return food;
}

export async function getFoods(userId: string, foodIds: readonly string[]): Promise<FoodSummary[]> {
  if (foodIds.length === 0) return [];
  return db()
    .select(foodSummaryColumns)
    .from(foods)
    .where(and(inArray(foods.id, [...new Set(foodIds)]), visibleTo(userId)));
}

/** Fiche complète d'un aliment visible par l'utilisateur. */
export async function getFoodDetails(userId: string, foodId: string): Promise<Food> {
  const [food] = await db()
    .select()
    .from(foods)
    .where(and(eq(foods.id, z.uuid().parse(foodId)), visibleTo(userId)));
  if (!food) throw new DomainError("not_found");
  return food;
}

/** Derniers aliments saisis, du plus récent au plus ancien, sans doublon. */
export async function recentFoods(userId: string, limit = 15): Promise<FoodSummary[]> {
  const recent = db()
    .select({ foodId: mealEntries.foodId, lastUsed: sql<Date>`max(${mealEntries.createdAt})`.as("last_used") })
    .from(mealEntries)
    .where(and(eq(mealEntries.userId, userId), sql`${mealEntries.foodId} is not null`))
    .groupBy(mealEntries.foodId)
    .as("recent");
  return db()
    .select(foodSummaryColumns)
    .from(recent)
    .innerJoin(foods, eq(foods.id, recent.foodId))
    .where(visibleTo(userId))
    .orderBy(desc(recent.lastUsed))
    .limit(limit);
}

export async function favoriteFoods(userId: string): Promise<FoodSummary[]> {
  return db()
    .select(foodSummaryColumns)
    .from(favorites)
    .innerJoin(foods, eq(foods.id, favorites.foodId))
    .where(and(eq(favorites.userId, userId), visibleTo(userId)))
    .orderBy(foods.nameFr);
}

export async function favoriteIds(userId: string): Promise<Set<string>> {
  const rows = await db().select({ foodId: favorites.foodId }).from(favorites).where(eq(favorites.userId, userId));
  return new Set(rows.map((row) => row.foodId));
}

export async function setFavorite(userId: string, foodId: string, favorite: boolean): Promise<void> {
  await getFood(userId, foodId);
  if (favorite) {
    await db().insert(favorites).values({ userId, foodId }).onConflictDoNothing();
  } else {
    await db()
      .delete(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.foodId, foodId)));
  }
}

/** Aliments personnels et recettes de l'utilisateur. */
export async function ownFoods(userId: string): Promise<FoodSummary[]> {
  return db().select(foodSummaryColumns).from(foods).where(eq(foods.ownerUserId, userId)).orderBy(foods.nameFr);
}

const positive = z.number().min(0).max(1000);

/** Aliment personnel : valeurs pour 100 g, ou pour une portion dont on donne le poids. */
export const customFoodSchema = z
  .object({
    name: z.string().trim().min(1, "required").max(120),
    brand: z.string().trim().max(80).optional().default(""),
    basis: z.enum(["100g", "portion"]),
    portionGrams: z.number().min(1).max(2000).nullable(),
    kcal: z.number().min(0).max(5000).nullable(),
    proteinG: positive,
    carbsG: positive,
    fatG: positive,
  })
  .superRefine((value, ctx) => {
    if (value.basis === "portion" && !value.portionGrams) {
      ctx.addIssue({ code: "custom", path: ["portionGrams"], message: "required" });
    }
  });
export type CustomFoodInput = z.input<typeof customFoodSchema>;

export async function createCustomFood(userId: string, input: CustomFoodInput): Promise<string> {
  const data = customFoodSchema.parse(input);
  const factor = data.basis === "portion" ? 100 / data.portionGrams! : 1;
  const kcal = data.kcal ?? kcalFromMacros(data.proteinG, data.carbsG, data.fatG);
  const name = data.name;
  const [row] = await db()
    .insert(foods)
    .values({
      source: "custom",
      ownerUserId: userId,
      nameFr: name,
      brand: data.brand || null,
      searchName: normalizeForSearch(`${name} ${data.brand}`),
      kcal: round2(kcal * factor),
      proteinG: round2(data.proteinG * factor),
      carbsG: round2(data.carbsG * factor),
      fatG: round2(data.fatG * factor),
      unitWeights: data.basis === "portion" ? { portion: data.portionGrams! } : null,
    })
    .returning({ id: foods.id });
  return row!.id;
}

export const recipeSchema = z.object({
  name: z.string().trim().min(1, "required").max(120),
  servings: z.number().int().min(1).max(50),
  /** Poids total après cuisson, s'il est connu ; sinon la somme des ingrédients. */
  cookedGrams: z.number().min(1).max(20_000).nullable(),
  items: z
    .array(z.object({ foodId: z.uuid(), grams: z.number().min(1).max(10_000) }))
    .min(1, "recipe_empty")
    .max(40),
});
export type RecipeInput = z.input<typeof recipeSchema>;

/** Crée une recette : un aliment dont les valeurs pour 100 g viennent de ses ingrédients. */
export async function createRecipe(userId: string, input: RecipeInput): Promise<string> {
  const data = recipeSchema.parse(input);
  const ingredientIds = [...new Set(data.items.map((item) => item.foodId))];
  const ingredients = await db()
    .select(foodSummaryColumns)
    .from(foods)
    .where(and(inArray(foods.id, ingredientIds), visibleTo(userId)));
  const byId = new Map(ingredients.map((food) => [food.id, food]));
  if (byId.size !== ingredientIds.length) throw new DomainError("not_found");

  const rawGrams = data.items.reduce((sum, item) => sum + item.grams, 0);
  const totalGrams = data.cookedGrams ?? rawGrams;
  const per100 = recipePer100g(
    data.items.map((item) => nutrientsFor(byId.get(item.foodId)!, item.grams)),
    totalGrams,
  );

  return db().transaction(async (tx) => {
    const [recipe] = await tx
      .insert(foods)
      .values({
        source: "recipe",
        ownerUserId: userId,
        nameFr: data.name,
        searchName: normalizeForSearch(data.name),
        ...per100,
        servings: data.servings,
        unitWeights: { portion: round2(totalGrams / data.servings) },
      })
      .returning({ id: foods.id });
    await tx.insert(recipeItems).values(
      data.items.map((item, position) => ({
        recipeId: recipe!.id,
        foodId: item.foodId,
        grams: item.grams,
        position,
      })),
    );
    return recipe!.id;
  });
}

/** Supprime un aliment personnel ou une recette. Le journal garde ses valeurs figées. */
export async function deleteOwnFood(userId: string, foodId: string): Promise<void> {
  const [used] = await db()
    .select({ id: recipeItems.id })
    .from(recipeItems)
    .innerJoin(foods, eq(foods.id, recipeItems.recipeId))
    .where(and(eq(recipeItems.foodId, foodId), eq(foods.ownerUserId, userId)))
    .limit(1);
  if (used) throw new DomainError("food_in_recipe");
  const deleted = await db()
    .delete(foods)
    .where(and(eq(foods.id, foodId), eq(foods.ownerUserId, userId)))
    .returning({ id: foods.id });
  if (deleted.length === 0) throw new DomainError("not_found");
}

export function per100(food: Pick<FoodSummary, "kcal" | "proteinG" | "carbsG" | "fatG">): Nutrients {
  return { kcal: food.kcal, proteinG: food.proteinG, carbsG: food.carbsG, fatG: food.fatG };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
