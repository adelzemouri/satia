import "server-only";

import { and, asc, desc, eq, gte, lte, sum } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { dailyCheckins, foods, MEAL_SLOTS, type MealSlot, mealEntries } from "@/db/schema";
import { todayIso } from "@/domain/dates";
import { addDays } from "@/domain/energy";
import { type FeelingDay, feelingDays } from "@/domain/feelings";
import { dayQuality, type DayQuality, type QualityItem, weekQuality, type WeekQuality } from "@/domain/quality";

import { assertNotFuture } from "./journal";

/** Lignes de journal sur [from, to] avec les valeurs de qualité de leur aliment. */
export async function qualityItems(userId: string, from: string, to: string): Promise<QualityItem[]> {
  const rows = await db()
    .select({
      date: mealEntries.date,
      name: mealEntries.label,
      grams: mealEntries.grams,
      kcal: mealEntries.kcal,
      fiberG: foods.fiberG,
      sugarsG: foods.sugarsG,
      saltG: foods.saltG,
      novaGroup: foods.novaGroup,
      fruitVegShare: foods.fruitVegShare,
    })
    .from(mealEntries)
    .leftJoin(foods, eq(foods.id, mealEntries.foodId))
    .where(and(eq(mealEntries.userId, userId), gte(mealEntries.date, from), lte(mealEntries.date, to)));
  return rows.map((row) => ({ ...row, fruitVegShare: row.fruitVegShare ?? 0 }));
}

export async function dayQualityFor(userId: string, date: string): Promise<DayQuality> {
  return dayQuality(await qualityItems(userId, date, date));
}

export type WeekQualityReport = { from: string; to: string; quality: WeekQuality | null };

/** Bilan qualité des 7 derniers jours (aujourd'hui compris). */
export async function weekQualityReport(userId: string, today: string = todayIso()): Promise<WeekQualityReport> {
  const from = addDays(today, -6);
  return { from, to: today, quality: weekQuality(await qualityItems(userId, from, today)) };
}

// --- Ressenti du jour -----------------------------------------------------------

const score = z.number().int().min(1).max(5).nullable();
export const checkinSchema = z.object({
  date: z.iso.date(),
  hunger: score.optional(),
  energy: score.optional(),
  mood: score.optional(),
});
export type Checkin = { hunger: number | null; energy: number | null; mood: number | null };

export async function checkinOn(userId: string, date: string): Promise<Checkin> {
  const [row] = await db()
    .select({ hunger: dailyCheckins.hunger, energy: dailyCheckins.energy, mood: dailyCheckins.mood })
    .from(dailyCheckins)
    .where(and(eq(dailyCheckins.userId, userId), eq(dailyCheckins.date, date)));
  return row ?? { hunger: null, energy: null, mood: null };
}

/** Enregistre une ou plusieurs réponses du ressenti (les autres restent inchangées). */
export async function setCheckin(userId: string, input: z.input<typeof checkinSchema>): Promise<void> {
  const { date, ...values } = checkinSchema.parse(input);
  assertNotFuture(date);
  await db()
    .insert(dailyCheckins)
    .values({ userId, date, ...values })
    .onConflictDoUpdate({
      target: [dailyCheckins.userId, dailyCheckins.date],
      set: { ...values, updatedAt: new Date() },
    });
}

/** Ressentis et calories des `days` derniers jours (aujourd'hui compris). */
export async function feelingHistory(userId: string, today: string = todayIso(), days = 28): Promise<FeelingDay[]> {
  const from = addDays(today, -(days - 1));
  const [checkins, intakes] = await Promise.all([
    db()
      .select({
        date: dailyCheckins.date,
        hunger: dailyCheckins.hunger,
        energy: dailyCheckins.energy,
        mood: dailyCheckins.mood,
      })
      .from(dailyCheckins)
      .where(and(eq(dailyCheckins.userId, userId), gte(dailyCheckins.date, from), lte(dailyCheckins.date, today))),
    db()
      .select({ date: mealEntries.date, kcal: sum(mealEntries.kcal).mapWith(Number) })
      .from(mealEntries)
      .where(and(eq(mealEntries.userId, userId), gte(mealEntries.date, from), lte(mealEntries.date, today)))
      .groupBy(mealEntries.date),
  ]);
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
  return feelingDays(dates, checkins, intakes);
}

// --- Repas habituel ---------------------------------------------------------------

/** Fenêtre d'observation et nombre minimal de répétitions d'un même repas. */
const HABIT_DAYS = 42;
const HABIT_MIN_COUNT = 3;

export type HabitualMeal = {
  /** Jour le plus récent où ce repas a été saisi : c'est lui qu'on recopie. */
  fromDate: string;
  slot: MealSlot;
  labels: string[];
  kcal: number;
  count: number;
};

/**
 * Repas le plus fréquent d'un créneau sur les 6 dernières semaines (même ensemble d'aliments,
 * au moins 3 fois), s'il n'a pas déjà été saisi ce jour-là.
 */
export async function habitualMeal(userId: string, slot: MealSlot, date: string): Promise<HabitualMeal | null> {
  const day = z.iso.date().parse(date);
  const rows = await db()
    .select({ date: mealEntries.date, foodId: mealEntries.foodId, label: mealEntries.label, kcal: mealEntries.kcal })
    .from(mealEntries)
    .where(
      and(
        eq(mealEntries.userId, userId),
        eq(mealEntries.slot, z.enum(MEAL_SLOTS).parse(slot)),
        gte(mealEntries.date, addDays(day, -HABIT_DAYS)),
        lte(mealEntries.date, day),
      ),
    )
    .orderBy(desc(mealEntries.date), asc(mealEntries.createdAt));
  if (rows.some((row) => row.date === day)) return null;

  const byDate = new Map<string, typeof rows>();
  for (const row of rows) byDate.set(row.date, [...(byDate.get(row.date) ?? []), row]);
  const groups = new Map<string, { count: number; fromDate: string; rows: typeof rows }>();
  for (const [date, meal] of byDate) {
    if (meal.some((row) => row.foodId === null)) continue;
    const key = [...new Set(meal.map((row) => row.foodId))].sort().join(",");
    const group = groups.get(key);
    // Les dates sont parcourues de la plus récente à la plus ancienne.
    if (group) group.count += 1;
    else groups.set(key, { count: 1, fromDate: date, rows: meal });
  }
  const best = [...groups.values()]
    .filter((group) => group.count >= HABIT_MIN_COUNT)
    .sort((a, b) => b.count - a.count || b.fromDate.localeCompare(a.fromDate))[0];
  if (!best) return null;
  return {
    fromDate: best.fromDate,
    slot,
    labels: best.rows.map((row) => row.label),
    kcal: Math.round(best.rows.reduce((sum, row) => sum + row.kcal, 0)),
    count: best.count,
  };
}

/** Pour l'export. */
export async function checkinExport(userId: string) {
  return db().select().from(dailyCheckins).where(eq(dailyCheckins.userId, userId)).orderBy(asc(dailyCheckins.date));
}
