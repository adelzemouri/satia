import { eq } from "drizzle-orm";
import { strFromU8, unzipSync } from "fflate";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db/client";
import { user } from "@/db/schema";
import type { OnboardingInput } from "@/features/onboarding/schema";
import { setupFirstAdmin } from "@/server/accounts";
import { collectUserData, toCsvZip } from "@/server/data-export";
import { getGoalOn, getProfile, saveOnboarding } from "@/server/profile";
import { setCalorieFloors } from "@/server/settings";

import { resetDatabase } from "./helpers";

const answers: OnboardingInput = {
  firstName: "Adel",
  sex: "male",
  birthDate: "1988-04-12",
  heightCm: 178,
  weightKg: 82,
  goal: "lose_weight",
  targetWeightKg: 76,
  activityLevel: 2,
  pace: "gentle",
  diet: "no_pork",
  foodsToAvoid: "coriandre",
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
  return row!;
}

describe("onboarding et données", () => {
  beforeEach(resetDatabase);

  it("enregistre le profil et l'objectif calculé", async () => {
    const owner = await setup();
    const plan = await saveOnboarding(owner.id, answers);
    const profile = await getProfile(owner.id);
    expect(profile?.startWeightKg).toBe(82);
    expect(profile?.diet).toBe("no_pork");
    const goal = await getGoalOn(owner.id);
    expect(goal?.kcal).toBe(plan.kcal);
    expect(goal?.source).toBe("formula");
  });

  it("refaire l'onboarding le même jour remplace l'objectif du jour", async () => {
    const owner = await setup();
    await saveOnboarding(owner.id, answers);
    await saveOnboarding(owner.id, { ...answers, goal: "maintain", targetWeightKg: null });
    const goal = await getGoalOn(owner.id);
    expect((await getProfile(owner.id))?.goal).toBe("maintain");
    expect(goal?.kcal).toBeGreaterThan(2000);
  });

  it("applique les planchers configurés par l'admin", async () => {
    const owner = await setup();
    await setCalorieFloors({ female: 1200, male: 2600 });
    const plan = await saveOnboarding(owner.id, answers);
    expect(plan.kcal).toBe(2600);
    expect(plan.notices).toContain("floor_applied");
  });

  it("refuse des réponses invalides", async () => {
    const owner = await setup();
    await expect(saveOnboarding(owner.id, { ...answers, targetWeightKg: 90 })).rejects.toThrow();
    await expect(saveOnboarding(owner.id, { ...answers, birthDate: "2012-01-01" })).rejects.toThrow();
  });

  it("exporte toutes les données sans aucun secret", async () => {
    const owner = await setup();
    await saveOnboarding(owner.id, answers);
    const data = await collectUserData(owner.id);
    expect(data.account?.email).toBe("adel@example.com");
    expect(data.profile?.firstName).toBe("Adel");
    expect(data.goals).toHaveLength(1);
    const json = JSON.stringify(data);
    expect(json).not.toMatch(/argon2|password|secret|token/i);

    const files = unzipSync(toCsvZip(data));
    expect(Object.keys(files).sort()).toEqual([
      "account.csv",
      "activities.csv",
      "ai-calls.csv",
      "checkins.csv",
      "coach-messages.csv",
      "coach-reviews.csv",
      "containers.csv",
      "corrections.csv",
      "custom-exercises.csv",
      "expressions.csv",
      "fasting-plan.csv",
      "fasts.csv",
      "favorites.csv",
      "foods.csv",
      "goals.csv",
      "larger-days.csv",
      "meal-photos.csv",
      "meals.csv",
      "measurements.csv",
      "metabolism-checks.csv",
      "profile.csv",
      "progress-photos.csv",
      "push-devices.csv",
      "recipe-items.csv",
      "saved-meals.csv",
      "shared-meals.csv",
      "steps.csv",
      "training-profile.csv",
      "training-sessions.csv",
      "treatment-logs.csv",
      "treatments.csv",
      "water.csv",
      "weights.csv",
    ]);
    expect(strFromU8(files["profile.csv"]!)).toContain("coriandre");
  });
});
