import "server-only";

import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { foods, MEAL_SLOTS, mealEntries, sharedMealShares, sharedMeals, user } from "@/db/schema";
import { todayIso } from "@/domain/dates";
import { nutrientsFor } from "@/domain/nutrition";

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
  // Une recette personnelle reste invisible aux autres : on ne partage que ce qu'ils peuvent voir.
  if (dish.ownerUserId !== null && data.memberIds.length > 0) throw new DomainError("dish_not_shared");

  const memberIds = [...new Set(data.memberIds)].filter((id) => id !== userId);
  if (memberIds.length > 0) {
    const found = await db()
      .select({ id: user.id })
      .from(user)
      .where(and(inArray(user.id, memberIds), eq(user.householdId, householdId)));
    if (found.length !== memberIds.length) throw new DomainError("not_found");
  }
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

export type PendingShare = {
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
      fromName: user.name,
      date: sharedMeals.date,
      slot: sharedMeals.slot,
      totalParts: sharedMeals.totalParts,
      totalGrams: sharedMeals.totalGrams,
    })
    .from(sharedMealShares)
    .innerJoin(sharedMeals, eq(sharedMeals.id, sharedMealShares.sharedMealId))
    .innerJoin(foods, eq(foods.id, sharedMeals.foodId))
    .leftJoin(user, eq(user.id, sharedMeals.createdBy))
    .where(and(eq(sharedMealShares.userId, userId), eq(sharedMealShares.status, "pending")))
    .orderBy(desc(sharedMeals.date), desc(sharedMeals.createdAt));
  return rows.map(({ kcal, totalGrams, ...row }) => {
    const partGrams = round1(totalGrams / row.totalParts);
    return { ...row, partGrams, partKcal: Math.round((kcal * partGrams) / 100) };
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
