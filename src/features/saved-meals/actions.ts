"use server";

import { revalidatePath } from "next/cache";

import { type ActionState, toActionState } from "@/server/action-result";
import { deleteSavedMeal, saveMeal, serveSavedMeal, unserveSavedMeal, updateSavedMeal } from "@/server/saved-meals";
import { getCurrentUser } from "@/server/session";

export type SavedMealState = (ActionState & { id?: string; ids?: string[] }) | null;

async function run(fn: (userId: string) => Promise<SavedMealState>): Promise<SavedMealState> {
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

export async function saveMealAction(input: Parameters<typeof saveMeal>[1]): Promise<SavedMealState> {
  return run(async (userId) => ({ ok: true, id: await saveMeal(userId, input) }));
}

export async function serveSavedMealAction(input: Parameters<typeof serveSavedMeal>[1]): Promise<SavedMealState> {
  return run(async (userId) => ({ ok: true, ids: await serveSavedMeal(userId, input) }));
}

export async function unserveSavedMealAction(entryIds: string[]): Promise<SavedMealState> {
  return run(async (userId) => (await unserveSavedMeal(userId, entryIds), { ok: true }));
}

export async function deleteSavedMealAction(id: string): Promise<SavedMealState> {
  return run(async (userId) => (await deleteSavedMeal(userId, id), { ok: true }));
}

export async function updateSavedMealAction(input: Parameters<typeof updateSavedMeal>[1]): Promise<SavedMealState> {
  return run(async (userId) => (await updateSavedMeal(userId, input), { ok: true }));
}
