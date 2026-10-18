import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db/client";
import { profiles, user } from "@/db/schema";
import { todayIso } from "@/domain/dates";
import { computePlan } from "@/domain/energy";
import type { OnboardingInput } from "@/features/onboarding/schema";
import { setupFirstAdmin } from "@/server/accounts";
import { proposeGoal, setAutomaticCalories, setManualCalories, updateGoal } from "@/server/goal-settings";
import { getGoalOn, getProfile, saveOnboarding } from "@/server/profile";

import { resetDatabase } from "./helpers";

const answers: OnboardingInput = {
  firstName: "Adel",
  sex: "male",
  birthDate: "1988-04-12",
  heightCm: 178,
  weightKg: 68,
  goal: "gain_muscle",
  targetWeightKg: 74,
  activityLevel: 2,
  pace: "moderate",
  diet: "omnivore",
  foodsToAvoid: "",
  mealTimes: { breakfast: "07:30", lunch: "12:30", dinner: "20:00" },
  budgetMode: "daily" as const,
  disclaimerAccepted: true,
};

async function setup() {
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

const today = todayIso();
const plan = (change: Partial<OnboardingInput>) =>
  computePlan({ ...answers, ...change, targetWeightKg: null, today }).kcal;

describe("réglages des objectifs depuis Moi", () => {
  beforeEach(resetDatabase);

  it("changer d'objectif recalcule les calories et retire un poids visé devenu incohérent", async () => {
    const userId = await setup();
    const { proposal } = await proposeGoal(userId, { goal: "lose_weight", pace: "gentle" });
    expect(proposal.kcal).toBe(plan({ goal: "lose_weight", pace: "gentle" }));
    expect(proposal.measured).toBe(false);

    await updateGoal(userId, { goal: "lose_weight", pace: "gentle" });
    const profile = await getProfile(userId);
    expect(profile?.goal).toBe("lose_weight");
    // 74 kg pour 68 kg aujourd'hui ne va plus dans le sens d'une perte.
    expect(profile?.targetWeightKg).toBeNull();
    const goal = await getGoalOn(userId);
    expect(goal?.kcal).toBe(proposal.kcal);
    expect(goal?.source).toBe("formula");
  });

  it("le niveau d'activité change la dépense estimée", async () => {
    const userId = await setup();
    await updateGoal(userId, { activityLevel: 4 });
    expect((await getGoalOn(userId))?.kcal).toBe(plan({ activityLevel: 4 }));
    expect((await getProfile(userId))?.targetWeightKg).toBe(74);
  });

  it("des calories choisies à la main restent fixes et jamais sous le plancher", async () => {
    const userId = await setup();
    await expect(setManualCalories(userId, 1400)).rejects.toThrow("below_floor");
    await setManualCalories(userId, 2500);
    expect((await getProfile(userId))?.goalLocked).toBe(true);
    const goal = await getGoalOn(userId);
    expect(goal).toMatchObject({ kcal: 2500, source: "manual" });

    // Changer d'activité ne touche plus aux calories.
    await updateGoal(userId, { activityLevel: 4 });
    expect((await getGoalOn(userId))?.kcal).toBe(2500);

    // Retour à l'automatique : recalcul immédiat.
    expect((await proposeGoal(userId, { automatic: true })).proposal.kcal).toBe(plan({ activityLevel: 4 }));
    await setAutomaticCalories(userId);
    expect((await getProfile(userId))?.goalLocked).toBe(false);
    expect((await getGoalOn(userId))?.kcal).toBe(plan({ activityLevel: 4 }));
  });

  it("refuse un objectif de perte pour un mineur", async () => {
    const userId = await setup();
    await db().update(profiles).set({ birthDate: "2012-01-01" }).where(eq(profiles.userId, userId));
    await expect(updateGoal(userId, { goal: "lose_weight" })).rejects.toThrow("goal_not_allowed");
  });
});
