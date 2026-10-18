import "server-only";

import { and, asc, count, eq, gte, inArray, or } from "drizzle-orm";

import { db } from "@/db/client";
import {
  activities,
  coachMessages,
  dailyCheckins,
  dailySteps,
  foods,
  goals,
  households,
  mealEntries,
  profiles,
  savedMeals,
  type SavedMealItem,
  user,
  waterLogs,
  weightEntries,
} from "@/db/schema";
import { activityKcal } from "@/domain/activity";
import { APP_TIMEZONE } from "@/config/app";
import { todayIso } from "@/domain/dates";
import {
  DEMO_COACH_MESSAGES,
  DEMO_EMAIL,
  DEMO_HOUSEHOLD_NAME,
  DEMO_PROFILE,
  type DemoEntry,
  type DemoFoodRef,
  demoData,
  demoDays,
  demoSlotsBefore,
} from "@/domain/demo";
import { addDays, computePlan } from "@/domain/energy";
import { nutrientsFor } from "@/domain/nutrition";
import { CATALOG_PREFIX } from "@/domain/recipes/catalog";
import { toGrams } from "@/domain/units";

import { deleteUser, insertUserWithPassword, type Tx } from "./accounts";
import { DomainError } from "./errors";
import { getCalorieFloors } from "./settings";

export type DemoAccountStatus = { createdAt: Date } | null;

export async function demoAccountStatus(): Promise<DemoAccountStatus> {
  const [row] = await db().select({ createdAt: user.createdAt }).from(user).where(eq(user.email, DEMO_EMAIL));
  return row ?? null;
}

/**
 * Supprime le compte démo et son foyer. Refuse si ce foyer compte d'autres personnes :
 * l'adresse démo ne doit jamais servir à effacer la famille.
 */
export async function deleteDemoAccount(): Promise<void> {
  const [demo] = await db()
    .select({ id: user.id, householdId: user.householdId })
    .from(user)
    .where(eq(user.email, DEMO_EMAIL));
  if (!demo) return;
  const [row] = await db().select({ n: count() }).from(user).where(eq(user.householdId, demo.householdId));
  if ((row?.n ?? 0) > 1) throw new DomainError("not_found");
  await deleteUser(demo.id);
  await db().delete(households).where(eq(households.id, demo.householdId));
}

/** Mot de passe lisible (« abcd-efgh-jkmn »), sans caractères ambigus. */
function generatePassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const chars = [...bytes].map((byte) => alphabet[byte % alphabet.length]!);
  return [0, 4, 8].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

/**
 * (Re)crée le compte démo : un foyer « Démo » à part, un membre (jamais admin) et quelques
 * semaines d'historique. Renvoie l'adresse et un nouveau mot de passe, à transmettre.
 */
