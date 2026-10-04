import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db/client";
import { coachMessages, coachReviews, foods, llmCalls, user } from "@/db/schema";
import { todayIso } from "@/domain/dates";
import { addDays } from "@/domain/energy";
import { catalogRecipe } from "@/domain/recipes/catalog";
import { isoWeekStart } from "@/domain/streak";
import type { OnboardingInput } from "@/features/onboarding/schema";
import { setupFirstAdmin } from "@/server/accounts";
import {
  clearCoachMessages,
  ensureWeeklyReview,
  lastWeekReview,
  listCoachMessages,
  sendCoachMessage,
  setCoachStyle,
  suggestedDish,
} from "@/server/coach";
import { collectUserData } from "@/server/data-export";
import { createRecipe, searchFoods } from "@/server/foods";
import { addEntry } from "@/server/journal";
import { getProfile, saveOnboarding } from "@/server/profile";
import { setAiSettings } from "@/server/settings";

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
  coachStyle: "zen",
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

describe("coach", () => {
  beforeEach(async () => {
    await resetDatabase();
    vi.stubEnv("LLM_PROVIDER", "mock");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("répond avec le contexte du jour et garde la conversation", async () => {
    const userId = await setupUser();
    expect((await getProfile(userId))?.coachStyle).toBe("zen");
    const reply = await sendCoachMessage(userId, "  Que manger ce soir ?  ");
    expect(reply.role).toBe("coach");
    expect(reply.content).toContain("« Que manger ce soir ? »");

    const [call] = await db().select().from(llmCalls);
    expect(call).toMatchObject({ feature: "coach", userId, status: "ok" });

    const messages = await listCoachMessages(userId);
    expect(messages.map((message) => message.role)).toEqual(["user", "coach"]);
    expect(messages[0]!.content).toBe("Que manger ce soir ?");

    await sendCoachMessage(userId, "Et demain midi ?");
    expect((await listCoachMessages(userId)).map((message) => message.role)).toEqual([
      "user",
      "coach",
      "user",
      "coach",
    ]);
    await clearCoachMessages(userId);
    expect(await listCoachMessages(userId)).toEqual([]);
  });

  it("répond localement, sans appel au LLM, sous le plancher ou sur une dose", async () => {
    const userId = await setupUser();
    expect(await sendCoachMessage(userId, "Fais-moi un menu à 900 kcal par jour")).toMatchObject({
      notice: "floor",
      content: "",
    });
    expect(await sendCoachMessage(userId, "Quelle dose de mon médicament ?")).toMatchObject({ notice: "medical" });
    expect(await db().select().from(llmCalls)).toEqual([]);
  });

  it("ne garde que les 100 derniers messages", async () => {
    const userId = await setupUser();
    const start = Date.now() - 1_000_000;
    await db()
      .insert(coachMessages)
      .values(
        Array.from({ length: 100 }, (_, index) => ({
          userId,
          role: index % 2 === 0 ? ("user" as const) : ("coach" as const),
          content: `message ${index}`,
          createdAt: new Date(start + index * 1000),
        })),
      );
    await sendCoachMessage(userId, "Dernière question");
    const rows = await db().select().from(coachMessages).where(eq(coachMessages.userId, userId));
    expect(rows).toHaveLength(100);
    expect(rows.some((row) => row.content === "message 0")).toBe(false);
    expect(rows.some((row) => row.content === "Dernière question")).toBe(true);
  });

  it("sans IA, ne stocke rien et signale l'indisponibilité", async () => {
    const userId = await setupUser();
    await setAiSettings({ enabled: false, monthlyBudgetUsd: null });
    await expect(sendCoachMessage(userId, "Une idée ?")).rejects.toMatchObject({ reason: "disabled" });
    expect(await listCoachMessages(userId)).toEqual([]);
  });

  it("rédige le bilan de la semaine écoulée une seule fois, avec assez de jours saisis", async () => {
    const userId = await setupUser();
    const lastMonday = addDays(isoWeekStart(today), -7);
    // L'onboarding date d'aujourd'hui : on recule l'objectif pour couvrir la semaine écoulée.
    await db().execute(`update goals set effective_from = '${addDays(lastMonday, -1)}'`);
    const lentils = await firstFood(userId, "lentille cuite");

    await addEntry(userId, { date: lastMonday, slot: "lunch", foodId: lentils.id, quantity: 300, unit: "g" });
    await addEntry(userId, {
      date: addDays(lastMonday, 1),
      slot: "lunch",
      foodId: lentils.id,
      quantity: 300,
      unit: "g",
    });
    expect(await ensureWeeklyReview(userId, today)).toBeNull();
    expect(await db().select().from(llmCalls)).toEqual([]);

    await addEntry(userId, {
      date: addDays(lastMonday, 2),
      slot: "lunch",
      foodId: lentils.id,
      quantity: 300,
      unit: "g",
    });
    const review = await ensureWeeklyReview(userId, today);
    expect(review).toMatchObject({ weekStart: lastMonday });
    expect(review!.content.summary).toContain("régularité");
    expect(await ensureWeeklyReview(userId, today)).toEqual(review);
    expect(await lastWeekReview(userId, today)).toEqual(review);
    expect(await db().select().from(llmCalls)).toHaveLength(1);
    expect(await db().select().from(coachReviews)).toHaveLength(1);

    const data = await collectUserData(userId);
    expect(data.coachReviews).toHaveLength(1);
  });

  it("suggère un plat adapté au repas et au reste du jour, sans LLM", async () => {
    const userId = await setupUser();
    const lentils = await firstFood(userId, "lentille cuite");
    const rice = await firstFood(userId, "riz blanc cuit");
    const id = await createRecipe(userId, {
      name: "Dahl maison",
      servings: 2,
      cookedGrams: null,
      items: [
        { foodId: lentils.id, grams: 400 },
        { foodId: rice.id, grams: 200 },
      ],
    });
    const dinner = { slot: "dinner", goalKcal: 2000, remainingKcal: 1000 } as const;
    // Sans photo, le plat de la famille n'est pas proposé : une recette illustrée du catalogue le remplace.
    const unpictured = await suggestedDish(userId, dinner, today);
    expect(unpictured?.id).not.toBe(id);
    expect(unpictured?.catalogSlug).toBeTruthy();
    await db().update(foods).set({ imageUrl: "https://example.test/dahl.jpg" }).where(eq(foods.id, id));
    const dish = await suggestedDish(userId, dinner, today);
    expect(dish).toMatchObject({ id, name: "Dahl maison" });
    expect(dish!.portionKcal).toBeGreaterThan(240);
    expect(await suggestedDish(userId, { ...dinner, remainingKcal: 60 }, today)).toBeNull();
    // Jamais noté au petit-déjeuner : à ce repas, une recette du catalogue prend le relais.
    const breakfast = await suggestedDish(userId, { ...dinner, slot: "breakfast" }, today);
    expect(breakfast?.id).not.toBe(id);
    expect(catalogRecipe(breakfast!.catalogSlug!)?.category).toBe("breakfast");
    expect(await db().select().from(llmCalls)).toEqual([]);
  });

  it("change la personnalité du coach", async () => {
    const userId = await setupUser();
    await setCoachStyle(userId, "chef");
    expect((await getProfile(userId))?.coachStyle).toBe("chef");
  });
});
