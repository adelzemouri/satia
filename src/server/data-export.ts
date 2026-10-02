import "server-only";

import { asc, eq } from "drizzle-orm";
import { strToU8, zipSync } from "fflate";

import { db } from "@/db/client";
import {
  containers,
  favorites,
  foodCorrections,
  foods,
  goals,
  llmCalls,
  mealEntries,
  personalExpressions,
  photos,
  sharedMealShares,
  sharedMeals,
  profiles,
  recipeItems,
  user,
  waterLogs,
  weightEntries,
} from "@/db/schema";

import { adaptiveExport } from "./adaptive";
import { coachExport } from "./coach";
import { notificationExport } from "./notifications";
import { checkinExport } from "./quality";

/** Toutes les données personnelles d'un utilisateur, sans aucun secret (mots de passe, TOTP, sessions). */
export async function collectUserData(userId: string) {
  const [account] = await db()
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      locale: user.locale,
      energyUnit: user.energyUnit,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.id, userId));
  const profileRows = await db().select().from(profiles).where(eq(profiles.userId, userId));
  const goalRows = await db().select().from(goals).where(eq(goals.userId, userId)).orderBy(goals.effectiveFrom);
  const [meals, water, weights, ownFoods, ingredients, favoriteRows] = await Promise.all([
    db()
      .select()
      .from(mealEntries)
      .where(eq(mealEntries.userId, userId))
      .orderBy(asc(mealEntries.date), asc(mealEntries.createdAt)),
    db().select().from(waterLogs).where(eq(waterLogs.userId, userId)).orderBy(asc(waterLogs.date)),
    db().select().from(weightEntries).where(eq(weightEntries.userId, userId)).orderBy(asc(weightEntries.date)),
    db().select().from(foods).where(eq(foods.ownerUserId, userId)).orderBy(asc(foods.createdAt)),
    db()
      .select({
        recipeId: recipeItems.recipeId,
        foodId: recipeItems.foodId,
        grams: recipeItems.grams,
        position: recipeItems.position,
      })
      .from(recipeItems)
      .innerJoin(foods, eq(foods.id, recipeItems.recipeId))
      .where(eq(foods.ownerUserId, userId))
      .orderBy(asc(recipeItems.recipeId), asc(recipeItems.position)),
    db().select({ foodId: favorites.foodId }).from(favorites).where(eq(favorites.userId, userId)),
  ]);
  const aiCalls = await db()
    .select({
      feature: llmCalls.feature,
      model: llmCalls.model,
      tokensIn: llmCalls.tokensIn,
      tokensOut: llmCalls.tokensOut,
      costUsdMicros: llmCalls.costUsdMicros,
      status: llmCalls.status,
      createdAt: llmCalls.createdAt,
    })
    .from(llmCalls)
    .where(eq(llmCalls.userId, userId))
    .orderBy(asc(llmCalls.createdAt));
  const [containerRows, expressionRows, correctionRows, photoRows] = await Promise.all([
    db()
      .select({
        name: containers.name,
        kind: containers.kind,
        volumeMl: containers.volumeMl,
        diameterCm: containers.diameterCm,
      })
      .from(containers)
      .where(eq(containers.userId, userId)),
    db()
      .select({
        phrase: personalExpressions.phrase,
        foodId: personalExpressions.foodId,
        quantity: personalExpressions.quantity,
        unit: personalExpressions.unit,
      })
      .from(personalExpressions)
      .where(eq(personalExpressions.userId, userId)),
    db()
      .select({
        aiLabel: foodCorrections.aiLabel,
        aiGrams: foodCorrections.aiGrams,
        foodId: foodCorrections.foodId,
        grams: foodCorrections.grams,
        createdAt: foodCorrections.createdAt,
      })
      .from(foodCorrections)
      .where(eq(foodCorrections.userId, userId))
      .orderBy(asc(foodCorrections.createdAt)),
    // Les fichiers restent dans le stockage privé ; on liste les photos encore conservées.
    db()
      .select({ id: photos.id, createdAt: photos.createdAt })
      .from(photos)
      .where(eq(photos.userId, userId))
      .orderBy(asc(photos.createdAt)),
  ]);
  const shareRows = await db()
    .select({
      sharedMealId: sharedMealShares.sharedMealId,
      date: sharedMeals.date,
      slot: sharedMeals.slot,
      dishFoodId: sharedMeals.foodId,
      status: sharedMealShares.status,
      entryId: sharedMealShares.entryId,
      respondedAt: sharedMealShares.respondedAt,
    })
    .from(sharedMealShares)
    .innerJoin(sharedMeals, eq(sharedMeals.id, sharedMealShares.sharedMealId))
    .where(eq(sharedMealShares.userId, userId))
    .orderBy(asc(sharedMeals.date));
  const adaptive = await adaptiveExport(userId);
  const coach = await coachExport(userId);
  return {
    exportedAt: new Date().toISOString(),
    account: account ?? null,
    profile: profileRows[0] ?? null,
    goals: goalRows,
    meals,
    water,
    weights,
    foods: ownFoods,
    recipeItems: ingredients,
    favorites: favoriteRows,
    aiCalls,
    containers: containerRows,
    expressions: expressionRows,
    corrections: correctionRows,
    mealPhotos: photoRows,
    sharedMeals: shareRows,
    metabolismChecks: adaptive.checks,
    largerDays: adaptive.larger,
    checkins: await checkinExport(userId),
    coachMessages: coach.messages,
    coachReviews: coach.reviews,
    pushDevices: await notificationExport(userId),
  };
}

export type UserData = Awaited<ReturnType<typeof collectUserData>>;

function csvCell(value: unknown): string {
  if (value == null) return "";
  const text =
    value instanceof Date ? value.toISOString() : typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0]!);
  return (
    [columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\n") + "\n"
  );
}

/** Archive ZIP contenant un CSV par jeu de données. */
export function toCsvZip(data: UserData): Uint8Array {
  return zipSync({
    "account.csv": strToU8(toCsv(data.account ? [data.account] : [])),
    "profile.csv": strToU8(toCsv(data.profile ? [data.profile] : [])),
    "goals.csv": strToU8(toCsv(data.goals)),
    "metabolism-checks.csv": strToU8(toCsv(data.metabolismChecks)),
    "larger-days.csv": strToU8(toCsv(data.largerDays)),
    "checkins.csv": strToU8(toCsv(data.checkins)),
    "coach-messages.csv": strToU8(toCsv(data.coachMessages)),
    "coach-reviews.csv": strToU8(toCsv(data.coachReviews)),
    "push-devices.csv": strToU8(toCsv(data.pushDevices)),
    "meals.csv": strToU8(toCsv(data.meals)),
    "water.csv": strToU8(toCsv(data.water)),
    "weights.csv": strToU8(toCsv(data.weights)),
    "foods.csv": strToU8(toCsv(data.foods)),
    "recipe-items.csv": strToU8(toCsv(data.recipeItems)),
    "favorites.csv": strToU8(toCsv(data.favorites)),
    "ai-calls.csv": strToU8(toCsv(data.aiCalls)),
    "containers.csv": strToU8(toCsv(data.containers)),
    "expressions.csv": strToU8(toCsv(data.expressions)),
    "corrections.csv": strToU8(toCsv(data.corrections)),
    "meal-photos.csv": strToU8(toCsv(data.mealPhotos)),
    "shared-meals.csv": strToU8(toCsv(data.sharedMeals)),
  });
}