export async function resetDemoAccount(today: string = todayIso()): Promise<{ email: string; password: string }> {
  await deleteDemoAccount();
  const password = generatePassword();
  const floors = await getCalorieFloors();
  const data = demoData(today);

  await db().transaction(async (tx) => {
    const [household] = await tx
      .insert(households)
      .values({ name: DEMO_HOUSEHOLD_NAME })
      .returning({ id: households.id });
    const userId = await insertUserWithPassword(tx, {
      householdId: household!.id,
      role: "member",
      name: DEMO_PROFILE.firstName,
      email: DEMO_EMAIL,
      password,
    });

    const plan = computePlan({
      sex: DEMO_PROFILE.sex,
      birthDate: DEMO_PROFILE.birthDate,
      heightCm: DEMO_PROFILE.heightCm,
      weightKg: DEMO_PROFILE.startWeightKg,
      targetWeightKg: DEMO_PROFILE.targetWeightKg,
      goal: DEMO_PROFILE.goal,
      pace: DEMO_PROFILE.pace,
      activityLevel: DEMO_PROFILE.activityLevel,
      today: data.start,
      floors,
    });
    await tx.insert(profiles).values({
      userId,
      ...DEMO_PROFILE,
      mealTimes: { breakfast: "07:30", lunch: "12:30", dinner: "19:30" },
      disclaimerAcceptedAt: new Date(`${data.start}T08:00:00Z`),
    });
    await tx.insert(goals).values({
      userId,
      effectiveFrom: data.start,
      kcal: plan.kcal,
      proteinG: plan.macros.proteinG,
      carbsG: plan.macros.carbsG,
      fatG: plan.macros.fatG,
      source: "formula",
    });

    const breakfastItems: DemoEntry[] = [
      { date: today, slot: "breakfast", food: { recipe: "porridge-pomme-cannelle" }, quantity: 1, unit: "portion" },
      { date: today, slot: "breakfast", food: { ciqual: "18151" }, quantity: 200, unit: "ml" },
    ];
    const resolve = await foodResolver(
      tx,
      [...data.entries, ...breakfastItems].map((entry) => entry.food),
    );
    const rows = data.entries.flatMap((entry) => {
      const line = resolve(entry);
      return line ? [{ userId, date: entry.date, slot: entry.slot, inputMethod: "manual" as const, ...line }] : [];
    });
    if (rows.length > 0) await tx.insert(mealEntries).values(rows);

    const breakfast = breakfastItems.map(resolve).filter((item) => item !== null);
    if (breakfast.length > 0) {
      await tx.insert(savedMeals).values({
        userId,
        name: "Mon petit-déj de la semaine",
        items: breakfast.map((item): SavedMealItem => ({ ...item, isEstimated: false })),
        usedAt: new Date(),
      });
    }

    if (data.weights.length > 0) await tx.insert(weightEntries).values(data.weights.map((row) => ({ userId, ...row })));
    if (data.water.length > 0) await tx.insert(waterLogs).values(data.water.map((row) => ({ userId, ...row })));
    if (data.checkins.length > 0) {
      await tx.insert(dailyCheckins).values(data.checkins.map((row) => ({ userId, ...row })));
    }
    if (data.activities.length > 0) {
      await tx.insert(activities).values(
        data.activities.map((row) => ({
          userId,
          ...row,
          kcal: activityKcal(row.type, row.intensity, DEMO_PROFILE.startWeightKg, row.durationMin),
        })),
      );
    }
    if (data.steps.length > 0) await tx.insert(dailySteps).values(data.steps.map((row) => ({ userId, ...row })));

    // Conversation tenue l'avant-veille au soir, quelques minutes d'écart entre les messages.
    const chatStart = new Date(`${addDays(today, -2)}T18:40:00Z`).getTime();
    await tx
      .insert(coachMessages)
      .values(
        DEMO_COACH_MESSAGES.map((message, i) => ({ userId, ...message, createdAt: new Date(chatStart + i * 120_000) })),
      );
  });

  return { email: DEMO_EMAIL, password };
}

/**
 * Complète les jours vides du compte démo (aucun repas saisi) depuis le début de son historique
 * jusqu'à aujourd'hui, sans toucher à ce qui existe ni au mot de passe. Aujourd'hui ne reçoit
 * que les repas dont l'heure est passée. Renvoie le nombre de jours remplis.
 */
