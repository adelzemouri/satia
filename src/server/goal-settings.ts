import "server-only";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { goals, profiles } from "@/db/schema";
import { todayIso } from "@/domain/dates";
import { checkTargetWeight, macrosFor, targetFromTdee } from "@/domain/energy";
import {
  ACTIVITY_LEVELS,
  type ActivityLevel,
  allowedGoals,
  type Goal,
  GOALS,
  type Pace,
  PACES,
} from "@/domain/profile";

import { goalContext } from "./adaptive";
import { DomainError } from "./errors";
import { latestWeight } from "./journal";
import { getCalorieFloors } from "./settings";

/** Au-delà, un objectif choisi à la main n'a plus de sens au quotidien. */
export const MAX_MANUAL_KCAL = 5000;

export type GoalChange = {
  goal?: Goal;
  pace?: Pace;
  activityLevel?: ActivityLevel;
  /** Aperçu du retour au calcul automatique : ignore un objectif choisi à la main. */
  automatic?: boolean;
};

const changeSchema = z.object({
  goal: z.enum(GOALS).optional(),
  pace: z.enum(PACES).optional(),
  activityLevel: z.union(ACTIVITY_LEVELS.map((level) => z.literal(level))).optional(),
  automatic: z.boolean().optional(),
});

export type GoalProposal = {
  /** Objectif calorique après le changement (inchangé s'il est choisi à la main). */
  kcal: number;
  currentKcal: number;
  /** Calculé sur la dépense mesurée plutôt que sur la formule. */
  measured: boolean;
  /** Objectif choisi à la main : le changement ne touche pas aux calories. */
  locked: boolean;
};

/**
 * Objectif calorique qu'entraînerait un changement d'objectif, de rythme ou d'activité : à
 * partir de la dépense mesurée quand le bilan du lundi a assez de données (l'activité ne compte
 * alors plus), sinon de la formule. Même déficit, surplus, plafond de perte et plancher qu'au départ.
 */
export async function proposeGoal(userId: string, input: GoalChange, today: string = todayIso()) {
  const { automatic, ...change } = changeSchema.parse(input);
  const ctx = await goalContext(userId, today, change.activityLevel);
  if (!ctx) throw new DomainError("not_found");
  const profile = { ...ctx.profile, ...change };
  if (!allowedGoals(profile.birthDate, today).includes(profile.goal)) throw new DomainError("goal_not_allowed");
  const measured = ctx.measurement.status === "measured";
  const tdee = ctx.measurement.status === "measured" ? ctx.measurement.tdee : ctx.estimatedTdee;
  const target = targetFromTdee(tdee, { ...profile, weightKg: ctx.weightKg }, await getCalorieFloors()).target;
  const locked = profile.goalLocked && !automatic;
  const kcal = locked ? ctx.goal.kcal : Math.round(target / 10) * 10;
  const proposal: GoalProposal = { kcal, currentKcal: ctx.goal.kcal, measured, locked };
  return { proposal, profile, weightKg: ctx.weightKg };
}

/**
 * Enregistre un nouvel objectif (perdre, maintenir…), son rythme ou le niveau d'activité, et
 * recalcule l'objectif calorique dès aujourd'hui, sauf s'il est choisi à la main. Un poids visé
 * qui ne va plus dans le sens de l'objectif est retiré.
 */
export async function updateGoal(userId: string, input: GoalChange, today: string = todayIso()): Promise<void> {
  const { proposal, profile, weightKg } = await proposeGoal(userId, { ...input, automatic: false }, today);
  const current = (await latestWeight(userId)) ?? profile.startWeightKg;
  const target = profile.targetWeightKg;
  const keepTarget =
    target !== null &&
    (profile.goal === "lose_weight" || profile.goal === "gain_muscle") &&
    !checkTargetWeight(profile.goal, current, profile.heightCm, target);

  await db().transaction(async (tx) => {
    await tx
      .update(profiles)
      .set({
        goal: profile.goal,
        pace: profile.pace,
        activityLevel: profile.activityLevel,
        targetWeightKg: keepTarget ? target : null,
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, userId));
    if (proposal.locked) return;
    const values = {
      kcal: proposal.kcal,
      ...macrosFor(proposal.kcal, { goal: profile.goal, weightKg, heightCm: profile.heightCm }),
      source: proposal.measured ? ("adaptive" as const) : ("formula" as const),
    };
    await tx
      .insert(goals)
      .values({ userId, effectiveFrom: today, ...values })
      .onConflictDoUpdate({ target: [goals.userId, goals.effectiveFrom], set: values });
  });
}

/**
 * Calories choisies à la main : jamais sous le plancher. L'objectif est alors figé, le bilan
 * du lundi ne le change plus.
 */
export async function setManualCalories(userId: string, kcal: number, today: string = todayIso()): Promise<void> {
  const ctx = await goalContext(userId, today);
  if (!ctx) throw new DomainError("not_found");
  const floor = (await getCalorieFloors())[ctx.profile.sex];
  const value = z
    .number()
    .int()
    .parse(Math.round(kcal / 10) * 10);
  if (value < floor) throw new DomainError("below_floor");
  if (value > MAX_MANUAL_KCAL) throw new DomainError("kcal_range");
  const values = {
    kcal: value,
    ...macrosFor(value, { goal: ctx.profile.goal, weightKg: ctx.weightKg, heightCm: ctx.profile.heightCm }),
    source: "manual" as const,
  };
  await db().transaction(async (tx) => {
    await tx.update(profiles).set({ goalLocked: true, updatedAt: new Date() }).where(eq(profiles.userId, userId));
    await tx
      .insert(goals)
      .values({ userId, effectiveFrom: today, ...values })
      .onConflictDoUpdate({ target: [goals.userId, goals.effectiveFrom], set: values });
  });
}

/** Retour au calcul automatique : l'objectif est recalculé tout de suite, puis suivi chaque lundi. */
export async function setAutomaticCalories(userId: string, today: string = todayIso()): Promise<void> {
  await db().update(profiles).set({ goalLocked: false, updatedAt: new Date() }).where(eq(profiles.userId, userId));
  await updateGoal(userId, {}, today);
}
