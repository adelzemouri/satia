import "server-only";

import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { favorites, foods, mealEntries, recipeItems, user } from "@/db/schema";
import { kcalFromMacros, type Nutrients, nutrientsFor, recipePer100g } from "@/domain/nutrition";
import { normalizeForSearch } from "@/domain/search";

import { DomainError } from "./errors";

export type Food = typeof foods.$inferSelect;

/** Champs utiles à l'affichage et au calcul d'une ligne de journal. */
export const foodSummaryColumns = {
  id: foods.id,
  source: foods.source,
  ownerUserId: foods.ownerUserId,
  householdId: foods.householdId,
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
  householdId: string | null;
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

/** Foyer d'un utilisateur, en sous-requête SQL. */
function householdOf(userId: string) {
  return sql`(select ${user.householdId} from ${user} where ${user.id} = ${userId})`;
}

/** Aliments visibles par un utilisateur : publics, à lui, ou recettes de son foyer. */
function visibleTo(userId: string) {
  return or(
    and(isNull(foods.ownerUserId), isNull(foods.householdId)),
    eq(foods.ownerUserId, userId),
    eq(foods.householdId, householdOf(userId)),
  );
}

/** Aliments qu'un utilisateur peut modifier ou supprimer : les siens et ceux de son foyer. */
function editableBy(userId: string) {
  return or(eq(foods.ownerUserId, userId), eq(foods.householdId, householdOf(userId)));
}

export const SEARCH_LIMIT = 25;

/**
 * Recherche floue tolérante aux accents et aux fautes (trigrammes sur le nom normalisé).
 * Ordre : aliments personnels et recettes du foyer, puis les noms qui commencent par la recherche, puis par son
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
      sql`(${foods.ownerUserId} is not null or ${foods.householdId} is not null) desc`,
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
  /** Recette du foyer : visible et modifiable par tous ses membres. */
  family: z.boolean().default(false),
});
export type RecipeInput = z.input<typeof recipeSchema>;

/** Valeurs pour 100 g et poids d'une portion, calculés depuis les ingrédients. */
async function computeRecipe(userId: string, data: z.infer<typeof recipeSchema>) {
  const ingredientIds = [...new Set(data.items.map((item) => item.foodId))];
  const ingredients = await db()
    .select(foodSummaryColumns)
    .from(foods)
    .where(and(inArray(foods.id, ingredientIds), visibleTo(userId)));
  const byId = new Map(ingredients.map((food) => [food.id, food]));
  if (byId.size !== ingredientIds.length) throw new DomainError("not_found");
  // Les autres membres ne voient pas nos aliments personnels : une recette du foyer n'en contient pas.
  if (data.family && ingredients.some((food) => food.ownerUserId !== null)) {
    throw new DomainError("family_recipe_personal_ingredient");
  }
  const rawGrams = data.items.reduce((sum, item) => sum + item.grams, 0);
  const totalGrams = data.cookedGrams ?? rawGrams;
  const per100 = recipePer100g(
    data.items.map((item) => nutrientsFor(byId.get(item.foodId)!, item.grams)),
    totalGrams,
  );
  return {
    nameFr: data.name,
    searchName: normalizeForSearch(data.name),
    ...per100,
    servings: data.servings,
    unitWeights: { portion: round2(totalGrams / data.servings) },
  };
}

async function householdIdOf(userId: string): Promise<string> {
  const [row] = await db().select({ householdId: user.householdId }).from(user).where(eq(user.id, userId));
  if (!row) throw new DomainError("not_found");
  return row.householdId;
}

