import "server-only";

import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray, isNotNull, isNull, like, lt, ne, or, type SQL, sql } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { favorites, foods, mealEntries, recipeItems, user } from "@/db/schema";
import { RECENT_PAGE } from "@/domain/food-name";
import { kcalFromMacros, type Nutrients, nutrientsFor, recipePer100g } from "@/domain/nutrition";
import { recipeQuality } from "@/domain/quality";
import { CATALOG_PREFIX } from "@/domain/recipes/catalog";
import { normalizeForSearch, searchVariants, searchStems } from "@/domain/search";

import { COUNT_UNITS, type Unit } from "@/domain/units";
import { AiUnavailableError, generateRecipeImage } from "@/llm";
import { llmConfig } from "@/llm/config";

import { DomainError } from "./errors";
import { imageMime, isImage, PHOTO_MIME_TYPES } from "./photos";
import { deleteObjects, putObject, signedGetUrl } from "./storage";

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

/** Lettres accentuées des noms d'aliments et leur forme sans accent, pour `translate` en SQL. */
const ACCENTED = "àâäáãåçéèêëíìîïñóòôöõúùûüýÿ";
const UNACCENTED = "aaaaaaceeeeiiiinooooouuuuyy";

/**
 * Recherche floue tolérante aux accents et aux fautes (trigrammes sur le nom normalisé).
 * Ordre : aliments personnels et recettes du foyer, puis les noms qui commencent par la recherche, puis
 * par sa formulation Ciqual (« café allongé » → café prêt à boire, pas moulu), puis ceux qui
 * contiennent tous les mots, ceux qui en contiennent le plus, ceux qui commencent par le premier mot,
 * puis les plus proches et les plus courts. Un nom qui ne contient que le premier mot reste trouvé :
 * Ciqual ne connaît pas « bien mûre », la banane doit sortir quand même.
 */
