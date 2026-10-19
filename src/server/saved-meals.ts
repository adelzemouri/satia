import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { scaleSavedItem } from "@/domain/saved-meals";
import { UNITS } from "@/domain/units";
import { MEAL_SLOTS, mealEntries, savedMeals, type SavedMealItem } from "@/db/schema";

import { DomainError } from "./errors";
import { assertNotFuture, entriesOn, resolveEntry } from "./journal";

/** Au-delà, la liste devient difficile à parcourir : on demande d'en supprimer. */
export const MAX_SAVED_MEALS = 40;

export type SavedMeal = typeof savedMeals.$inferSelect;

const isoDate = z.iso.date();

/** Repas enregistrés, les plus servis récemment d'abord, puis les plus récents. */
export async function listSavedMeals(userId: string): Promise<SavedMeal[]> {
  return db()
    .select()
    .from(savedMeals)
    .where(eq(savedMeals.userId, userId))
    .orderBy(sql`${savedMeals.usedAt} desc nulls last`, desc(savedMeals.createdAt));
}

const saveSchema = z.object({
  date: isoDate,
  slot: z.enum(MEAL_SLOTS),
  name: z.string().trim().min(1).max(60),
});

/** Enregistre le contenu d'un repas du journal sous un nom, pour le resservir d'un geste. */
export async function saveMeal(userId: string, input: z.input<typeof saveSchema>): Promise<string> {
  const data = saveSchema.parse(input);
  const entries = (await entriesOn(userId, data.date)).filter((entry) => entry.slot === data.slot);
  if (entries.length === 0) throw new DomainError("nothing_to_save");
  const [{ count } = { count: 0 }] = await db()
    .select({ count: sql<number>`count(*)::int` })
    .from(savedMeals)
    .where(eq(savedMeals.userId, userId));
  if (count >= MAX_SAVED_MEALS) throw new DomainError("too_many_saved_meals");
  const items: SavedMealItem[] = entries.map((entry) => ({
    foodId: entry.foodId,
    label: entry.label,
    quantity: entry.quantity,
    unit: entry.unit,
    grams: entry.grams,
    kcal: entry.kcal,
    proteinG: entry.proteinG,
    carbsG: entry.carbsG,
    fatG: entry.fatG,
    isEstimated: entry.isEstimated,
  }));
  const [row] = await db()
    .insert(savedMeals)
    .values({ userId, name: data.name, items })
    .returning({ id: savedMeals.id });
  return row!.id;
}

export async function getSavedMeal(userId: string, id: string): Promise<SavedMeal> {
  return getOwnSavedMeal(userId, id);
}

const updateSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(60),
  /**
   * Lignes du repas dans l'ordre voulu : une ligne gardée est repérée par sa position d'origine,
   * avec sa nouvelle quantité ; un aliment ajouté arrive avec sa quantité et son unité.
   */
  items: z
    .array(
      z.union([
        z.object({ index: z.number().int().min(0), quantity: z.number().positive().max(10_000) }),
        z.object({ foodId: z.uuid(), quantity: z.number().positive().max(10_000), unit: z.enum(UNITS) }),
      ]),
    )
    .min(1)
    .max(100),
});

/** Renomme un repas enregistré, change ses quantités, retire des aliments ou en ajoute. */
export async function updateSavedMeal(userId: string, input: z.input<typeof updateSchema>): Promise<void> {
  const data = updateSchema.parse(input);
  const meal = await getOwnSavedMeal(userId, data.id);
  const indexes = data.items.flatMap((item) => ("index" in item ? [item.index] : []));
  if (new Set(indexes).size !== indexes.length || indexes.some((index) => index >= meal.items.length)) {
    throw new DomainError("not_found");
  }
  const items: SavedMealItem[] = [];
  for (const item of data.items) {
    if ("index" in item) {
      items.push(scaleSavedItem(meal.items[item.index]!, item.quantity));
      continue;
    }
    // Valeurs calculées comme pour une saisie du journal, depuis la base d'aliments.
    const { food, grams, nutrients } = await resolveEntry(userId, item.foodId, item.quantity, item.unit);
    items.push({
      foodId: food.id,
      label: food.brand ? `${food.nameFr} (${food.brand})` : food.nameFr,
      quantity: item.quantity,
      unit: item.unit,
      grams,
      ...nutrients,
      isEstimated: false,
    });
  }
  await db().update(savedMeals).set({ name: data.name, items }).where(eq(savedMeals.id, meal.id));
}

async function getOwnSavedMeal(userId: string, id: string): Promise<SavedMeal> {
  const [meal] = await db()
    .select()
    .from(savedMeals)
    .where(and(eq(savedMeals.id, z.uuid().parse(id)), eq(savedMeals.userId, userId)));
  if (!meal) throw new DomainError("not_found");
  return meal;
}

const serveSchema = z.object({ id: z.uuid(), date: isoDate, slot: z.enum(MEAL_SLOTS) });

/** Ajoute toutes les lignes d'un repas enregistré au journal ; renvoie les lignes créées. */
export async function serveSavedMeal(userId: string, input: z.input<typeof serveSchema>): Promise<string[]> {
  const data = serveSchema.parse(input);
  assertNotFuture(data.date);
  const meal = await getOwnSavedMeal(userId, data.id);
  const rows = await db()
    .insert(mealEntries)
    .values(
      meal.items.map((item) => ({
        ...item,
        userId,
        date: data.date,
        slot: data.slot,
        inputMethod: "copy" as const,
      })),
    )
    .returning({ id: mealEntries.id });
  await db().update(savedMeals).set({ usedAt: new Date() }).where(eq(savedMeals.id, meal.id));
  return rows.map((row) => row.id);
}

/** Annule un ajout : supprime les lignes créées (seulement celles de l'utilisateur). */
export async function unserveSavedMeal(userId: string, entryIds: string[]): Promise<void> {
  const ids = z.array(z.uuid()).max(100).parse(entryIds);
  if (ids.length === 0) return;
  await db()
    .delete(mealEntries)
    .where(and(eq(mealEntries.userId, userId), inArray(mealEntries.id, ids)));
}

export async function deleteSavedMeal(userId: string, id: string): Promise<void> {
  await db()
    .delete(savedMeals)
    .where(and(eq(savedMeals.id, z.uuid().parse(id)), eq(savedMeals.userId, userId)));
}
