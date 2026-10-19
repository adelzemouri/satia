import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db/client";
import { foods, llmCalls, recipeItems, user } from "@/db/schema";
import { todayIso } from "@/domain/dates";
import { addDays } from "@/domain/energy";
import { isoWeekStart } from "@/domain/streak";
import type { OnboardingInput } from "@/features/onboarding/schema";
import { setupFirstAdmin } from "@/server/accounts";
import { createCustomFood, createRecipe, searchFoods } from "@/server/foods";
import {
  addPlanItem,
  addShoppingItem,
  clearCheckedShopping,
  fridgeIdeas,
  generateMenu,
  listShopping,
  recipeLibrary,
  removePlanItem,
  saveIdeaAsRecipe,
  setShoppingChecked,
  shoppingFromMenu,
  weekPlan,
} from "@/server/planning";
import { saveOnboarding } from "@/server/profile";
import { catalogEntries } from "@/server/recipes";

import { resetDatabase } from "./helpers";

const answers: OnboardingInput = {
  firstName: "Adel",
  sex: "male",
  birthDate: "1988-04-12",
  heightCm: 178,
  weightKg: 82,
  goal: "maintain",
  targetWeightKg: null,
  activityLevel: 2,
  pace: "gentle",
  diet: "omnivore",
  foodsToAvoid: "",
  mealTimes: { breakfast: "07:30", lunch: "12:30", dinner: "20:00" },
  budgetMode: "daily",
  disclaimerAccepted: true,
};

/** Semaine prochaine : tous ses jours sont à venir, quel que soit le jour du test. */
const nextWeek = addDays(isoWeekStart(todayIso()), 7);
const JPEG_BASE64 = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]).toString("base64");

async function setupUser() {
  await setupFirstAdmin({
    setupToken: process.env.SETUP_TOKEN!,
    householdName: "Famille",
    name: "Adel",
    email: "adel@example.com",
    password: "un-mot-de-passe-solide",
  });
  const [row] = await db().select().from(user).where(eq(user.email, "adel@example.com"));
  await saveOnboarding(row!.id, answers);
  return { userId: row!.id, householdId: row!.householdId! };
}

async function firstFood(userId: string, query: string) {
  const [food] = await searchFoods(userId, query);
  if (!food) throw new Error(`aliment introuvable : ${query}`);
  return food;
}

async function familySoup(userId: string) {
  const carrot = await firstFood(userId, "carotte crue");
  return createRecipe(userId, {
    name: "Soupe de carottes",
    servings: 4,
    cookedGrams: null,
    items: [{ foodId: carrot.id, grams: 600 }],
  });
}