export async function searchFoods(userId: string, query: string): Promise<FoodSummary[]> {
  const q = normalizeForSearch(query);
  if (q.length < 2) return [];
  const words = q.split(" ").slice(0, 6);
  const variants = searchVariants(q);
  // Tous les mots de la recherche, ou d'une de ses formulations Ciqual (« crème liquide » → « crème fluide »).
  // Les mots sont pris par leur début : « oignons » trouve « Oignon, cru », « spaghetti cuits » des pâtes « cuites ».
  const allWordsIn = (name: SQL, split: (text: string) => string[]) =>
    sql.join(
      [q, ...variants].map(
        (text) =>
          sql`(${sql.join(
            split(text).map((word) => sql`${name} like ${`%${word}%`}`),
            sql` and `,
          )})`,
      ),
      sql` or `,
    );
  const wholeWords = (text: string) => text.split(" ").slice(0, 6);
  const wordStarts = (text: string) => (searchStems(text).length > 0 ? searchStems(text) : wholeWords(text));
  // Mots de la recherche par lesquels commence un mot du nom. Le premier, qui nomme d'ordinaire
  // l'aliment, suffit à trouver : Ciqual ne dit ni « allongé » ni « bien mûre ».
  const stems = searchStems(q);
  const startsWord = (name: SQL, stem: string) => sql`(' ' || ${name} like ${`% ${stem}%`})`;
  const searchName = sql`${foods.searchName}`;
  // Pour classer, seul compte le nom avant la liste d'ingrédients entre parenthèses : « oignon vert »
  // n'est pas une « Printanière de légumes (haricots verts, …, oignons) ».
  const head = sql`regexp_replace(translate(replace(replace(lower(split_part(${foods.nameFr}, '(', 1)), 'œ', 'oe'), 'æ', 'ae'), ${ACCENTED}, ${UNACCENTED}), '[^a-z0-9]+', ' ', 'g')`;
  const wordHits = sql.join(
    stems.map((stem) => sql`${startsWord(head, stem)}::int`),
    sql` + `,
  );
  return db()
    .select(foodSummaryColumns)
    .from(foods)
    .where(
      and(
        visibleTo(userId),
        or(
          sql`(${allWordsIn(searchName, wordStarts)})`,
          ...(stems.length >= 2 ? [startsWord(searchName, stems[0]!)] : []),
          sql`word_similarity(${q}, ${foods.searchName}) > 0.45`,
          sql`similarity(${foods.searchName}, ${q}) > 0.3`,
        ),
      ),
    )
    .orderBy(
      sql`(${foods.ownerUserId} is not null or ${foods.householdId} is not null) desc`,
      sql`(${foods.searchName} like ${`${q}%`}) desc`,
      ...variants.map((variant) => sql`(${foods.searchName} like ${`${variant}%`}) desc`),
      // Tous les mots avant le premier seul : « coulis de tomate » donne « Tomate, coulis », pas un coulis de fruits.
      sql`(${allWordsIn(head, wordStarts)}) desc`,
      ...(stems.length >= 2 ? [sql`(${wordHits}) desc`] : []),
      sql`(${foods.searchName} like ${`${stems[0] ?? words[0]}%`}) desc`,
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

/** Aliment récent, avec la dernière portion saisie pour pouvoir le rajouter d'un geste. */
export type RecentFood = FoodSummary & { lastQuantity: number; lastUnit: Unit; lastKcal: number };

/** Derniers aliments saisis, du plus récent au plus ancien, sans doublon, page par page. */
export async function recentFoods(userId: string, limit = RECENT_PAGE, offset = 0): Promise<RecentFood[]> {
  // Dernière saisie de chaque aliment (DISTINCT ON garde la plus récente).
  const recent = db()
    .selectDistinctOn([mealEntries.foodId], {
      foodId: mealEntries.foodId,
      createdAt: mealEntries.createdAt,
      quantity: mealEntries.quantity,
      unit: mealEntries.unit,
      kcal: mealEntries.kcal,
    })
    .from(mealEntries)
    .where(and(eq(mealEntries.userId, userId), isNotNull(mealEntries.foodId)))
    .orderBy(mealEntries.foodId, desc(mealEntries.createdAt))
    .as("recent");
  return db()
    .select({
      ...foodSummaryColumns,
      lastQuantity: recent.quantity,
      lastUnit: recent.unit,
      lastKcal: recent.kcal,
    })
    .from(recent)
    .innerJoin(foods, eq(foods.id, recent.foodId))
    .where(visibleTo(userId))
    .orderBy(desc(recent.createdAt), recent.foodId)
    .limit(limit)
    .offset(offset);
}

export async function favoriteFoods(userId: string): Promise<FoodSummary[]> {
  return db()
    .select(foodSummaryColumns)
    .from(favorites)
    .innerJoin(foods, eq(foods.id, favorites.foodId))
    .where(and(eq(favorites.userId, userId), visibleTo(userId)))
    .orderBy(foods.nameFr);
}

const unitWeightSchema = z.object({
  foodId: z.uuid(),
  unit: z.enum(COUNT_UNITS),
  grams: z.number().positive().max(2000),
});

/**
 * Enregistre le poids d'une tranche, d'une pièce ou d'une portion pour un aliment qui ne le
 * précise pas (produit sans portion, aliment Ciqual). Les recettes gardent leur portion calculée.
 */
export async function setUnitWeight(userId: string, input: z.input<typeof unitWeightSchema>): Promise<void> {
  const data = unitWeightSchema.parse(input);
  const food = await getFood(userId, data.foodId);
  if (food.source === "recipe") throw new DomainError("not_found");
  await db()
    .update(foods)
    .set({
      unitWeights: { ...food.unitWeights, [data.unit]: Math.round(data.grams * 10) / 10 },
      updatedAt: new Date(),
    })
    .where(eq(foods.id, food.id));
}

export async function favoriteIds(userId: string): Promise<Set<string>> {
  const rows = await db().select({ foodId: favorites.foodId }).from(favorites).where(eq(favorites.userId, userId));
  return new Set(rows.map((row) => row.foodId));
}

export async function isFavorite(userId: string, foodId: string): Promise<boolean> {
  const rows = await db()
    .select({ foodId: favorites.foodId })
    .from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.foodId, foodId)))
    .limit(1);
  return rows.length > 0;
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

/**
 * Aliments personnels de l'utilisateur et aliments communs de son foyer. Les recettes, communes à
 * toute la famille, ont leur place dans Cuisine → Recettes.
 */
