import "server-only";

import { and, asc, desc, eq, gte, lte, sum } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { goals, largerDays, mealEntries, metabolismChecks, profiles, weightEntries } from "@/db/schema";
import { adaptGoal, type Measurement, type MissingData, measureExpenditure, WINDOW_DAYS } from "@/domain/adaptive";
import { todayIso } from "@/domain/dates";
import { addDays, computePlan, macrosFor } from "@/domain/energy";
import { type ActivityLevel, BUDGET_MODES, type BudgetMode } from "@/domain/profile";
import { isoWeekStart } from "@/domain/streak";
import { type WeekBudget, weekDates, weeklyBudget } from "@/domain/weekly-budget";
import { weightTrend } from "@/domain/weight-trend";

import { DomainError } from "./errors";
import { getGoalOn, getProfile } from "./profile";
import { getCalorieFloors } from "./settings";

type Profile = NonNullable<Awaited<ReturnType<typeof getProfile>>>;
type Goal = NonNullable<Awaited<ReturnType<typeof getGoalOn>>>;

/** Calories saisies par jour sur [from, to]. */
async function intakesBetween(userId: string, from: string, to: string): Promise<Map<string, number>> {
  const rows = await db()
    .select({ date: mealEntries.date, kcal: sum(mealEntries.kcal).mapWith(Number) })
    .from(mealEntries)
    .where(and(eq(mealEntries.userId, userId), gte(mealEntries.date, from), lte(mealEntries.date, to)))
    .groupBy(mealEntries.date);
  return new Map(rows.map((row) => [row.date, row.kcal]));
}

async function weighInsUntil(userId: string, to: string) {
  return db()
    .select({ date: weightEntries.date, weightKg: weightEntries.weightKg })
    .from(weightEntries)
    .where(and(eq(weightEntries.userId, userId), lte(weightEntries.date, to)))
    .orderBy(asc(weightEntries.date));
}

/** Premier jour d'utilisation : le premier objectif enregistré (fin de l'onboarding). */
async function firstDay(userId: string): Promise<string | null> {
  const [row] = await db()
    .select({ date: goals.effectiveFrom })
    .from(goals)
    .where(eq(goals.userId, userId))
    .orderBy(asc(goals.effectiveFrom))
    .limit(1);
  return row?.date ?? null;
}

/** Dépense estimée par la formule, pour un poids donné. */
async function estimatedTdee(profile: Profile, weightKg: number, on: string): Promise<number> {
  return computePlan({
    sex: profile.sex,
    birthDate: profile.birthDate,
    heightCm: profile.heightCm,
    weightKg,
    goal: "maintain",
    pace: profile.pace,
    activityLevel: profile.activityLevel,
    today: on,
    floors: await getCalorieFloors(),
  }).tdee;
}

type Context = {
  profile: Profile;
  goal: Goal;
  measurement: Measurement;
  /** Poids de tendance actuel (ou poids de départ sans pesée). */
  weightKg: number;
  estimatedTdee: number;
  startTdee: number;
  start: string;
};

async function context(userId: string, today: string): Promise<Context | null> {
  const [profile, goal, start] = await Promise.all([getProfile(userId), getGoalOn(userId, today), firstDay(userId)]);
  if (!profile || !goal || !start) return null;
  const yesterday = addDays(today, -1);
  const [intakes, weighIns] = await Promise.all([
    intakesBetween(userId, addDays(today, -WINDOW_DAYS), yesterday),
    weighInsUntil(userId, yesterday),
  ]);
  const weightKg = weightTrend(weighIns).at(-1)?.trendKg ?? profile.startWeightKg;
  return {
    profile,
    goal,
    measurement: measureExpenditure({ today, firstDay: start, intakes, weighIns }),
    weightKg,
    estimatedTdee: await estimatedTdee(profile, weightKg, today),
    startTdee: await estimatedTdee(profile, profile.startWeightKg, start),
    start,
  };
}

/**
 * Bilan de la semaine, fait une seule fois par semaine (au premier passage à partir du lundi) :
 * mesure la dépense réelle et, si les données suffisent et que l'objectif n'est pas figé,
 * rapproche l'objectif de la nouvelle cible (±150 kcal au plus). Idempotent.
 */