export async function fillDemoGaps(now: Date = new Date()): Promise<{ days: number }> {
  const [demo] = await db()
    .select({ id: user.id, createdAt: user.createdAt })
    .from(user)
    .where(eq(user.email, DEMO_EMAIL));
  if (!demo) throw new DomainError("not_found");
  const userId = demo.id;
  const today = todayIso(now);
  const [firstGoal] = await db()
    .select({ effectiveFrom: goals.effectiveFrom })
    .from(goals)
    .where(eq(goals.userId, userId))
    .orderBy(asc(goals.effectiveFrom))
    .limit(1);
  const start = firstGoal?.effectiveFrom ?? todayIso(demo.createdAt);

  const logged = await db()
    .selectDistinct({ date: mealEntries.date })
    .from(mealEntries)
    .where(and(eq(mealEntries.userId, userId), gte(mealEntries.date, start)));
  const loggedDates = new Set(logged.map((row) => row.date));
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  const data = demoDays({ start, from: start, today, todaySlots: demoSlotsBefore(time) });
  const empty = (row: { date: string }) => !loggedDates.has(row.date);
  const entries = data.entries.filter(empty);
  const days = new Set(entries.map((entry) => entry.date));
  if (days.size === 0) return { days: 0 };
  const isFilled = (row: { date: string }) => days.has(row.date);

  await db().transaction(async (tx) => {
    const resolve = await foodResolver(
      tx,
      entries.map((entry) => entry.food),
    );
    const rows = entries.flatMap((entry) => {
      const line = resolve(entry);
      return line ? [{ userId, date: entry.date, slot: entry.slot, inputMethod: "manual" as const, ...line }] : [];
    });
    if (rows.length > 0) await tx.insert(mealEntries).values(rows);

    // Pesées, eau, ressenti et pas : une ligne par jour au plus, celle qui existe est gardée.
    const weights = data.weights.filter(isFilled);
    if (weights.length > 0) {
      await tx
        .insert(weightEntries)
        .values(weights.map((row) => ({ userId, ...row })))
        .onConflictDoNothing();
    }
    const water = data.water.filter(isFilled);
    if (water.length > 0) {
      await tx
        .insert(waterLogs)
        .values(water.map((row) => ({ userId, ...row })))
        .onConflictDoNothing();
    }
    const checkins = data.checkins.filter(isFilled);
    if (checkins.length > 0) {
      await tx
        .insert(dailyCheckins)
        .values(checkins.map((row) => ({ userId, ...row })))
        .onConflictDoNothing();
    }
    const steps = data.steps.filter(isFilled);
    if (steps.length > 0) {
      await tx
        .insert(dailySteps)
        .values(steps.map((row) => ({ userId, ...row })))
        .onConflictDoNothing();
    }
    const existing = await tx
      .selectDistinct({ date: activities.date })
      .from(activities)
      .where(and(eq(activities.userId, userId), inArray(activities.date, [...days])));
    const withActivity = new Set(existing.map((row) => row.date));
    const newActivities = data.activities.filter((row) => isFilled(row) && !withActivity.has(row.date));
    if (newActivities.length > 0) {
      await tx.insert(activities).values(
        newActivities.map((row) => ({
          userId,
          ...row,
          kcal: activityKcal(row.type, row.intensity, DEMO_PROFILE.startWeightKg, row.durationMin),
        })),
      );
    }
  });

  return { days: days.size };
}

/** Charge en une requête les aliments utilisés par la démo et renvoie de quoi figer une ligne. */
async function foodResolver(tx: Tx, refs: DemoFoodRef[]) {
  const recipeRefs = [...new Set(refs.flatMap((ref) => ("recipe" in ref ? [`${CATALOG_PREFIX}${ref.recipe}`] : [])))];
  const ciqualRefs = [...new Set(refs.flatMap((ref) => ("ciqual" in ref ? [ref.ciqual] : [])))];
  const rows = await tx
    .select({
      id: foods.id,
      source: foods.source,
      sourceRef: foods.sourceRef,
      nameFr: foods.nameFr,
      kcal: foods.kcal,
      proteinG: foods.proteinG,
      carbsG: foods.carbsG,
      fatG: foods.fatG,
      densityGPerMl: foods.densityGPerMl,
      unitWeights: foods.unitWeights,
    })
    .from(foods)
    .where(
      or(
        and(eq(foods.source, "recipe"), inArray(foods.sourceRef, recipeRefs)),
        and(eq(foods.source, "ciqual"), inArray(foods.sourceRef, ciqualRefs)),
      ),
    );
  const byKey = new Map(rows.map((row) => [`${row.source}:${row.sourceRef}`, row]));

  return (entry: Pick<DemoEntry, "food" | "quantity" | "unit">) => {
    const food = byKey.get(foodKey(entry.food));
    if (!food) return null;
    const grams = toGrams(entry.quantity, entry.unit, food);
    if (grams === null) return null;
    return {
      foodId: food.id,
      label: food.nameFr,
      quantity: entry.quantity,
      unit: entry.unit,
      grams: Math.round(grams * 10) / 10,
      ...nutrientsFor(food, grams),
    };
  };
}

function foodKey(ref: DemoFoodRef): string {
  return "recipe" in ref ? `recipe:${CATALOG_PREFIX}${ref.recipe}` : `ciqual:${ref.ciqual}`;
}