export async function ownFoods(userId: string): Promise<FoodSummary[]> {
  return db()
    .select(foodSummaryColumns)
    .from(foods)
    .where(and(editableBy(userId), ne(foods.source, "recipe")))
    .orderBy(foods.nameFr);
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
  /** Étapes de préparation, dans l'ordre. */
  steps: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
});
export type RecipeInput = z.input<typeof recipeSchema>;

/** Valeurs pour 100 g et poids d'une portion, calculés depuis les ingrédients. */
async function computeRecipe(userId: string, data: z.infer<typeof recipeSchema>) {
  const ingredientIds = [...new Set(data.items.map((item) => item.foodId))];
  const ingredients = await db()
    .select({
      ...foodSummaryColumns,
      fiberG: foods.fiberG,
      sugarsG: foods.sugarsG,
      saltG: foods.saltG,
      fruitVegShare: foods.fruitVegShare,
    })
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
  const quality = recipeQuality(
    data.items.map((item) => ({ ...byId.get(item.foodId)!, grams: item.grams })),
    totalGrams,
  );
  return {
    nameFr: data.name,
    searchName: normalizeForSearch(data.name),
    ...per100,
    ...quality,
    servings: data.servings,
    unitWeights: { portion: round2(totalGrams / data.servings) },
    recipeSteps: data.steps.length > 0 ? data.steps : null,
  };
}

/**
 * Toute recette est commune au foyer : ses aliments personnels le deviennent aussi, sinon les
 * autres membres ne verraient pas ses ingrédients et ne pourraient pas la modifier.
 */
type Tx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];

async function shareIngredients(tx: Tx, userId: string, householdId: string, foodIds: readonly string[]) {
  await tx
    .update(foods)
    .set({ ownerUserId: null, householdId, updatedAt: new Date() })
    .where(and(inArray(foods.id, [...foodIds]), eq(foods.ownerUserId, userId)));
}

async function householdIdOf(userId: string): Promise<string> {
  const [row] = await db().select({ householdId: user.householdId }).from(user).where(eq(user.id, userId));
  if (!row) throw new DomainError("not_found");
  return row.householdId;
}

/**
 * Crée une recette : un aliment dont les valeurs pour 100 g viennent de ses ingrédients.
 * Elle est commune au foyer, visible et modifiable par tous ses membres.
 */
