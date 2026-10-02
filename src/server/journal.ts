import "server-only";

import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { MEAL_SLOTS, mealEntries, type MealSlot, profiles, waterLogs, weightEntries } from "@/db/schema";
import { todayIso } from "@/domain/dates";
import { addDays, computePlan } from "@/domain/energy";
import { energyZone, type EnergyZone, type Nutrients, nutrientsFor, sumNutrients } from "@/domain/nutrition";
import { computeStreak, type Streak } from "@/domain/streak";
import { UNITS, toGrams } from "@/domain/units";
import { projectGoalDate, type TrendPoint, weeklyChangeKg, weightTrend } from "@/domain/weight-trend";

import { DomainError } from "./errors";
import { getFood, per100 } from "./foods";
import { getGoalOn, getProfile } from "./profile";
import { getCalorieFloors } from "./settings";

export type MealEntry = typeof mealEntries.$inferSelect;

const isoDate = z.iso.date();

/** On ne saisit pas dans le futur ; les jours passés restent modifiables. */
function assertNotFuture(date: string) {
  if (date > todayIso()) throw new DomainError("future_date");
}

export const entrySchema = z.object({
  date: isoDate,
  slot: z.enum(MEAL_SLOTS),
  foodId: z.uuid(),
  quantity: z.number().positive().max(100_000),
  unit: z.enum(UNITS),
});
export type EntryInput = z.input<typeof entrySchema>;

/** Calcule les grammes et les valeurs figées d'une ligne à partir de l'aliment. */
async function resolveEntry(userId: string, foodId: string, quantity: number, unit: (typeof UNITS)[number]) {
  const food = await getFood(userId, foodId);
  const grams = toGrams(quantity, unit, food);
  if (grams === null) throw new DomainError("unit_not_available");
  if (grams > 10_000) throw new DomainError("quantity_too_large");
  return { food, grams: Math.round(grams * 10) / 10, nutrients: nutrientsFor(per100(food), grams) };
}

export async function addEntry(userId: string, input: EntryInput): Promise<string> {
  const data = entrySchema.parse(input);
  assertNotFuture(data.date);
  const { food, grams, nutrients } = await resolveEntry(userId, data.foodId, data.quantity, data.unit);
  const [row] = await db()
    .insert(mealEntries)
    .values({
      userId,
      date: data.date,
      slot: data.slot,
      foodId: food.id,
      label: food.brand ? `${food.nameFr} (${food.brand})` : food.nameFr,
      quantity: data.quantity,
      unit: data.unit,
      grams,
      ...nutrients,
      inputMethod: "manual",
    })
    .returning({ id: mealEntries.id });
  return row!.id;
}

export const updateEntrySchema = z.object({
  id: z.uuid(),
  quantity: z.number().positive().max(100_000),
  unit: z.enum(UNITS),
  slot: z.enum(MEAL_SLOTS),
});

/** Change la quantité ou le repas d'une ligne ; les valeurs suivent la quantité. */
export async function updateEntry(userId: string, input: z.input<typeof updateEntrySchema>): Promise<void> {
  const data = updateEntrySchema.parse(input);
  const entry = await getOwnEntry(userId, data.id);
  let values: Partial<MealEntry>;
  if (entry.foodId) {
    const { grams, nutrients } = await resolveEntry(userId, entry.foodId, data.quantity, data.unit);
    values = { quantity: data.quantity, unit: data.unit, grams, ...nutrients };
  } else {
    // Aliment supprimé depuis : on met les valeurs figées à l'échelle de la nouvelle quantité.
    if (data.unit !== entry.unit) throw new DomainError("unit_not_available");
    const ratio = data.quantity / entry.quantity;
    values = {
      quantity: data.quantity,
      grams: round1(entry.grams * ratio),
      kcal: round1(entry.kcal * ratio),
      proteinG: round1(entry.proteinG * ratio),
      carbsG: round1(entry.carbsG * ratio),
      fatG: round1(entry.fatG * ratio),
    };
  }
  await db()
    .update(mealEntries)
    .set({ ...values, slot: data.slot })
    .where(and(eq(mealEntries.id, entry.id), eq(mealEntries.userId, userId)));
}