export async function ensureWeeklyCheck(userId: string, today: string = todayIso()): Promise<void> {
  const weekStart = isoWeekStart(today);
  const [existing] = await db()
    .select({ weekStart: metabolismChecks.weekStart })
    .from(metabolismChecks)
    .where(and(eq(metabolismChecks.userId, userId), eq(metabolismChecks.weekStart, weekStart)));
  if (existing) return;
  const ctx = await context(userId, today);
  if (!ctx) return;
  const { profile, goal, measurement } = ctx;

  let kcalAfter = goal.kcal;
  let status: (typeof metabolismChecks.$inferInsert)["status"];
  if (measurement.status !== "measured") {
    status = measurement.status;
  } else if (profile.goalLocked) {
    status = "locked";
  } else {
    kcalAfter = adaptGoal({
      currentKcal: goal.kcal,
      measuredTdee: measurement.tdee,
      goal: profile.goal,
      pace: profile.pace,
      sex: profile.sex,
      weightKg: ctx.weightKg,
      floors: await getCalorieFloors(),
    }).kcal;
    status = kcalAfter === goal.kcal ? "unchanged" : "adjusted";
  }

  await db().transaction(async (tx) => {
    const inserted = await tx
      .insert(metabolismChecks)
      .values({
        userId,
        weekStart,
        status,
        estimatedTdee: ctx.estimatedTdee,
        measuredTdee: measurement.status === "insufficient" ? null : measurement.tdee,
        kcalBefore: goal.kcal,
        kcalAfter,
        missing: measurement.status === "insufficient" ? measurement.missing : null,
      })
      .onConflictDoNothing()
      .returning({ weekStart: metabolismChecks.weekStart });
    // Un autre onglet a fait le bilan en même temps : on ne touche pas à l'objectif.
    if (inserted.length === 0 || status !== "adjusted") return;
    const values = {
      kcal: kcalAfter,
      ...macrosFor(kcalAfter, { goal: profile.goal, weightKg: ctx.weightKg, heightCm: profile.heightCm }),
      source: "adaptive" as const,
    };
    await tx
      .insert(goals)
      .values({ userId, effectiveFrom: today, ...values })
      .onConflictDoUpdate({ target: [goals.userId, goals.effectiveFrom], set: values });
  });
}

/**
 * Contexte du calcul de l'objectif (profil, dépense mesurée et estimée, poids de tendance) ;
 * `activityLevel` remplace celui du profil pour la dépense estimée.
 */
export async function goalContext(userId: string, today: string = todayIso(), activityLevel?: ActivityLevel) {
  const ctx = await context(userId, today);
  if (!ctx || !activityLevel || activityLevel === ctx.profile.activityLevel) return ctx;
  return { ...ctx, estimatedTdee: await estimatedTdee({ ...ctx.profile, activityLevel }, ctx.weightKg, today) };
}

export type MetabolismOverview = {
  /** Dépense estimée par la formule au départ, puis avec le poids de tendance actuel. */
  startTdee: number;
  estimatedTdee: number;
  measurement: Measurement;
  goalKcal: number;
  goalSource: Goal["source"];
  goalLocked: boolean;
  history: {
    weekStart: string;
    status: (typeof metabolismChecks.$inferSelect)["status"];
    estimatedTdee: number;
    measuredTdee: number | null;
    kcalBefore: number;
    kcalAfter: number;
    missing: MissingData | null;
  }[];
};

/** Données de l'écran « Mon métabolisme ». */
export async function metabolismOverview(
  userId: string,
  today: string = todayIso(),
): Promise<MetabolismOverview | null> {
  const ctx = await context(userId, today);
  if (!ctx) return null;
  const history = await db()
    .select({
      weekStart: metabolismChecks.weekStart,
      status: metabolismChecks.status,
      estimatedTdee: metabolismChecks.estimatedTdee,
      measuredTdee: metabolismChecks.measuredTdee,
      kcalBefore: metabolismChecks.kcalBefore,
      kcalAfter: metabolismChecks.kcalAfter,
      missing: metabolismChecks.missing,
    })
    .from(metabolismChecks)
    .where(eq(metabolismChecks.userId, userId))
    .orderBy(desc(metabolismChecks.weekStart))
    .limit(26);
  return {
    startTdee: ctx.startTdee,
    estimatedTdee: ctx.estimatedTdee,
    measurement: ctx.measurement,
    goalKcal: ctx.goal.kcal,
    goalSource: ctx.goal.source,
    goalLocked: ctx.profile.goalLocked,
    history: history.reverse(),
  };
}