describe("planification", () => {
  beforeEach(async () => {
    await resetDatabase();
    vi.stubEnv("LLM_PROVIDER", "mock");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("ajoute et retire des plats du menu commun, sans aliment personnel", async () => {
    const { userId, householdId } = await setupUser();
    const soup = await familySoup(userId);
    const mine = await createCustomFood(userId, {
      name: "Ma sauce",
      basis: "100g",
      portionGrams: null,
      kcal: 200,
      proteinG: 2,
      carbsG: 10,
      fatG: 16,
    });

    const id = await addPlanItem(userId, householdId, {
      date: addDays(nextWeek, 2),
      slot: "dinner",
      foodId: soup,
      label: "",
      servings: 4,
    });
    await addPlanItem(userId, householdId, {
      date: nextWeek,
      slot: "lunch",
      foodId: null,
      label: "Restes",
      servings: 2,
    });
    await expect(
      addPlanItem(userId, householdId, { date: nextWeek, slot: "lunch", foodId: mine, label: "", servings: 1 }),
    ).rejects.toMatchObject({ code: "dish_not_shared" });

    const plan = await weekPlan(householdId, nextWeek);
    expect(plan.map((item) => [item.label, item.servings])).toEqual([
      ["Restes", 2],
      ["Soupe de carottes", 4],
    ]);
    expect(plan[1]!.kcalPerServing).toBeGreaterThan(0);

    await removePlanItem(householdId, id);
    expect((await weekPlan(householdId, nextWeek)).map((item) => item.label)).toEqual(["Restes"]);
  });

  it("le coach remplit les créneaux vides : recette reprise et nouveau plat du foyer", async () => {
    const { userId, householdId } = await setupUser();
    await familySoup(userId);
    const added = await generateMenu(userId, householdId, {
      weekStart: nextWeek,
      slots: ["lunch", "dinner"],
      servings: 2,
    });
    expect(added).toBe(2);
    const plan = await weekPlan(householdId, nextWeek);
    expect(plan.map((item) => [item.date, item.slot, item.label])).toEqual([
      [nextWeek, "dinner", "Poêlée de lentilles aux carottes"],
      [addDays(nextWeek, 1), "lunch", "Soupe de carottes"],
    ]);
    const [created] = await db().select().from(foods).where(eq(foods.id, plan[0]!.foodId!));
    expect(created).toMatchObject({ source: "recipe", ownerUserId: null, householdId });
    expect((await db().select().from(llmCalls))[0]).toMatchObject({ feature: "menu_plan", status: "ok" });

    // Créneaux déjà pris : rien n'est ajouté une seconde fois.
    await addPlanItem(userId, householdId, {
      date: nextWeek,
      slot: "lunch",
      foodId: null,
      label: "Pique-nique",
      servings: 2,
    });
    const again = await generateMenu(userId, householdId, {
      weekStart: nextWeek,
      slots: ["lunch", "dinner"],
      servings: 2,
    });
    expect(again).toBe(0);
  });

  it("les ingrédients d'un nouveau plat sont des aliments, jamais un autre plat du foyer", async () => {
    const { userId, householdId } = await setupUser();
    // Recette du foyer dont le nom contient deux ingrédients du plat proposé : la recherche la classe en tête.
    const carrot = await firstFood(userId, "carotte crue");
    await createRecipe(userId, {
      name: "Carottes rôties à l'huile d'olive",
      servings: 2,
      cookedGrams: null,
      items: [{ foodId: carrot.id, grams: 300 }],
    });
    await generateMenu(userId, householdId, { weekStart: nextWeek, slots: ["dinner"], servings: 2 });
    const [planned] = await weekPlan(householdId, nextWeek);
    expect(planned!.label).toBe("Poêlée de lentilles aux carottes");
    const ingredients = await db()
      .select({ name: foods.nameFr, source: foods.source })
      .from(recipeItems)
      .innerJoin(foods, eq(foods.id, recipeItems.foodId))
      .where(eq(recipeItems.recipeId, planned!.foodId!));
    expect(ingredients).toHaveLength(3);
    expect(ingredients.every((item) => item.source === "ciqual")).toBe(true);
    // Un seul appel pour choisir les aliments de tout le menu.
    const calls = await db().select().from(llmCalls);
    expect(calls.filter((call) => call.feature === "food_match")).toHaveLength(1);
  });

  it("remplit la liste de courses avec le menu, en gardant les articles cochés et ajoutés à la main", async () => {
    const { userId, householdId } = await setupUser();
    const soup = await familySoup(userId);
    await addPlanItem(userId, householdId, { date: nextWeek, slot: "dinner", foodId: soup, label: "", servings: 2 });
    await addPlanItem(userId, householdId, {
      date: addDays(nextWeek, 3),
      slot: "dinner",
      foodId: soup,
      label: "",
      servings: 4,
    });
    await addShoppingItem(householdId, { label: "Papier cuisson", note: "", aisle: "other" });

    expect(await shoppingFromMenu(householdId, nextWeek)).toBe(1);
    let list = await listShopping(householdId);
    // 600 g pour 4 parts, 6 parts au menu : 900 g.
    expect(list.map((item) => [item.label, item.grams, item.aisle, item.fromMenu])).toEqual([
      [expect.stringMatching(/^Carotte/), 900, "produce", true],
      ["Papier cuisson", null, "other", false],
    ]);

    await setShoppingChecked(householdId, list[0]!.id, true);
    expect(await shoppingFromMenu(householdId, nextWeek)).toBe(1);
    list = await listShopping(householdId);
    expect(list.map((item) => [item.checked, item.fromMenu])).toEqual([
      [false, true],
      [false, false],
      [true, true],
    ]);

    await clearCheckedShopping(householdId);
    expect(await listShopping(householdId)).toHaveLength(2);
  });

  it("met une recette du catalogue Pommelia au menu, qui remplit la liste de courses", async () => {
    const { userId, householdId } = await setupUser();
    const [harira] = (await catalogEntries()).filter((entry) => entry.recipe.slug === "harira");
    expect(harira).toBeDefined();
    await addPlanItem(userId, householdId, {
      date: nextWeek,
      slot: "dinner",
      foodId: harira!.id,
      label: "",
      servings: 4,
    });

    const plan = await weekPlan(householdId, nextWeek);
    expect(plan.map((item) => [item.label, item.catalogRef])).toEqual([["Harira", "catalog:harira"]]);
    expect(plan[0]!.kcalPerServing).toBe(harira!.portionKcal);
    expect(await shoppingFromMenu(householdId, nextWeek)).toBeGreaterThan(3);
  });

  it("propose des idées depuis la photo du frigo, chiffrées par la base, et les enregistre", async () => {
    const { userId, householdId } = await setupUser();
    const result = await fridgeIdeas(userId, { imageBase64: JPEG_BASE64, mime: "image/jpeg" });
    expect(result.ingredients).toContain("tomate");
    expect(result.remainingKcal).toBeGreaterThan(0);
    expect(result.ideas.map((idea) => idea.name)).toContain("Omelette à la tomate");
    const omelette = result.ideas.find((idea) => idea.name === "Omelette à la tomate")!;
    expect(omelette.kcal).toBeGreaterThan(100);
    expect(omelette.fits).toBe(true);
    expect((await db().select().from(llmCalls))[0]).toMatchObject({ feature: "fridge", status: "ok" });

    await expect(
      fridgeIdeas(userId, { imageBase64: Buffer.alloc(200, 7).toString("base64"), mime: "image/jpeg" }),
    ).rejects.toMatchObject({ code: "invalid_photo" });

    const id = await saveIdeaAsRecipe(userId, {
      name: omelette.name,
      items: omelette.items.map((item) => ({ foodId: item.foodId, grams: item.grams })),
    });
    const library = await recipeLibrary(userId, householdId);
    expect(library).toEqual([expect.objectContaining({ id, name: "Omelette à la tomate", ownerUserId: null })]);
  });
});
