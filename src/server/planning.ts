import "server-only";

import { and, asc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { foods, MEAL_SLOTS, mealPlanItems, recipeItems, shoppingItems } from "@/db/schema";
import { todayIso } from "@/domain/dates";
import { addDays } from "@/domain/energy";
import { nutrientsFor } from "@/domain/nutrition";
import { AISLES, type PlannedDish, shoppingFromPlan } from "@/domain/planning";
import { CATEGORY_SLOTS, type RecipeCategory } from "@/domain/recipes/catalog";
import { seededRandom } from "@/domain/recipes/dish-art";
import { weekDates } from "@/domain/weekly-budget";
import { proposeMenu, scanFridge, writeRecipeSteps } from "@/llm";

import { DomainError } from "./errors";
import { createRecipe, familyRecipes, getFood, getRecipeForEdit, per100, setRecipeSteps } from "./foods";
import { daySummary } from "./journal";
import { matchFoodNames, photoInputSchema } from "./meal-ai";
import { isImage } from "./photos";
import { getGoalOn, getProfile } from "./profile";
import { catalogEntries } from "./recipes";

// --- Menu de la semaine ---------------------------------------------------------------

export type PlanItem = {
  id: string;
  date: string;
  slot: (typeof MEAL_SLOTS)[number];
  foodId: string | null;
  label: string;
  servings: number;
  /** Calories d'une part, si le plat est une recette ou un aliment connu. */
  kcalPerServing: number | null;
  /** Photo du plat pour le tableau de la semaine : la recette du catalogue (`catalogRef`) ou l'image de l'aliment. */
  catalogRef: string | null;
  imageUrl: string | null;
};

export async function weekPlan(householdId: string, weekStart: string): Promise<PlanItem[]> {
  const rows = await db()
    .select({
      id: mealPlanItems.id,
      date: mealPlanItems.date,
      slot: mealPlanItems.slot,
      foodId: mealPlanItems.foodId,
      label: mealPlanItems.label,
      servings: mealPlanItems.servings,
      kcal: foods.kcal,
      unitWeights: foods.unitWeights,
      source: foods.source,
      sourceRef: foods.sourceRef,
      imageUrl: foods.imageUrl,
    })
    .from(mealPlanItems)
    .leftJoin(foods, eq(foods.id, mealPlanItems.foodId))
    .where(
      and(
        eq(mealPlanItems.householdId, householdId),
        gte(mealPlanItems.date, weekStart),
        lte(mealPlanItems.date, addDays(weekStart, 6)),
      ),
    )
    .orderBy(asc(mealPlanItems.date), asc(mealPlanItems.createdAt));
  return rows
    .map(({ kcal, unitWeights, source, sourceRef, ...row }) => ({
      ...row,
      catalogRef: source === "recipe" ? sourceRef : null,
      kcalPerServing: kcal === null ? null : Math.round((kcal * (unitWeights?.portion ?? 100)) / 100),
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || MEAL_SLOTS.indexOf(a.slot) - MEAL_SLOTS.indexOf(b.slot));
}

export const planItemSchema = z
  .object({
    date: z.iso.date(),
    slot: z.enum(MEAL_SLOTS),
    foodId: z.uuid().nullable(),
    label: z.string().trim().max(80),
    servings: z.number().min(0.5).max(20),
  })
  .refine((value) => value.foodId !== null || value.label.length > 0, { path: ["label"], message: "required" });
export type PlanItemInput = z.input<typeof planItemSchema>;

/** Le menu est commun : seul un plat que tout le foyer voit (recette, aliment public) y entre. */
async function sharedDish(userId: string, foodId: string) {
  const food = await getFood(userId, foodId);
  if (food.ownerUserId !== null) throw new DomainError("dish_not_shared");
  return food;
}

export async function addPlanItem(userId: string, householdId: string, input: PlanItemInput): Promise<string> {
  const data = planItemSchema.parse(input);
  const food = data.foodId ? await sharedDish(userId, data.foodId) : null;
  const [row] = await db()
    .insert(mealPlanItems)
    .values({
      householdId,
      date: data.date,
      slot: data.slot,
      foodId: food?.id ?? null,
      label: data.label || food!.nameFr,
      servings: data.servings,
      createdBy: userId,
    })
    .returning({ id: mealPlanItems.id });
  return row!.id;
}

export async function removePlanItem(householdId: string, id: string): Promise<void> {
  await db()
    .delete(mealPlanItems)
    .where(and(eq(mealPlanItems.id, z.uuid().parse(id)), eq(mealPlanItems.householdId, householdId)));
}

// --- Menu proposé par le coach ----------------------------------------------------------

const PLANNED_SLOTS = ["breakfast", "lunch", "dinner"] as const;
/** Part de l'objectif du jour visée par repas. */
const SLOT_SHARE = { breakfast: 0.25, lunch: 0.35, dinner: 0.3 } as const;
const SLOT_NAMES = { breakfast: "petit-déjeuner", lunch: "déjeuner", dinner: "dîner" } as const;
const MAX_RECIPES_IN_PROMPT = 50;
/** Type de plat indiqué au coach, pour qu'il mette un petit-déjeuner au petit-déjeuner. */
const CATEGORY_NAMES: Record<RecipeCategory, string> = {
  breakfast: "petit-déjeuner",
  main: "plat",
  soup: "soupe",
  salad: "salade",
  dessert: "dessert",
  snack: "en-cas",
};

export const generateMenuSchema = z.object({
  weekStart: z.iso.date(),
  slots: z.array(z.enum(PLANNED_SLOTS)).min(1).max(3),
  servings: z.number().min(1).max(20),
});

type Ingredient = { name: string; grams: number };

/**
 * Associe les ingrédients proposés par l'IA aux aliments de la base, pour plusieurs plats à la fois
 * (un seul appel pour choisir parmi les résultats de recherche).
 */
async function matchIngredients(userId: string, dishes: readonly (readonly Ingredient[])[]) {
  const all = dishes.flat();
  const foundAll = await matchFoodNames(
    userId,
    all.map((ingredient) => ingredient.name),
  );
  let offset = 0;
  return dishes.map((ingredients) => {
    const found = foundAll.slice(offset, offset + ingredients.length);
    offset += ingredients.length;
    return {
      items: ingredients.flatMap((ingredient, i) => {
        const food = found[i];
        return food ? [{ food, grams: Math.round(ingredient.grams) }] : [];
      }),
      missing: ingredients.flatMap((ingredient, i) => (found[i] ? [] : [ingredient.name])),
    };
  });
}

/**
 * Le coach remplit les créneaux vides de la semaine (à partir d'aujourd'hui) : il reprend une
 * recette du foyer ou propose un nouveau plat, enregistré comme recette du foyer avec ses
 * ingrédients trouvés dans la base. Un seul appel au LLM. Renvoie le nombre de repas ajoutés.
 */
export async function generateMenu(
  userId: string,
  householdId: string,
  input: z.input<typeof generateMenuSchema>,
): Promise<number> {
  const data = generateMenuSchema.parse(input);
  const today = todayIso();
  const [profile, goal, existing, recipes, catalog] = await Promise.all([
    getProfile(userId),
    getGoalOn(userId, today),
    weekPlan(householdId, data.weekStart),
    familyRecipes(userId),
    catalogEntries(),
  ]);
  if (!profile) throw new DomainError("not_found");
  const taken = new Set(existing.map((item) => `${item.date}:${item.slot}`));
  const wanted = weekDates(data.weekStart).flatMap((date, day) =>
    date < today ? [] : data.slots.filter((slot) => !taken.has(`${date}:${slot}`)).map((slot) => ({ day, date, slot })),
  );
  if (wanted.length === 0) return 0;

  // Recettes du foyer d'abord, puis celles du catalogue Pommelia (avec photo) qui vont aux repas
  // demandés et au régime, mélangées selon la semaine pour varier d'une semaine à l'autre.
  const vegetarianOnly = profile.diet === "vegetarian" || profile.diet === "vegan";
  const fromCatalog = catalog
    .filter(
      (entry) =>
        CATEGORY_SLOTS[entry.recipe.category].some((slot) => wanted.some((meal) => meal.slot === slot)) &&
        (!vegetarianOnly || entry.recipe.vegetarian),
    )
    .map((entry) => ({ entry, order: seededRandom(`${data.weekStart}:${entry.recipe.slug}`)() }))
    .sort((a, b) => a.order - b.order)
    .map(({ entry }) => ({
      id: entry.id,
      nameFr: entry.recipe.name,
      kcal: entry.portionKcal,
      category: entry.recipe.category,
    }));
  const pool = [
    ...recipes.map((recipe) => ({
      id: recipe.id,
      nameFr: recipe.nameFr,
      kcal: Math.round((recipe.kcal * (recipe.unitWeights?.portion ?? 100)) / 100),
      category: null,
    })),
    ...fromCatalog,
  ].slice(0, MAX_RECIPES_IN_PROMPT);
  const kcal = goal?.kcal ?? 2000;
  const prompt = [
    `Régime : ${profile.diet}${profile.foodsToAvoid ? `, à éviter : ${profile.foodsToAvoid}` : ""}.`,
    `Objectif par repas (une part) : ${data.slots.map((slot) => `${SLOT_NAMES[slot]} ~${Math.round(kcal * SLOT_SHARE[slot])} kcal`).join(", ")}.`,
    pool.length > 0
      ? `Recettes disponibles (à préférer) :\n${pool
          .map(
            (recipe, index) =>
              `${index + 1}. ${recipe.nameFr} (${recipe.category ? `${CATEGORY_NAMES[recipe.category]}, ` : ""}${recipe.kcal} kcal/part)`,
          )
          .join("\n")}`
      : "Pas encore de recette.",
    `Créneaux à remplir (jour 0 = lundi) : ${wanted.map((meal) => `${meal.day}:${meal.slot}`).join(", ")}.`,
  ].join("\n");
  const plan = await proposeMenu(userId, prompt);
  // Ingrédients des nouveaux plats, associés aux aliments de la base en une seule fois.
  const matched = await matchIngredients(
    userId,
    plan.meals.map((meal) => (meal.name && !(meal.recipe !== null && pool[meal.recipe - 1]) ? meal.ingredients : [])),
  );

  let added = 0;
  for (const [index, meal] of plan.meals.entries()) {
    const target = wanted.find((slot) => slot.day === meal.day && slot.slot === meal.slot);
    if (!target) continue;
    let foodId: string | null = null;
    let label = meal.name;
    const recipe = meal.recipe !== null ? pool[meal.recipe - 1] : undefined;
    if (recipe) {
      foodId = recipe.id;
      label = recipe.nameFr;
    } else if (meal.ingredients.length > 0 && meal.name) {
      const { items } = matched[index]!;
      if (items.length > 0) {
        foodId = await createRecipe(userId, {
          name: meal.name,
          servings: 1,
          cookedGrams: null,
          items: items.map((item) => ({ foodId: item.food.id, grams: item.grams })),
        });
      }
    }
    if (!label) continue;
    await db().insert(mealPlanItems).values({
      householdId,
      date: target.date,
      slot: target.slot,
      foodId,
      label,
      servings: data.servings,
      createdBy: userId,
    });
    wanted.splice(wanted.indexOf(target), 1);
    added += 1;
  }
  return added;
}

// --- Liste de courses ---------------------------------------------------------------------

export type ShoppingItem = typeof shoppingItems.$inferSelect;

export async function listShopping(householdId: string): Promise<ShoppingItem[]> {
  const rows = await db().select().from(shoppingItems).where(eq(shoppingItems.householdId, householdId));
  return rows.sort(
    (a, b) =>
      Number(a.checked) - Number(b.checked) ||
      AISLES.indexOf(a.aisle) - AISLES.indexOf(b.aisle) ||
      a.label.localeCompare(b.label, "fr"),
  );
}

export const shoppingItemSchema = z.object({
  label: z.string().trim().min(1, "required").max(80),
  note: z.string().trim().max(60).default(""),
  aisle: z.enum(AISLES).default("other"),
});

export async function addShoppingItem(householdId: string, input: z.input<typeof shoppingItemSchema>): Promise<void> {
  const data = shoppingItemSchema.parse(input);
  await db()
    .insert(shoppingItems)
    .values({ householdId, label: data.label, note: data.note || null, aisle: data.aisle });
}

export async function setShoppingChecked(householdId: string, id: string, checked: boolean): Promise<void> {
  await db()
    .update(shoppingItems)
    .set({ checked: z.boolean().parse(checked), updatedAt: new Date() })
    .where(and(eq(shoppingItems.id, z.uuid().parse(id)), eq(shoppingItems.householdId, householdId)));
}

export async function clearCheckedShopping(householdId: string): Promise<void> {
  await db()
    .delete(shoppingItems)
    .where(and(eq(shoppingItems.householdId, householdId), eq(shoppingItems.checked, true)));
}

/**
 * Remplit la liste avec les ingrédients du menu de la semaine (à partir d'aujourd'hui),
 * multipliés par le nombre de parts. Les articles du menu non cochés sont remplacés ; les
 * articles saisis à la main et ceux déjà cochés restent. Renvoie le nombre d'articles.
 */
export async function shoppingFromMenu(householdId: string, weekStart: string): Promise<number> {
  const from = [weekStart, todayIso()].sort().at(-1)!;
  const plan = (await weekPlan(householdId, z.iso.date().parse(weekStart))).filter(
    (item) => item.foodId !== null && item.date >= from,
  );
  const dishIds = [...new Set(plan.map((item) => item.foodId!))];
  const dishes =
    dishIds.length === 0
      ? []
      : await db()
          .select({
            id: foods.id,
            name: foods.nameFr,
            group: foods.groupFr,
            source: foods.source,
            servings: foods.servings,
            unitWeights: foods.unitWeights,
          })
          .from(foods)
          .where(inArray(foods.id, dishIds));
  const recipeIds = dishes.filter((dish) => dish.source === "recipe").map((dish) => dish.id);
  const ingredients =
    recipeIds.length === 0
      ? []
      : await db()
          .select({
            recipeId: recipeItems.recipeId,
            foodId: foods.id,
            name: foods.nameFr,
            group: foods.groupFr,
            grams: recipeItems.grams,
          })
          .from(recipeItems)
          .innerJoin(foods, eq(foods.id, recipeItems.foodId))
          .where(inArray(recipeItems.recipeId, recipeIds));
  const byId = new Map(dishes.map((dish) => [dish.id, dish]));
  const planned: PlannedDish[] = plan.flatMap((item) => {
    const dish = byId.get(item.foodId!);
    if (!dish) return [];
    if (dish.source !== "recipe") {
      const grams = dish.unitWeights?.portion ?? 100;
      return [
        {
          servings: item.servings,
          ingredients: [{ foodId: dish.id, name: dish.name, group: dish.group, gramsPerServing: grams }],
        },
      ];
    }
    const servings = dish.servings ?? 1;
    return [
      {
        servings: item.servings,
        ingredients: ingredients
          .filter((row) => row.recipeId === dish.id)
          .map((row) => ({
            foodId: row.foodId,
            name: row.name,
            group: row.group,
            gramsPerServing: row.grams / servings,
          })),
      },
    ];
  });
  const lines = shoppingFromPlan(planned);
  await db().transaction(async (tx) => {
    await tx
      .delete(shoppingItems)
      .where(
        and(
          eq(shoppingItems.householdId, householdId),
          eq(shoppingItems.fromMenu, true),
          eq(shoppingItems.checked, false),
        ),
      );
    if (lines.length > 0) {
      await tx.insert(shoppingItems).values(
        lines.map((line) => ({
          householdId,
          label: line.name,
          grams: line.grams,
          aisle: line.aisle,
          foodId: line.foodId,
          fromMenu: true,
        })),
      );
    }
  });
  return lines.length;
}

// --- Scanner de frigo ---------------------------------------------------------------------

export type FridgeIdea = {
  name: string;
  kcal: number;
  fits: boolean;
  items: { foodId: string; name: string; grams: number }[];
  missing: string[];
};
export type FridgeResult = { ingredients: string[]; remainingKcal: number | null; ideas: FridgeIdea[] };

export const fridgeInputSchema = photoInputSchema.pick({ imageBase64: true, mime: true });

/**
 * Photo du frigo ou du placard : ingrédients visibles et 3 idées, dont les calories sont
 * calculées depuis la base locale et comparées à ce qu'il reste aujourd'hui. La photo n'est
 * pas conservée.
 */
export async function fridgeIdeas(userId: string, input: z.input<typeof fridgeInputSchema>): Promise<FridgeResult> {
  const data = fridgeInputSchema.parse(input);
  if (!isImage(Uint8Array.from(Buffer.from(data.imageBase64, "base64")), data.mime)) {
    throw new DomainError("invalid_photo");
  }
  const [profile, summary] = await Promise.all([getProfile(userId), daySummary(userId, todayIso())]);
  const remaining = summary.goal ? Math.round(summary.goal.kcal - summary.totals.kcal) : null;
  const scan = await scanFridge(
    userId,
    { mime: data.mime, base64: data.imageBase64 },
    [
      profile ? `Régime : ${profile.diet}${profile.foodsToAvoid ? `, à éviter : ${profile.foodsToAvoid}` : ""}.` : null,
      remaining !== null ? `Budget pour une portion : ${Math.max(300, remaining)} kcal au plus.` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  const matched = await matchIngredients(
    userId,
    scan.ideas.map((idea) => idea.ingredients),
  );
  const ideas = await Promise.all(
    scan.ideas.map(async (idea, index) => {
      const { items, missing } = matched[index]!;
      const kcal = Math.round(items.reduce((sum, item) => sum + nutrientsFor(per100(item.food), item.grams).kcal, 0));
      return {
        name: idea.name,
        kcal,
        fits: remaining === null || kcal <= remaining,
        items: items.map((item) => ({ foodId: item.food.id, name: item.food.nameFr, grams: item.grams })),
        missing,
      };
    }),
  );
  return {
    ingredients: scan.ingredients,
    remainingKcal: remaining,
    ideas: ideas.filter((idea) => idea.items.length > 0),
  };
}

export const saveIdeaSchema = z.object({
  name: z.string().trim().min(1).max(80),
  items: z
    .array(z.object({ foodId: z.uuid(), grams: z.number().min(1).max(2000) }))
    .min(1)
    .max(12),
});

/** Enregistre une idée comme recette d'une portion (elle rejoint la bibliothèque). */
export async function saveIdeaAsRecipe(userId: string, input: z.input<typeof saveIdeaSchema>): Promise<string> {
  const data = saveIdeaSchema.parse(input);
  return createRecipe(userId, { name: data.name, servings: 1, cookedGrams: null, items: data.items });
}

// --- Bibliothèque ----------------------------------------------------------------------------

/** Recettes de l'utilisateur et du foyer. */
export async function recipeLibrary(userId: string, householdId: string) {
  return db()
    .select({
      id: foods.id,
      name: foods.nameFr,
      kcal: foods.kcal,
      unitWeights: foods.unitWeights,
      servings: foods.servings,
      ownerUserId: foods.ownerUserId,
      imageUrl: foods.imageUrl,
    })
    .from(foods)
    .where(
      and(
        eq(foods.source, "recipe"),
        or(eq(foods.ownerUserId, userId), and(isNull(foods.ownerUserId), eq(foods.householdId, householdId))),
      ),
    )
    .orderBy(asc(foods.nameFr));
}

// --- Préparation d'une recette -------------------------------------------------------

/**
 * Le coach rédige la préparation d'une recette modifiable qui n'en a pas (recettes créées
 * depuis le menu ou le frigo, ou saisies sans étapes). Elle est enregistrée et modifiable.
 */
export async function suggestRecipeSteps(userId: string, recipeId: string): Promise<string[]> {
  const recipe = await getRecipeForEdit(userId, recipeId);
  if (recipe.steps.length > 0) return recipe.steps;
  const steps = await writeRecipeSteps(
    userId,
    [
      `Recette : ${recipe.name} (${recipe.servings} portion${recipe.servings > 1 ? "s" : ""}).`,
      `Ingrédients : ${recipe.items.map((item) => `${item.food.nameFr} ${Math.round(item.grams)} g`).join(", ")}.`,
    ].join("\n"),
  );
  await setRecipeSteps(userId, recipe.id, steps);
  return steps;
}