export async function setGoalLocked(userId: string, locked: boolean): Promise<void> {
  await db()
    .update(profiles)
    .set({ goalLocked: z.boolean().parse(locked), updatedAt: new Date() })
    .where(eq(profiles.userId, userId));
}

export async function setBudgetMode(userId: string, mode: BudgetMode): Promise<void> {
  await db()
    .update(profiles)
    .set({ budgetMode: z.enum(BUDGET_MODES).parse(mode), updatedAt: new Date() })
    .where(eq(profiles.userId, userId));
}

/** Jours plus larges : seulement aujourd'hui ou à venir, dans les 8 semaines. */
export async function setLargerDay(userId: string, date: string, larger: boolean): Promise<void> {
  const day = z.iso.date().parse(date);
  const today = todayIso();
  if (day < today || day > addDays(today, 56)) throw new DomainError("larger_day_range");
  if (larger) {
    await db().insert(largerDays).values({ userId, date: day }).onConflictDoNothing();
  } else {
    await db()
      .delete(largerDays)
      .where(and(eq(largerDays.userId, userId), eq(largerDays.date, day)));
  }
}

/** Budget de la semaine qui contient `date`, tel qu'il se présente ce jour-là. */
export async function weekBudget(userId: string, date: string = todayIso()): Promise<WeekBudget | null> {
  const [profile, goal, floors] = await Promise.all([getProfile(userId), getGoalOn(userId, date), getCalorieFloors()]);
  if (!profile || !goal) return null;
  const dates = weekDates(isoWeekStart(date));
  const [consumed, larger] = await Promise.all([
    intakesBetween(userId, dates[0]!, dates[6]!),
    db()
      .select({ date: largerDays.date })
      .from(largerDays)
      .where(and(eq(largerDays.userId, userId), gte(largerDays.date, dates[0]!), lte(largerDays.date, dates[6]!))),
  ]);
  return weeklyBudget({
    today: date,
    dailyKcal: goal.kcal,
    floor: floors[profile.sex],
    consumed,
    largerDays: new Set(larger.map((row) => row.date)),
  });
}

export type DayGoal = { kcal: number; proteinG: number; carbsG: number; fatG: number };

/**
 * Objectif d'un jour : l'objectif quotidien, ou en budget hebdomadaire celui recalculé
 * pour ce jour. Les protéines restent fixes ; glucides et lipides suivent l'écart.
 */
export async function dayGoal(userId: string, date: string, budgetMode: BudgetMode): Promise<DayGoal | null> {
  const goal = await getGoalOn(userId, date);
  if (!goal) return null;
  const base = { kcal: goal.kcal, proteinG: goal.proteinG, carbsG: goal.carbsG, fatG: goal.fatG };
  if (budgetMode !== "weekly") return base;
  const week = await weekBudget(userId, date);
  if (!week || week.todayKcal === goal.kcal) return base;
  const rest = goal.kcal - goal.proteinG * 4;
  const ratio = rest > 0 ? Math.max(0, week.todayKcal - goal.proteinG * 4) / rest : 1;
  return {
    kcal: week.todayKcal,
    proteinG: goal.proteinG,
    carbsG: Math.round(goal.carbsG * ratio),
    fatG: Math.round(goal.fatG * ratio),
  };
}

/** Pour l'export : bilans et jours plus larges. */
export async function adaptiveExport(userId: string) {
  const [checks, larger] = await Promise.all([
    db().select().from(metabolismChecks).where(eq(metabolismChecks.userId, userId)).orderBy(metabolismChecks.weekStart),
    db().select().from(largerDays).where(eq(largerDays.userId, userId)).orderBy(largerDays.date),
  ]);
  return { checks, larger };
}