export async function deleteEntry(userId: string, id: string): Promise<void> {
  await db()
    .delete(mealEntries)
    .where(and(eq(mealEntries.id, z.uuid().parse(id)), eq(mealEntries.userId, userId)));
}

async function getOwnEntry(userId: string, id: string): Promise<MealEntry> {
  const [entry] = await db()
    .select()
    .from(mealEntries)
    .where(and(eq(mealEntries.id, id), eq(mealEntries.userId, userId)));
  if (!entry) throw new DomainError("not_found");
  return entry;
}

export async function entriesOn(userId: string, date: string): Promise<MealEntry[]> {
  return db()
    .select()
    .from(mealEntries)
    .where(and(eq(mealEntries.userId, userId), eq(mealEntries.date, isoDate.parse(date))))
    .orderBy(asc(mealEntries.createdAt));
}

export const copySchema = z.object({
  fromDate: isoDate,
  /** Un repas précis, ou toute la journée si absent. */
  fromSlot: z.enum(MEAL_SLOTS).nullable(),
  toDate: isoDate,
  /** Repas d'arrivée ; par défaut le même que celui d'origine. */
  toSlot: z.enum(MEAL_SLOTS).nullable(),
});

/** Copie un repas (ou une journée entière) vers un autre jour. Renvoie le nombre de lignes copiées. */
export async function copyEntries(userId: string, input: z.input<typeof copySchema>): Promise<number> {
  const data = copySchema.parse(input);
  assertNotFuture(data.toDate);
  const source = (await entriesOn(userId, data.fromDate)).filter(
    (entry) => data.fromSlot === null || entry.slot === data.fromSlot,
  );
  if (source.length === 0) throw new DomainError("nothing_to_copy");
  await db()
    .insert(mealEntries)
    .values(
      source.map(({ id: _id, createdAt: _createdAt, ...entry }) => ({
        ...entry,
        date: data.toDate,
        slot: data.toSlot ?? entry.slot,
        inputMethod: "copy" as const,
      })),
    );
  return source.length;
}

/** Verres d'eau du jour (0 si rien n'est saisi). */
export async function waterOn(userId: string, date: string): Promise<number> {
  const [row] = await db()
    .select({ glasses: waterLogs.glasses })
    .from(waterLogs)
    .where(and(eq(waterLogs.userId, userId), eq(waterLogs.date, date)));
  return row?.glasses ?? 0;
}

export async function setWater(userId: string, date: string, glasses: number): Promise<void> {
  const day = isoDate.parse(date);
  assertNotFuture(day);
  const value = z.number().int().min(0).max(30).parse(glasses);
  await db()
    .insert(waterLogs)
    .values({ userId, date: day, glasses: value })
    .onConflictDoUpdate({ target: [waterLogs.userId, waterLogs.date], set: { glasses: value } });
}

/** Jours avec au moins une saisie, sur un peu plus d'un an. */
export async function streakFor(userId: string, today: string = todayIso()): Promise<Streak> {
  const rows = await db()
    .selectDistinct({ date: mealEntries.date })
    .from(mealEntries)
    .where(
      and(eq(mealEntries.userId, userId), gte(mealEntries.date, addDays(today, -400)), lte(mealEntries.date, today)),
    );
  return computeStreak(new Set(rows.map((row) => row.date)), today);
}

export type DaySummary = {
  date: string;
  entries: MealEntry[];
  bySlot: Record<MealSlot, { entries: MealEntry[]; totals: Nutrients }>;
  totals: Nutrients;
  goal: { kcal: number; proteinG: number; carbsG: number; fatG: number } | null;
  water: { glasses: number; goal: number };
  zone: EnergyZone | null;
};

