import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db/client";
import { user } from "@/db/schema";
import { todayIso } from "@/domain/dates";
import { addDays } from "@/domain/energy";
import type { OnboardingInput } from "@/features/onboarding/schema";
import { acceptInvite, createAccessLink, setupFirstAdmin } from "@/server/accounts";
import { collectUserData } from "@/server/data-export";
import { searchFoods } from "@/server/foods";
import { addEntry, entriesOn } from "@/server/journal";
import { saveOnboarding } from "@/server/profile";
import { deleteSavedMeal, listSavedMeals, saveMeal, serveSavedMeal, unserveSavedMeal } from "@/server/saved-meals";

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
  coachStyle: "teacher",
  disclaimerAccepted: true,
};

const today = todayIso();
const yesterday = addDays(today, -1);

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

/** Un deuxième membre du foyer, invité par l'admin. */
async function createMember(adminId: string) {
  const [admin] = await db().select().from(user).where(eq(user.id, adminId));
  const token = await createAccessLink({
    kind: "invite",
    householdId: admin!.householdId!,
    createdBy: adminId,
    role: "member",
    label: "Léo",
  });
  await acceptInvite({ token, name: "Léo", email: "leo@example.com", password: "mot-de-passe-de-leo" });
  const [member] = await db().select().from(user).where(eq(user.email, "leo@example.com"));
  return member!.id;
}

async function foodId(userId: string, query: string) {
  const [food] = await searchFoods(userId, query);
  if (!food) throw new Error(`aliment introuvable : ${query}`);
  return food.id;
}

describe("mes repas", () => {
  beforeEach(resetDatabase);

  it("enregistre un repas du journal et le resert d'un geste, annulable", async () => {
    const userId = await setupUser();
    await addEntry(userId, {
      date: yesterday,
      slot: "breakfast",
      foodId: await foodId(userId, "pomme"),
      quantity: 150,
      unit: "g",
    });
    await addEntry(userId, {
      date: yesterday,
      slot: "breakfast",
      foodId: await foodId(userId, "yaourt"),
      quantity: 125,
      unit: "g",
    });
    await addEntry(userId, {
      date: yesterday,
      slot: "lunch",
      foodId: await foodId(userId, "riz"),
      quantity: 200,
      unit: "g",
    });

    const id = await saveMeal(userId, { date: yesterday, slot: "breakfast", name: "  Mon petit-déj  " });
    const [meal] = await listSavedMeals(userId);
    expect(meal).toMatchObject({ id, name: "Mon petit-déj" });
    expect(meal!.items).toHaveLength(2);

    const before = await entriesOn(userId, yesterday);
    const ids = await serveSavedMeal(userId, { id, date: today, slot: "snack" });
    const served = await entriesOn(userId, today);
    expect(ids).toHaveLength(2);
    expect(served.map((entry) => entry.slot)).toEqual(["snack", "snack"]);
    expect(served.map((entry) => entry.kcal).sort()).toEqual(
      before
        .filter((entry) => entry.slot === "breakfast")
        .map((entry) => entry.kcal)
        .sort(),
    );
    expect((await listSavedMeals(userId))[0]!.usedAt).not.toBeNull();

    await unserveSavedMeal(userId, ids);
    expect(await entriesOn(userId, today)).toHaveLength(0);

    const exported = await collectUserData(userId);
    expect(exported.savedMeals).toHaveLength(1);

    await deleteSavedMeal(userId, id);
    expect(await listSavedMeals(userId)).toHaveLength(0);
  });

  it("refuse un repas vide, un jour à venir et le repas d'un autre membre", async () => {
    const userId = await setupUser();
    await expect(saveMeal(userId, { date: today, slot: "dinner", name: "Vide" })).rejects.toMatchObject({
      code: "nothing_to_save",
    });
    await addEntry(userId, {
      date: today,
      slot: "dinner",
      foodId: await foodId(userId, "pomme"),
      quantity: 100,
      unit: "g",
    });
    const id = await saveMeal(userId, { date: today, slot: "dinner", name: "Pomme" });
    await expect(serveSavedMeal(userId, { id, date: addDays(today, 1), slot: "dinner" })).rejects.toMatchObject({
      code: "future_date",
    });

    const other = await createMember(userId);
    await expect(serveSavedMeal(other, { id, date: today, slot: "dinner" })).rejects.toMatchObject({
      code: "not_found",
    });
    await deleteSavedMeal(other, id);
    await unserveSavedMeal(
      other,
      (await entriesOn(userId, today)).map((entry) => entry.id),
    );
    expect(await listSavedMeals(userId)).toHaveLength(1);
    expect(await entriesOn(userId, today)).toHaveLength(1);
  });
});