/** Crée une recette : un aliment dont les valeurs pour 100 g viennent de ses ingrédients. */
export async function createRecipe(userId: string, input: RecipeInput): Promise<string> {
  const data = recipeSchema.parse(input);
  const values = await computeRecipe(userId, data);
  const owner = data.family
    ? { ownerUserId: null, householdId: await householdIdOf(userId) }
    : { ownerUserId: userId, householdId: null };
  return db().transaction(async (tx) => {
    const [recipe] = await tx
      .insert(foods)
      .values({ source: "recipe", ...owner, ...values })
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

/**
 * Modifie une recette personnelle ou du foyer. Une recette personnelle peut être partagée
 * avec le foyer ; une recette du foyer le reste. Le journal garde ses valeurs figées.
 */
export async function updateRecipe(userId: string, recipeId: string, input: RecipeInput): Promise<void> {
  const data = recipeSchema.parse(input);
  const [recipe] = await db()
    .select({ id: foods.id, householdId: foods.householdId })
    .from(foods)
    .where(and(eq(foods.id, z.uuid().parse(recipeId)), eq(foods.source, "recipe"), editableBy(userId)));
  if (!recipe) throw new DomainError("not_found");
  // Une recette du foyer le reste : les autres membres peuvent en dépendre.
  if (recipe.householdId) data.family = true;
  const values = await computeRecipe(userId, data);
  const owner = data.family ? { ownerUserId: null, householdId: await householdIdOf(userId) } : {};
  await db().transaction(async (tx) => {
    await tx
      .update(foods)
      .set({ ...values, ...owner, updatedAt: new Date() })
      .where(eq(foods.id, recipe.id));
    await tx.delete(recipeItems).where(eq(recipeItems.recipeId, recipe.id));
    await tx
      .insert(recipeItems)
      .values(
        data.items.map((item, position) => ({ recipeId: recipe.id, foodId: item.foodId, grams: item.grams, position })),
      );
  });
}

export type RecipeDetails = {
  id: string;
  name: string;
  servings: number;
  family: boolean;
  /** Poids total déclaré (cuit), ou null s'il vaut la somme des ingrédients. */
  cookedGrams: number | null;
  items: { food: FoodSummary; grams: number }[];
};

/** Recette modifiable par l'utilisateur, avec ses ingrédients, pour le formulaire d'édition. */
export async function getRecipeForEdit(userId: string, recipeId: string): Promise<RecipeDetails> {
  const [recipe] = await db()
    .select()
    .from(foods)
    .where(and(eq(foods.id, z.uuid().parse(recipeId)), eq(foods.source, "recipe"), editableBy(userId)));
  if (!recipe) throw new DomainError("not_found");
  const rows = await db()
    .select({ ...foodSummaryColumns, grams: recipeItems.grams })
    .from(recipeItems)
    .innerJoin(foods, eq(foods.id, recipeItems.foodId))
    .where(eq(recipeItems.recipeId, recipe.id))
    .orderBy(recipeItems.position);
  const servings = recipe.servings ?? 1;
  const totalGrams = (recipe.unitWeights?.portion ?? 0) * servings;
  const rawGrams = rows.reduce((sum, row) => sum + row.grams, 0);
  return {
    id: recipe.id,
    name: recipe.nameFr,
    servings,
    family: recipe.householdId !== null,
    cookedGrams: Math.abs(totalGrams - rawGrams) < 1 ? null : Math.round(totalGrams),
    items: rows.map(({ grams, ...food }) => ({ food, grams })),
  };
}

/** Recettes communes du foyer de l'utilisateur. */
export async function familyRecipes(userId: string): Promise<FoodSummary[]> {
  return db()
    .select(foodSummaryColumns)
    .from(foods)
    .where(eq(foods.householdId, householdOf(userId)))
    .orderBy(foods.nameFr);
}

/** Supprime un aliment personnel ou une recette (à soi ou du foyer). Le journal garde ses valeurs figées. */
export async function deleteOwnFood(userId: string, foodId: string): Promise<void> {
  const [used] = await db()
    .select({ id: recipeItems.id })
    .from(recipeItems)
    .where(eq(recipeItems.foodId, foodId))
    .limit(1);
  if (used) throw new DomainError("food_in_recipe");
  const deleted = await db()
    .delete(foods)
    .where(and(eq(foods.id, foodId), editableBy(userId)))
    .returning({ id: foods.id });
  if (deleted.length === 0) throw new DomainError("not_found");
}

export function per100(food: Pick<FoodSummary, "kcal" | "proteinG" | "carbsG" | "fatG">): Nutrients {
  return { kcal: food.kcal, proteinG: food.proteinG, carbsG: food.carbsG, fatG: food.fatG };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
