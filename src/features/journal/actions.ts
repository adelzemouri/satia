"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { type ActionState, toActionState } from "@/server/action-result";
import {
  createCustomFood,
  createRecipe,
  type CustomFoodInput,
  deleteOwnFood,
  fillRecipePhotosLater,
  type RecipeInput,
  type recipePhotoSchema,
  setFavorite,
  setRecipePhoto,
  setUnitWeight,
  updateRecipe,
} from "@/server/foods";
import {
  addEntry,
  copyEntries,
  deleteEntry,
  deleteWeight,
  type EntryInput,
  setWater,
  setWaterGoal,
  setWeight,
  updateEntry,
} from "@/server/journal";
import { findByBarcode, importOpenFoodFactsProduct } from "@/server/open-food-facts";
import { setTargetWeight } from "@/server/profile";
import { getCurrentUser } from "@/server/session";

export type IdState = (ActionState & { id?: string; count?: number }) | null;

/** Exécute une mutation pour l'utilisateur connecté et rafraîchit les pages de l'app. */
async function run<T extends IdState>(fn: (userId: string) => Promise<T>): Promise<T | ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "generic" };
  try {
    const result = await fn(user.id);
    revalidatePath("/[locale]", "layout");
    return result;
  } catch (error) {
    return toActionState(error);
  }
}

export async function addEntryAction(input: EntryInput): Promise<IdState> {
  return run(async (userId) => ({ ok: true, id: await addEntry(userId, input) }));
}

export async function updateEntryAction(input: Parameters<typeof updateEntry>[1]): Promise<IdState> {
  return run(async (userId) => (await updateEntry(userId, input), { ok: true }));
}

export async function deleteEntryAction(id: string): Promise<IdState> {
  return run(async (userId) => (await deleteEntry(userId, id), { ok: true }));
}

export async function copyEntriesAction(input: Parameters<typeof copyEntries>[1]): Promise<IdState> {
  return run(async (userId) => ({ ok: true, count: await copyEntries(userId, input) }));
}

export async function setWaterAction(date: string, glasses: number): Promise<IdState> {
  return run(async (userId) => (await setWater(userId, date, glasses), { ok: true }));
}

export async function setWaterGoalAction(glasses: number): Promise<IdState> {
  return run(async (userId) => (await setWaterGoal(userId, glasses), { ok: true }));
}

export async function setFavoriteAction(foodId: string, favorite: boolean): Promise<IdState> {
  return run(async (userId) => (await setFavorite(userId, foodId, favorite), { ok: true }));
}

export async function setUnitWeightAction(input: Parameters<typeof setUnitWeight>[1]): Promise<IdState> {
  return run(async (userId) => (await setUnitWeight(userId, input), { ok: true }));
}

export async function createFoodAction(input: CustomFoodInput): Promise<IdState> {
  return run(async (userId) => ({ ok: true, id: await createCustomFood(userId, input) }));
}

export async function createRecipeAction(input: RecipeInput): Promise<IdState> {
  return run(async (userId) => {
    const id = await createRecipe(userId, input);
    fillRecipePhotosLater(userId);
    return { ok: true, id };
  });
}

export async function updateRecipeAction(id: string, input: RecipeInput): Promise<IdState> {
  return run(async (userId) => (await updateRecipe(userId, id, input), { ok: true, id }));
}

export async function setRecipePhotoAction(input: z.input<typeof recipePhotoSchema>): Promise<IdState> {
  return run(async (userId) => (await setRecipePhoto(userId, input), { ok: true }));
}

export async function deleteFoodAction(foodId: string): Promise<IdState> {
  return run(async (userId) => (await deleteOwnFood(userId, foodId), { ok: true }));
}

export async function importOffAction(code: string): Promise<IdState> {
  return run(async (userId) => ({ ok: true, id: await importOpenFoodFactsProduct(userId, code) }));
}

export async function scanBarcodeAction(code: string): Promise<IdState> {
  return run(async (userId) => ({ ok: true, id: await findByBarcode(userId, code) }));
}

export async function setWeightAction(input: { date: string; weightKg: number }): Promise<IdState> {
  return run(async (userId) => (await setWeight(userId, input), { ok: true }));
}

export async function setTargetWeightAction(targetWeightKg: number | null): Promise<IdState> {
  return run(async (userId) => (await setTargetWeight(userId, targetWeightKg), { ok: true }));
}

export async function deleteWeightAction(date: string): Promise<IdState> {
  return run(async (userId) => (await deleteWeight(userId, date), { ok: true }));
}