export async function createRecipe(userId: string, input: RecipeInput): Promise<string> {
  const data = recipeSchema.parse(input);
  const values = await computeRecipe(userId, data);
  const householdId = await householdIdOf(userId);
  return db().transaction(async (tx) => {
    await shareIngredients(
      tx,
      userId,
      householdId,
      data.items.map((item) => item.foodId),
    );
    const [recipe] = await tx
      .insert(foods)
      .values({ source: "recipe", ownerUserId: null, householdId, ...values })
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

/** Modifie une recette du foyer. Le journal garde ses valeurs figées. */
export async function updateRecipe(userId: string, recipeId: string, input: RecipeInput): Promise<void> {
  const data = recipeSchema.parse(input);
  const [recipe] = await db()
    .select({ id: foods.id })
    .from(foods)
    .where(and(eq(foods.id, z.uuid().parse(recipeId)), eq(foods.source, "recipe"), editableBy(userId)));
  if (!recipe) throw new DomainError("not_found");
  const values = await computeRecipe(userId, data);
  const householdId = await householdIdOf(userId);
  await db().transaction(async (tx) => {
    await shareIngredients(
      tx,
      userId,
      householdId,
      data.items.map((item) => item.foodId),
    );
    await tx
      .update(foods)
      .set({ ...values, ownerUserId: null, householdId, updatedAt: new Date() })
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
  /** Poids total déclaré (cuit), ou null s'il vaut la somme des ingrédients. */
  cookedGrams: number | null;
  items: { food: FoodSummary; grams: number }[];
  steps: string[];
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
    cookedGrams: Math.abs(totalGrams - rawGrams) < 1 ? null : Math.round(totalGrams),
    items: rows.map(({ grams, ...food }) => ({ food, grams })),
    steps: recipe.recipeSteps ?? [],
  };
}

/** Ingrédients d'une recette visible par l'utilisateur, pour sa fiche. */
export async function recipeIngredients(
  userId: string,
  recipeId: string,
): Promise<{ id: string; name: string; grams: number }[]> {
  const [recipe] = await db()
    .select({ id: foods.id })
    .from(foods)
    .where(and(eq(foods.id, z.uuid().parse(recipeId)), eq(foods.source, "recipe"), visibleTo(userId)));
  if (!recipe) return [];
  return db()
    .select({ id: foods.id, name: foods.nameFr, grams: recipeItems.grams })
    .from(recipeItems)
    .innerJoin(foods, eq(foods.id, recipeItems.foodId))
    .where(eq(recipeItems.recipeId, recipe.id))
    .orderBy(recipeItems.position);
}

/** Enregistre les étapes de préparation d'une recette modifiable (proposées par le coach). */
export async function setRecipeSteps(userId: string, recipeId: string, steps: readonly string[]): Promise<void> {
  const value = z.array(z.string().trim().min(1).max(500)).min(1).max(20).parse(steps);
  const updated = await db()
    .update(foods)
    .set({ recipeSteps: value, updatedAt: new Date() })
    .where(and(eq(foods.id, z.uuid().parse(recipeId)), eq(foods.source, "recipe"), editableBy(userId)))
    .returning({ id: foods.id });
  if (updated.length === 0) throw new DomainError("not_found");
}

/** Recettes du foyer de l'utilisateur. */
export async function familyRecipes(userId: string): Promise<FoodSummary[]> {
  return db()
    .select(foodSummaryColumns)
    .from(foods)
    .where(and(eq(foods.householdId, householdOf(userId)), eq(foods.source, "recipe")))
    .orderBy(foods.nameFr);
}

/** Supprime un aliment personnel ou une recette (à soi ou du foyer). Le journal garde ses valeurs figées. */
/** Photo réduite côté client (côté long ≤ 1080 px) : quelques centaines de Ko au plus. */
const RECIPE_PHOTO_MAX_BYTES = 1_500_000;

export const recipePhotoSchema = z.object({
  foodId: z.uuid(),
  imageBase64: z
    .string()
    .min(1)
    .max(Math.ceil((RECIPE_PHOTO_MAX_BYTES * 4) / 3) + 4),
  mime: z.enum(PHOTO_MIME_TYPES),
});

/** Adresse de la photo privée d'une recette ; la version force le rafraîchissement après un changement. */
export function recipePhotoPath(foodId: string, version: string): string {
  return `/api/foods/${foodId}/photo?v=${version}`;
}

/** Recette modifiable par l'utilisateur (la sienne ou celle de son foyer), avec sa photo actuelle. */
async function editableRecipe(userId: string, foodId: string) {
  const [food] = await db()
    .select({ id: foods.id, photoKey: foods.photoKey, householdId: foods.householdId })
    .from(foods)
    .where(and(eq(foods.id, foodId), eq(foods.source, "recipe"), editableBy(userId)));
  if (!food) throw new DomainError("not_found");
  return food;
}

/** Pose (ou remplace) la photo d'une recette du foyer ; l'ancienne est retirée du stockage. */
export async function setRecipePhoto(userId: string, input: z.input<typeof recipePhotoSchema>): Promise<void> {
  const data = recipePhotoSchema.parse(input);
  const food = await editableRecipe(userId, data.foodId);
  const bytes = Uint8Array.from(Buffer.from(data.imageBase64, "base64"));
  if (bytes.length > RECIPE_PHOTO_MAX_BYTES || !isImage(bytes, data.mime)) throw new DomainError("invalid_photo");
  const id = randomUUID();
  const photoKey = `recipes/${food.householdId ?? userId}/${id}.${data.mime === "image/webp" ? "webp" : "jpg"}`;
  await putObject(photoKey, bytes, data.mime);
  await db()
    .update(foods)
    .set({ photoKey, imageUrl: recipePhotoPath(food.id, id.slice(0, 8)), updatedAt: new Date() })
    .where(eq(foods.id, food.id));
  if (food.photoKey) await deleteObjects([food.photoKey]).catch(logPhotoError);
}

/** URL signée (courte) de la photo d'une recette visible par l'utilisateur, sinon null. */
export async function recipePhotoUrl(userId: string, foodId: string): Promise<string | null> {
  const [food] = await db()
    .select({ photoKey: foods.photoKey })
    .from(foods)
    .where(and(eq(foods.id, foodId), visibleTo(userId)));
  return food?.photoKey ? signedGetUrl(food.photoKey) : null;
}

/** Dossier des photos refaites pour les recettes du catalogue, communes à tous les foyers. */
const CATALOG_FOLDER = "catalog";

/** Début du nom de fichier d'une photo générée par l'IA, pour la légender comme telle. */
const AI_PHOTO_PREFIX = "ai-";

/** Photo de recette générée par l'IA (et non prise par la famille). */
export function isGeneratedRecipePhoto(photoKey: string): boolean {
  return photoKey.split("/").at(-1)!.startsWith(AI_PHOTO_PREFIX);
}

type GeneratedPhoto = { photoKey: string; imageUrl: string };

/** Fait générer par l'IA la photo d'une recette (d'après son nom et ses ingrédients) et la range. */
async function generatePhoto(
  userId: string,
  recipe: { id: string; name: string; householdId: string | null },
  folder: string = recipe.householdId ?? userId,
): Promise<GeneratedPhoto | null> {
  const ingredients = await db()
    .select({ name: foods.nameFr })
    .from(recipeItems)
    .innerJoin(foods, eq(foods.id, recipeItems.foodId))
    .where(eq(recipeItems.recipeId, recipe.id))
    .orderBy(desc(recipeItems.grams));
  const bytes = await generateRecipeImage(
    userId,
    recipe.name,
    ingredients.map((item) => item.name.split(",")[0]!.toLowerCase()),
  );
  const mime = imageMime(bytes);
  if (!mime) return null;
  const id = randomUUID();
  const photoKey = `recipes/${folder}/${AI_PHOTO_PREFIX}${id}.${mime.slice("image/".length).replace("jpeg", "jpg")}`;
  await putObject(photoKey, bytes, mime);
  return { photoKey, imageUrl: recipePhotoPath(recipe.id, id.slice(0, 8)) };
}

/** Seul l'admin refait les photos : chaque image générée est payée sur le budget IA du foyer. */
async function isAdmin(userId: string): Promise<boolean> {
  const [row] = await db().select({ role: user.role }).from(user).where(eq(user.id, userId));
  return row?.role === "admin";
}

/**
 * Refait par l'IA la photo d'une recette qui ne ressemble pas au plat, ou lui en donne une :
 * recette du foyer ou du catalogue, réservé à l'admin. Une photo prise par la famille est
 * remplacée aussi, puisque l'admin le demande explicitement.
 */
export async function regenerateRecipePhoto(userId: string, foodId: string): Promise<void> {
  if (!(await isAdmin(userId))) throw new DomainError("forbidden");
  const [food] = await db()
    .select({
      id: foods.id,
      name: foods.nameFr,
      photoKey: foods.photoKey,
      householdId: foods.householdId,
      ownerUserId: foods.ownerUserId,
    })
    .from(foods)
    .where(and(eq(foods.id, z.uuid().parse(foodId)), eq(foods.source, "recipe"), visibleTo(userId)));
  if (!food) throw new DomainError("not_found");
  // Recette du catalogue (commune à tous) : sa photo est rangée à part, hors de tout foyer.
  const folder = food.householdId ?? (food.ownerUserId ? userId : CATALOG_FOLDER);
  const photo = await generatePhoto(userId, food, folder);
  if (!photo) throw new AiUnavailableError("provider_error");
  const [saved] = await db()
    .update(foods)
    .set({ ...photo, photoAttemptedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(foods.id, food.id), food.photoKey ? eq(foods.photoKey, food.photoKey) : isNull(foods.photoKey)))
    .returning({ id: foods.id });
  // Photo changée entre-temps : la nouvelle image n'est pas gardée.
  const obsolete = saved ? food.photoKey : photo.photoKey;
  if (obsolete) await deleteObjects([obsolete]).catch(logPhotoError);
}

/** Photos générées à la fois : quelques secondes chacune, dans la limite du budget IA. */
const GENERATED_PHOTOS_PER_RUN = 2;
/** Après un échec (IA en pause, budget atteint…), on retente une semaine plus tard. */
const PHOTO_RETRY_DAYS = 7;

/**
 * Donne une photo générée par l'IA aux recettes de l'utilisateur et de son foyer qui n'en ont
 * pas (existantes ou nouvelles). Lancé après l'affichage d'une page (`after`), sans bloquer :
 * chaque recette est d'abord réservée, pour ne jamais payer deux images pour la même.
 * Une photo posée par la famille entre-temps n'est jamais remplacée. Renvoie le nombre de photos créées.
 */
export async function fillRecipePhotos(userId: string, limit = GENERATED_PHOTOS_PER_RUN): Promise<number> {
  if (!llmConfig().imageModel) return 0;
  const retryBefore = new Date(Date.now() - PHOTO_RETRY_DAYS * 86_400_000);
  const pending = await db()
    .select({ id: foods.id, name: foods.nameFr, householdId: foods.householdId })
    .from(foods)
    .where(
      and(
        eq(foods.source, "recipe"),
        editableBy(userId),
        isNull(foods.photoKey),
        isNull(foods.imageUrl),
        or(isNull(foods.photoAttemptedAt), lt(foods.photoAttemptedAt, retryBefore)),
      ),
    )
    .orderBy(desc(foods.createdAt))
    .limit(limit);
  let created = 0;
  for (const recipe of pending) {
    const [claimed] = await db()
      .update(foods)
      .set({ photoAttemptedAt: new Date() })
      .where(and(eq(foods.id, recipe.id), or(isNull(foods.photoAttemptedAt), lt(foods.photoAttemptedAt, retryBefore))))
      .returning({ id: foods.id });
    if (!claimed) continue;
    let photo: GeneratedPhoto | null;
    try {
      photo = await generatePhoto(userId, recipe);
    } catch (error) {
      // IA indisponible (pause, budget, panne) : on s'arrête là et on réessaiera plus tard.
      if (error instanceof AiUnavailableError) break;
      throw error;
    }
    if (!photo) continue;
    const [saved] = await db()
      .update(foods)
      .set({ ...photo, updatedAt: new Date() })
      .where(and(eq(foods.id, recipe.id), isNull(foods.photoKey)))
      .returning({ id: foods.id });
    if (saved) created++;
    else await deleteObjects([photo.photoKey]).catch(logPhotoError);
  }
  return created;
}

/** Lance `fillRecipePhotos` une fois la réponse envoyée : la page ne l'attend jamais. */
export function fillRecipePhotosLater(userId: string, limit?: number): void {
  after(() =>
    fillRecipePhotos(userId, limit).catch((error: unknown) => console.error("Photos de recettes non générées", error)),
  );
}

function logPhotoError(error: unknown) {
  console.error("Suppression de la photo de recette échouée", error);
}

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
    .returning({ id: foods.id, photoKey: foods.photoKey });
  if (deleted.length === 0) throw new DomainError("not_found");
  const keys = deleted.flatMap((row) => row.photoKey ?? []);
  if (keys.length > 0) await deleteObjects(keys).catch(logPhotoError);
}

export function per100(food: Pick<FoodSummary, "kcal" | "proteinG" | "carbsG" | "fatG">): Nutrients {
  return { kcal: food.kcal, proteinG: food.proteinG, carbsG: food.carbsG, fatG: food.fatG };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Plats pour la suggestion du coach : recettes de l'utilisateur et de son foyer, et ses favoris. */
export async function dishPool(userId: string) {
  return db()
    .select({
      id: foods.id,
      name: foods.nameFr,
      kcal: foods.kcal,
      unitWeights: foods.unitWeights,
      imageUrl: foods.imageUrl,
      sourceRef: foods.sourceRef,
    })
    .from(foods)
    .leftJoin(favorites, and(eq(favorites.foodId, foods.id), eq(favorites.userId, userId)))
    .where(
      and(
        visibleTo(userId),
        or(
          and(eq(foods.source, "recipe"), or(editableBy(userId), like(foods.sourceRef, `${CATALOG_PREFIX}%`))),
          isNotNull(favorites.userId),
        ),
      ),
    )
    .limit(300);
}
