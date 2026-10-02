"use server";

import { revalidatePath } from "next/cache";

import type { FoodItem } from "@/features/foods/food-types";
import { type ActionState, toActionState } from "@/server/action-result";
import { createSharedMeal, respondToShare, type SharedMealInput } from "@/server/family";
import { getFood } from "@/server/foods";
import { getCurrentUser } from "@/server/session";

async function withUser<T>(
  fn: (user: { id: string; householdId: string }) => Promise<T>,
): Promise<T | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "generic" };
  try {
    return await fn(user);
  } catch (error) {
    return { error: toActionState(error)?.error ?? "generic" };
  }
}

export async function createSharedMealAction(input: SharedMealInput): Promise<ActionState> {
  return withUser(async (user) => {
    await createSharedMeal(user.id, user.householdId, input);
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

export async function respondToShareAction(
  sharedMealId: string,
  input: Parameters<typeof respondToShare>[2],
): Promise<ActionState> {
  return withUser(async (user) => {
    await respondToShare(user.id, sharedMealId, input);
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

/** Aliment tel que l'affichent les écrans d'ajout (après la création d'une recette). */
export async function getFoodItemAction(foodId: string): Promise<{ food: FoodItem } | { error: string }> {
  return withUser(async (user) => {
    const { ownerUserId: _owner, ...food } = await getFood(user.id, foodId);
    return { food };
  });
}
