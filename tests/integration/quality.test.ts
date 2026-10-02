import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db/client";
import { mealEntries, user } from "@/db/schema";
import { todayIso } from "@/domain/dates";
import { addDays } from "@/domain/energy";
import type { OnboardingInput } from "@/features/onboarding/schema";
import { setupFirstAdmin } from "@/server/accounts";
import { collectUserData } from "@/server/data-export";
import { createRecipe, getFoodDetails, searchFoods } from "@/server/foods";
import { addEntry, copyEntries, entriesOn } from "@/server/journal";
import { cacheProduct } from "@/server/open-food-facts";
import { saveOnboarding } from "@/server/profile";
import { checkinOn, dayQualityFor, habitualMeal, setCheckin, weekQualityReport } from "@/server/quality";

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

const today = todayIso();

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
  return row!.id;
}

async function firstFood(userId: string, query: string) {
  const [food] = await searchFoods(userId, query);
  if (!food) throw new Error(`aliment introuvable : ${query}`);
  return food;
}

describe("qualité nutritionnelle", () => {
  beforeEach(resetDatabase);

  it("compte fibres et fruits/légumes du jour, et fait le bilan de la semaine", async () => {
    const userId = await setupUser();
    const apple = await firstFood(userId, "pomme crue");
    const lentils = await firstFood(userId, "lentille cuite");
    const spread = await getFoodDetails(
      userId,
      await cacheProduct({
        code: "3017620422003",
        name: "Pâte à tartiner",
        brand: null,
        kcal: 540,
        proteinG: 6,
        carbsG: 57,
        fatG: 31,
        fiberG: null,
        sugarsG: 56,
        saltG: 0.1,
        nutriscore: "e",
        novaGroup: 4,
        fruitVegShare: 0,
        servingGrams: 15,
        imageUrl: null,
      }),
    );
    expect(spread).toMatchObject({ nutriscore: "e", novaGroup: 4 });

    await addEntry(userId, { date: today, slot: "lunch", foodId: apple.id, quantity: 160, unit: "g" });
    await addEntry(userId, { date: today, slot: "lunch", foodId: lentils.id, quantity: 200, unit: "g" });
    await addEntry(userId, { date: addDays(today, -1), slot: "snack", foodId: spread.id, quantity: 30, unit: "g" });

    const day = await dayQualityFor(userId, today);
    expect(day.fruitVegPortions).toBe(2);
    expect(day.fiberG).toBeGreaterThan(10);

    const report = await weekQualityReport(userId, today);
    expect(report.from).toBe(addDays(today, -6));
    expect(report.quality).toMatchObject({ daysLogged: 2, topUltraProcessed: ["Pâte à tartiner"] });
    expect(report.quality!.ultraProcessedShare).toBe(1);
  });

  it("une recette hérite des fibres et de la part de fruits et légumes de ses ingrédients", async () => {
    const userId = await setupUser();
    const carrot = await firstFood(userId, "carotte cuite");
    const rice = await firstFood(userId, "riz basmati cuit");
    const id = await createRecipe(userId, {
      name: "Riz aux carottes",
      servings: 2,
      cookedGrams: null,
      items: [
        { foodId: carrot.id, grams: 200 },
        { foodId: rice.id, grams: 200 },
      ],
    });
    const recipe = await getFoodDetails(userId, id);
    expect(recipe.fruitVegShare).toBe(0.5);
    expect(recipe.fiberG).not.toBeNull();
  });

  it("enregistre le ressenti du jour, question par question", async () => {
    const userId = await setupUser();
    expect(await checkinOn(userId, today)).toEqual({ hunger: null, energy: null, mood: null });
    await setCheckin(userId, { date: today, energy: 4 });
    await setCheckin(userId, { date: today, mood: 5 });
    expect(await checkinOn(userId, today)).toEqual({ hunger: null, energy: 4, mood: 5 });
    await expect(setCheckin(userId, { date: today, hunger: 6 })).rejects.toThrow();
    await expect(setCheckin(userId, { date: addDays(today, 1), hunger: 3 })).rejects.toMatchObject({
      code: "future_date",
    });
    expect((await collectUserData(userId)).checkins).toHaveLength(1);
  });

  it("propose le repas habituel d'un créneau après 3 répétitions", async () => {
    const userId = await setupUser();
    const bread = await firstFood(userId, "pain de mie");
    const butter = await firstFood(userId, "beurre doux");
    const first = addDays(today, -5);
    await addEntry(userId, { date: first, slot: "breakfast", foodId: bread.id, quantity: 60, unit: "g" });
    await addEntry(userId, { date: first, slot: "breakfast", foodId: butter.id, quantity: 10, unit: "g" });
    await copyEntries(userId, { fromDate: first, fromSlot: "breakfast", toDate: addDays(today, -3), toSlot: null });
    expect(await habitualMeal(userId, "breakfast", today)).toBeNull();
    await copyEntries(userId, { fromDate: first, fromSlot: "breakfast", toDate: addDays(today, -1), toSlot: null });

    const habit = await habitualMeal(userId, "breakfast", today);
    expect(habit).toMatchObject({ fromDate: addDays(today, -1), slot: "breakfast", count: 3 });
    expect(habit!.labels).toHaveLength(2);
    expect(await habitualMeal(userId, "lunch", today)).toBeNull();

    // Une fois le petit-déjeuner saisi, on ne le propose plus.
    await copyEntries(userId, { fromDate: habit!.fromDate, fromSlot: "breakfast", toDate: today, toSlot: null });
    expect(await entriesOn(userId, today)).toHaveLength(2);
    expect(await habitualMeal(userId, "breakfast", today)).toBeNull();
    expect((await db().select().from(mealEntries)).length).toBe(8);
  });
});
