import "server-only";

import { and, desc, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { foods, MEAL_SLOTS, mealEntries, savedMeals, sharedMealShares, sharedMeals, user } from "@/db/schema";
import { todayIso } from "@/domain/dates";
import { nutrientsFor } from "@/domain/nutrition";
import { scaleSavedItem } from "@/domain/saved-meals";

import { DomainError } from "./errors";
import { getFood, per100 } from "./foods";

/** Autres membres du foyer, à qui l'on peut proposer un repas partagé (nom seulement). */
export async function otherMembers(userId: string, householdId: string): Promise<{ id: string; name: string }[]> {
  return db()
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(and(eq(user.householdId, householdId), ne(user.id, userId)))
    .orderBy(user.name);
}

const parts = z.number().min(0.25).max(20);

export const sharedMealSchema = z.object({
  foodId: z.uuid(),
  date: z.iso.date(),
  slot: z.enum(MEAL_SLOTS),
  totalParts: z.number().min(1).max(50),
  /** Poids du plat entier ; par défaut, celui de la recette (portion × nombre de portions). */
  totalGrams: z.number().min(10).max(20_000).nullable(),
  memberIds: z.array(z.uuid()).max(10),
  /** Parts mangées par l'auteur ; null s'il n'en mange pas. */
  myParts: parts.nullable(),
});
export type SharedMealInput = z.input<typeof sharedMealSchema>;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

type Dish = Awaited<ReturnType<typeof getFood>>;

/** Ligne de journal pour une portion du plat partagé (valeurs figées, comme toute saisie). */
function entryFor(
  userId: string,
  meal: { date: string; slot: (typeof MEAL_SLOTS)[number] },
  dish: Dish,
  grams: number,
) {
  return {
    userId,
    date: meal.date,
    slot: meal.slot,
    foodId: dish.id,
    label: dish.nameFr,
    quantity: round1(grams),
    unit: "g" as const,
    grams: round1(grams),
    ...nutrientsFor(per100(dish), grams),
    inputMethod: "shared" as const,
  };
}

/** Membres du foyer (sans l'auteur) à qui partager ; erreur si l'un n'en fait pas partie. */
async function householdMembers(userId: string, householdId: string, ids: string[]): Promise<string[]> {
  const memberIds = [...new Set(ids)].filter((id) => id !== userId);
  if (memberIds.length === 0) return [];
  const found = await db()
    .select({ id: user.id })
    .from(user)
    .where(and(inArray(user.id, memberIds), eq(user.householdId, householdId)));
  if (found.length !== memberIds.length) throw new DomainError("not_found");
  return memberIds;
}

/**
 * Partage un plat avec des membres du foyer. L'auteur l'ajoute tout de suite à son journal
 * s'il en mange ; les autres le reçoivent « à valider » : rien n'entre dans leur journal
 * sans leur accord.
 */
export async function createSharedMeal(userId: string, householdId: string, input: SharedMealInput): Promise<string> {
  const data = sharedMealSchema.parse(input);
  if (data.date > todayIso()) throw new DomainError("future_date");
  const dish = await getFood(userId, data.foodId);
  const recipeGrams = (dish.unitWeights?.portion ?? 0) * (dish.servings ?? 0);
  const totalGrams = data.totalGrams ?? (recipeGrams > 0 ? recipeGrams : null);
  if (!totalGrams) throw new DomainError("dish_weight_required");
  // Un aliment personnel reste invisible aux autres : on ne partage que ce qu'ils peuvent voir.
  if (dish.ownerUserId !== null && data.memberIds.length > 0) throw new DomainError("dish_not_shared");

  const memberIds = await householdMembers(userId, householdId, data.memberIds);
  if (memberIds.length === 0 && data.myParts === null) throw new DomainError("share_nobody");

  return db().transaction(async (tx) => {
    const [meal] = await tx
      .insert(sharedMeals)
      .values({
        householdId,
        createdBy: userId,
        foodId: dish.id,
        date: data.date,
        slot: data.slot,
        totalParts: data.totalParts,
        totalGrams: round1(totalGrams),
      })
      .returning({ id: sharedMeals.id });
    if (data.myParts !== null) {
      const [entry] = await tx
        .insert(mealEntries)
        .values(entryFor(userId, data, dish, (totalGrams / data.totalParts) * data.myParts))
        .returning({ id: mealEntries.id });
      await tx.insert(sharedMealShares).values({
        sharedMealId: meal!.id,
        userId,
        status: "accepted",
        entryId: entry!.id,
        respondedAt: new Date(),
      });
    }
    if (memberIds.length > 0) {
      await tx.insert(sharedMealShares).values(memberIds.map((id) => ({ sharedMealId: meal!.id, userId: id })));
    }
    return meal!.id;
  });
}

export const shareSavedMealSchema = z.object({
  id: z.uuid(),
  date: z.iso.date(),
  slot: z.enum(MEAL_SLOTS),
  memberIds: z.array(z.uuid()).min(1).max(10),
});

/**
 * Partage un repas de « Mes repas » (déjà dans le journal de l'auteur) : chaque membre le reçoit
 * à valider, avec sa portion exprimée par rapport à celle de l'auteur.
 */
export async function shareSavedMeal(
  userId: string,
  householdId: string,
  input: z.input<typeof shareSavedMealSchema>,
): Promise<string> {
  const data = shareSavedMealSchema.parse(input);
  if (data.date > todayIso()) throw new DomainError("future_date");
  const [meal] = await db()
    .select()
    .from(savedMeals)
    .where(and(eq(savedMeals.id, data.id), eq(savedMeals.userId, userId)));
  if (!meal) throw new DomainError("not_found");
  const memberIds = await householdMembers(userId, householdId, data.memberIds);
  if (memberIds.length === 0) throw new DomainError("share_nobody");
  // Les aliments perso de l'auteur restent privés : la ligne garde son nom et ses valeurs, sans lien.
  const ids = meal.items.flatMap((item) => item.foodId ?? []);
  const personal = new Set(
    ids.length === 0
      ? []
      : (
          await db()
            .select({ id: foods.id })
            .from(foods)
            .where(and(inArray(foods.id, ids), isNotNull(foods.ownerUserId)))
        ).map((row) => row.id),
  );
  const items = meal.items.map((item) => (item.foodId && personal.has(item.foodId) ? { ...item, foodId: null } : item));
  const totalGrams = Math.max(1, round1(items.reduce((sum, item) => sum + item.grams, 0)));
  return db().transaction(async (tx) => {
    const [shared] = await tx
      .insert(sharedMeals)
      .values({
        householdId,
        createdBy: userId,
        foodId: null,
        name: meal.name,
        items,
        date: data.date,
        slot: data.slot,
        totalParts: 1,
        totalGrams,
      })
      .returning({ id: sharedMeals.id });
    await tx.insert(sharedMealShares).values(memberIds.map((id) => ({ sharedMealId: shared!.id, userId: id })));
    return shared!.id;
  });
}

export type PendingShare = {
  /** Un plat cuisiné pour plusieurs (en parts), ou un repas de « Mes repas » (en portions). */
  kind: "dish" | "meal";
  sharedMealId: string;
  dishName: string;
  imageUrl: string | null;
  fromName: string | null;
  date: string;
  slot: (typeof MEAL_SLOTS)[number];
  totalParts: number;
  partGrams: number;
  partKcal: number;
};

/** Repas partagés qui attendent la réponse de l'utilisateur, du plus récent au plus ancien. */
export async function pendingShares(userId: string): Promise<PendingShare[]> {
  const rows = await db()
    .select({
      sharedMealId: sharedMeals.id,
      dishName: foods.nameFr,
      imageUrl: foods.imageUrl,
      kcal: foods.kcal,
      name: sharedMeals.name,
      items: sharedMeals.items,
      fromName: user.name,
      date: sharedMeals.date,
      slot: sharedMeals.slot,
      totalParts: sharedMeals.totalParts,
      totalGrams: sharedMeals.totalGrams,
    })
    .from(sharedMealShares)
    .innerJoin(sharedMeals, eq(sharedMeals.id, sharedMealShares.sharedMealId))
    .leftJoin(foods, eq(foods.id, sharedMeals.foodId))
    .leftJoin(user, eq(user.id, sharedMeals.createdBy))
    .where(and(eq(sharedMealShares.userId, userId), eq(sharedMealShares.status, "pending")))
    .orderBy(desc(sharedMeals.date), desc(sharedMeals.createdAt));
  return rows.flatMap(({ kcal, totalGrams, name, items, dishName, ...row }): PendingShare[] => {
    const partGrams = round1(totalGrams / row.totalParts);
    if (items) {
      const mealKcal = items.reduce((sum, item) => sum + item.kcal, 0);
      return [
        { ...row, kind: "meal", dishName: name ?? "", partGrams, partKcal: Math.round(mealKcal / row.totalParts) },
      ];
    }
    if (dishName === null || kcal === null) return [];
    return [{ ...row, kind: "dish", dishName, partGrams, partKcal: Math.round((kcal * partGrams) / 100) }];
  });
}

export const shareResponseSchema = z.discriminatedUnion("accept", [
  z.object({
    accept: z.literal(true),
    /** Nombre de parts (½, 1, 1½, 2…) ou poids en grammes, l'un ou l'autre. */
    parts: parts.nullable(),
    grams: z.number().min(1).max(5000).nullable(),
    slot: z.enum(MEAL_SLOTS),
  }),
  z.object({ accept: z.literal(false) }),
]);

/** Valide (avec sa portion) ou refuse un repas partagé. */
export async function respondToShare(
  userId: string,
  sharedMealId: string,
  input: z.input<typeof shareResponseSchema>,
): Promise<void> {
  const data = shareResponseSchema.parse(input);
  const [row] = await db()
    .select({ meal: sharedMeals })
    .from(sharedMealShares)
    .innerJoin(sharedMeals, eq(sharedMeals.id, sharedMealShares.sharedMealId))
    .where(
      and(
        eq(sharedMealShares.sharedMealId, z.uuid().parse(sharedMealId)),
        eq(sharedMealShares.userId, userId),
        eq(sharedMealShares.status, "pending"),
      ),
    );
  if (!row) throw new DomainError("not_found");
  const where = and(eq(sharedMealShares.sharedMealId, row.meal.id), eq(sharedMealShares.userId, userId));
  if (!data.accept) {
    await db().update(sharedMealShares).set({ status: "declined", respondedAt: new Date() }).where(where);
    return;
  }
  const grams = data.grams ?? (data.parts !== null ? (row.meal.totalGrams / row.meal.totalParts) * data.parts : null);
  if (!grams) throw new DomainError("portion_required");
  const { items, name } = row.meal;
  if (items) {
    // Repas de « Mes repas » : chaque ligne suit la portion choisie, regroupée sous le nom du repas.
    const factor = grams / row.meal.totalGrams;
    await db().transaction(async (tx) => {
      const entries = await tx
        .insert(mealEntries)
        .values(
          items.map((item) => ({
            ...scaleSavedItem(item, round1(item.quantity * factor)),
            userId,
            date: row.meal.date,
            slot: data.slot,
            dish: name,
            inputMethod: "shared" as const,
          })),
        )
        .returning({ id: mealEntries.id });
      await tx
        .update(sharedMealShares)
        .set({ status: "accepted", entryId: entries[0]?.id ?? null, respondedAt: new Date() })
        .where(where);
    });
    return;
  }
  if (!row.meal.foodId) throw new DomainError("not_found");
  const dish = await getFood(userId, row.meal.foodId);
  await db().transaction(async (tx) => {
    const [entry] = await tx
      .insert(mealEntries)
      .values(entryFor(userId, { date: row.meal.date, slot: data.slot }, dish, grams))
      .returning({ id: mealEntries.id });
    await tx
      .update(sharedMealShares)
      .set({ status: "accepted", entryId: entry!.id, respondedAt: new Date() })
      .where(where);
  });
}
