import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db/client";
import { goals, mealEntries, metabolismChecks, user, weightEntries } from "@/db/schema";
import { todayIso } from "@/domain/dates";
import { addDays } from "@/domain/energy";
import { isoWeekStart } from "@/domain/streak";
import type { OnboardingInput } from "@/features/onboarding/schema";
import { setupFirstAdmin } from "@/server/accounts";
import {
  dayGoal,
  ensureWeeklyCheck,
  metabolismOverview,
  setBudgetMode,
  setGoalLocked,
  setLargerDay,
  weekBudget,
} from "@/server/adaptive";
import { collectUserData } from "@/server/data-export";
import { getGoalOn, saveOnboarding } from "@/server/profile";

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

function entry(userId: string, date: string, kcal: number) {
  return {
    userId,
    date,
    slot: "lunch" as const,
    label: "Repas",
    quantity: 1,
    unit: "g" as const,
    grams: 100,
    kcal,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    inputMethod: "manual" as const,
  };
}

/** Un mois de suivi : 2 600 kcal par jour, poids stable à 82 kg (dépense réelle ≈ 2 600). */
async function monthOfTracking(userId: string) {
  const start = addDays(today, -35);
  await db().update(goals).set({ effectiveFrom: start }).where(eq(goals.userId, userId));
  const dates = Array.from({ length: 35 }, (_, index) => addDays(start, index));
  await db()
    .insert(mealEntries)
    .values(dates.map((date) => entry(userId, date, 2600)));
  await db()
    .insert(weightEntries)
    .values(dates.filter((_, index) => index % 3 === 0).map((date) => ({ userId, date, weightKg: 82 })));
}

describe("objectif adaptatif", () => {
  beforeEach(resetDatabase);

  it("attend assez de données et explique ce qui manque, sans toucher à l'objectif", async () => {
    const userId = await setupUser();
    const before = await getGoalOn(userId, today);
    await ensureWeeklyCheck(userId, today);
    const [check] = await db().select().from(metabolismChecks).where(eq(metabolismChecks.userId, userId));
    expect(check).toMatchObject({
      status: "insufficient",
      weekStart: isoWeekStart(today),
      kcalBefore: before!.kcal,
      kcalAfter: before!.kcal,
      missing: { days: 14, weighIns: 3 },
    });
    const overview = await metabolismOverview(userId, today);
    expect(overview?.measurement.status).toBe("insufficient");
    expect(overview?.goalSource).toBe("formula");
    // Le bilan garde ce qui manquait, pour l'afficher dans la liste des bilans.
    expect(overview?.history[0]?.missing).toMatchObject({ days: 14, weighIns: 3 });
  });

  it("ajuste l'objectif d'au plus 150 kcal, une seule fois par semaine", async () => {
    const userId = await setupUser();
    await monthOfTracking(userId);
    const before = (await getGoalOn(userId, today))!;

    await ensureWeeklyCheck(userId, today);
    await ensureWeeklyCheck(userId, today);
    const checks = await db().select().from(metabolismChecks).where(eq(metabolismChecks.userId, userId));
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ status: "adjusted", measuredTdee: 2600, kcalBefore: before.kcal });

    // Dépense mesurée 2 600 → cible ≈ 2 330 ; l'objectif de départ est plus bas, il monte de 150.
    const after = (await getGoalOn(userId, today))!;
    expect(after.source).toBe("adaptive");
    expect(after.kcal).toBe(before.kcal + 150);
    expect(after.proteinG).toBe(before.proteinG);
    const overview = await metabolismOverview(userId, today);
    expect(overview).toMatchObject({ goalKcal: after.kcal, goalSource: "adaptive", goalLocked: false });
    expect(overview?.history).toHaveLength(1);
  });

  it("un objectif figé n'est plus modifié", async () => {
    const userId = await setupUser();
    await monthOfTracking(userId);
    const before = (await getGoalOn(userId, today))!;
    await setGoalLocked(userId, true);
    await ensureWeeklyCheck(userId, today);
    const [check] = await db().select().from(metabolismChecks).where(eq(metabolismChecks.userId, userId));
    expect(check).toMatchObject({ status: "locked", measuredTdee: 2600, kcalAfter: before.kcal });
    expect((await getGoalOn(userId, today))!.kcal).toBe(before.kcal);
  });
});

describe("budget hebdomadaire", () => {
  beforeEach(resetDatabase);

  it("recalcule l'objectif du jour selon la semaine et les jours plus larges", async () => {
    const userId = await setupUser();
    const goal = (await getGoalOn(userId, today))!;
    expect(await dayGoal(userId, today, "daily")).toMatchObject({ kcal: goal.kcal });

    await setBudgetMode(userId, "weekly");
    const sunday = addDays(isoWeekStart(today), 6);
    await setLargerDay(userId, sunday, true);
    const week = (await weekBudget(userId, today))!;
    expect(week.total).toBe(goal.kcal * 7);
    expect(week.days.find((day) => day.date === sunday)).toMatchObject({ larger: true });

    if (today !== sunday) {
      // Un jour plus large dimanche : les autres jours ont un peu moins.
      const adjusted = (await dayGoal(userId, today, "weekly"))!;
      expect(adjusted.kcal).toBeLessThan(goal.kcal);
      expect(adjusted.proteinG).toBe(goal.proteinG);
      expect(adjusted.carbsG).toBeLessThan(goal.carbsG);
    }

    await setLargerDay(userId, sunday, false);
    expect((await weekBudget(userId, today))!.days.every((day) => !day.larger)).toBe(true);
    await expect(setLargerDay(userId, addDays(today, -1), true)).rejects.toMatchObject({
      code: "larger_day_range",
    });
  });

  it("exporte les bilans et les jours plus larges", async () => {
    const userId = await setupUser();
    await ensureWeeklyCheck(userId, today);
    await setLargerDay(userId, addDays(today, 3), true);
    const data = await collectUserData(userId);
    expect(data.metabolismChecks).toHaveLength(1);
    expect(data.largerDays).toEqual([{ userId, date: addDays(today, 3) }]);
  });
});
