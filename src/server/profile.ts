import "server-only";

import { and, desc, eq, lte } from "drizzle-orm";

import { db } from "@/db/client";
import { goals, profiles } from "@/db/schema";
import { todayIso } from "@/domain/dates";
import { checkTargetWeight, computePlan, type Plan } from "@/domain/energy";
import { goalChangesWeight } from "@/domain/profile";
import { type OnboardingInput, onboardingSchema } from "@/features/onboarding/schema";

import { DomainError } from "./errors";
import { latestWeight } from "./journal";
import { getCalorieFloors } from "./settings";

export async function getProfile(userId: string) {
  const [row] = await db().select().from(profiles).where(eq(profiles.userId, userId));
  return row ?? null;
}

/** Objectif en vigueur à une date donnée. */
export async function getGoalOn(userId: string, date: string = todayIso()) {
  const [row] = await db()
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), lte(goals.effectiveFrom, date)))
    .orderBy(desc(goals.effectiveFrom))
    .limit(1);
  return row ?? null;
}

/** Calcule le plan sans rien enregistrer (aperçu de l'écran de synthèse). */
export async function previewPlan(input: OnboardingInput): Promise<Plan> {
  const data = onboardingSchema.parse(input);
  return computePlan({ ...toPlanInput(data), floors: await getCalorieFloors() });
}

function toPlanInput(data: OnboardingInput) {
  return {
    sex: data.sex,
    birthDate: data.birthDate,
    heightCm: data.heightCm,
    weightKg: data.weightKg,
    targetWeightKg: goalChangesWeight(data.goal) ? data.targetWeightKg : null,
    goal: data.goal,
    pace: data.pace,
    activityLevel: data.activityLevel,
    today: todayIso(),
  };
}

/** Enregistre le profil et l'objectif initial calculé. Recalcule s'il est refait le même jour. */
export async function saveOnboarding(userId: string, input: OnboardingInput): Promise<Plan> {
  const data = onboardingSchema.parse(input);
  const today = todayIso();
  const plan = computePlan({ ...toPlanInput(data), floors: await getCalorieFloors() });

  const profile = {
    firstName: data.firstName,
    sex: data.sex,
    birthDate: data.birthDate,
    heightCm: data.heightCm,
    startWeightKg: data.weightKg,
    targetWeightKg: goalChangesWeight(data.goal) ? data.targetWeightKg : null,
    goal: data.goal,
    activityLevel: data.activityLevel,
    pace: data.pace,
    diet: data.diet,
    foodsToAvoid: data.foodsToAvoid,
    mealTimes: data.mealTimes,
    budgetMode: data.budgetMode,
    disclaimerAcceptedAt: new Date(),
    updatedAt: new Date(),
  };
  const goal = {
    kcal: plan.kcal,
    proteinG: plan.macros.proteinG,
    carbsG: plan.macros.carbsG,
    fatG: plan.macros.fatG,
    source: "formula" as const,
  };

  await db().transaction(async (tx) => {
    await tx
      .insert(profiles)
      .values({ userId, ...profile })
      .onConflictDoUpdate({ target: profiles.userId, set: profile });
    await tx
      .insert(goals)
      .values({ userId, effectiveFrom: today, ...goal })
      .onConflictDoUpdate({ target: [goals.userId, goals.effectiveFrom], set: goal });
  });
  return plan;
}

/**
 * Change le poids visé après l'inscription, avec les mêmes garde-fous : dans le sens de
 * l'objectif et pas sous un poids santé. Vide = pas de poids visé. Les calories n'en dépendent pas.
 */
export async function setTargetWeight(userId: string, targetWeightKg: number | null): Promise<void> {
  const profile = await getProfile(userId);
  if (!profile) throw new DomainError("not_found");
  if (!goalChangesWeight(profile.goal)) throw new DomainError("goal_not_allowed");
  if (targetWeightKg !== null) {
    if (!Number.isFinite(targetWeightKg) || targetWeightKg < 30 || targetWeightKg > 300) {
      throw new DomainError("weight_range");
    }
    const current = (await latestWeight(userId)) ?? profile.startWeightKg;
    const issue = checkTargetWeight(profile.goal, current, profile.heightCm, targetWeightKg);
    if (issue) throw new DomainError(issue);
  }
  await db()
    .update(profiles)
    .set({
      targetWeightKg: targetWeightKg === null ? null : Math.round(targetWeightKg * 10) / 10,
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, userId));
}