/** Tout ce qu'il faut pour le tableau de bord et le journal d'un jour. */
export async function daySummary(userId: string, date: string): Promise<DaySummary> {
  const [entries, goal, glasses, profile, weight] = await Promise.all([
    entriesOn(userId, date),
    getGoalOn(userId, date),
    waterOn(userId, date),
    getProfile(userId),
    latestWeight(userId, date),
  ]);
  const bySlot = Object.fromEntries(
    MEAL_SLOTS.map((slot) => {
      const slotEntries = entries.filter((entry) => entry.slot === slot);
      return [slot, { entries: slotEntries, totals: sumNutrients(slotEntries) }];
    }),
  ) as DaySummary["bySlot"];
  const totals = sumNutrients(entries);

  let zone: EnergyZone | null = null;
  if (profile && entries.length > 0) {
    // Dépense estimée du jour avec le dernier poids connu (sinon le poids de départ).
    const plan = computePlan({
      sex: profile.sex,
      birthDate: profile.birthDate,
      heightCm: profile.heightCm,
      weightKg: weight ?? profile.startWeightKg,
      goal: "maintain",
      pace: profile.pace,
      activityLevel: profile.activityLevel,
      today: date,
      floors: await getCalorieFloors(),
    });
    zone = energyZone(totals.kcal, plan.tdee);
  }

  return {
    date,
    entries,
    bySlot,
    totals,
    goal: goal && { kcal: goal.kcal, proteinG: goal.proteinG, carbsG: goal.carbsG, fatG: goal.fatG },
    water: { glasses, goal: profile?.waterGoalGlasses ?? 8 },
    zone,
  };
}

export async function setWaterGoal(userId: string, glasses: number): Promise<void> {
  const value = z.number().int().min(1).max(20).parse(glasses);
  await db().update(profiles).set({ waterGoalGlasses: value }).where(eq(profiles.userId, userId));
}

// --- Poids -------------------------------------------------------------------

export async function latestWeight(userId: string, onOrBefore: string = todayIso()): Promise<number | null> {
  const [row] = await db()
    .select({ weightKg: weightEntries.weightKg })
    .from(weightEntries)
    .where(and(eq(weightEntries.userId, userId), lte(weightEntries.date, onOrBefore)))
    .orderBy(desc(weightEntries.date))
    .limit(1);
  return row?.weightKg ?? null;
}

export const weightSchema = z.object({
  date: isoDate,
  weightKg: z.number().min(30, "weight_range").max(300, "weight_range"),
});

export async function setWeight(userId: string, input: z.input<typeof weightSchema>): Promise<void> {
  const data = weightSchema.parse(input);
  assertNotFuture(data.date);
  await db()
    .insert(weightEntries)
    .values({ userId, ...data })
    .onConflictDoUpdate({ target: [weightEntries.userId, weightEntries.date], set: { weightKg: data.weightKg } });
}

export async function deleteWeight(userId: string, date: string): Promise<void> {
  await db()
    .delete(weightEntries)
    .where(and(eq(weightEntries.userId, userId), eq(weightEntries.date, isoDate.parse(date))));
}

export type WeightOverview = {
  entries: { date: string; weightKg: number }[];
  trend: TrendPoint[];
  weeklyChangeKg: number | null;
  targetWeightKg: number | null;
  projectedGoalDate: string | null;
};

export async function weightOverview(userId: string): Promise<WeightOverview> {
  const [entries, profile] = await Promise.all([
    db()
      .select({ date: weightEntries.date, weightKg: weightEntries.weightKg })
      .from(weightEntries)
      .where(eq(weightEntries.userId, userId))
      .orderBy(asc(weightEntries.date)),
    getProfile(userId),
  ]);
  const trend = weightTrend(entries);
  const weekly = weeklyChangeKg(trend);
  const last = trend.at(-1);
  const target = profile?.targetWeightKg ?? null;
  return {
    entries,
    trend,
    weeklyChangeKg: weekly,
    targetWeightKg: target,
    projectedGoalDate: last && weekly !== null && target !== null ? projectGoalDate(last, weekly, target) : null,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
