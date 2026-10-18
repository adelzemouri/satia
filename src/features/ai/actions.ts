"use server";

import { revalidatePath } from "next/cache";

import { type ActionState, toActionState } from "@/server/action-result";
import { analyzePhoto, analyzeText, saveMeal, type SaveMealInput } from "@/server/meal-ai";
import { getCurrentUser } from "@/server/session";

import type { MealDraft } from "./draft";

export type DraftState = { draft: MealDraft } | { error: string };

/** Les routes IA exigent une session : personne d'extérieur ne consomme le budget. */
async function withUser<T>(fn: (userId: string) => Promise<T>): Promise<T | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "generic" };
  try {
    return await fn(user.id);
  } catch (error) {
    return { error: toActionState(error)?.error ?? "generic" };
  }
}

export async function analyzePhotoAction(input: Parameters<typeof analyzePhoto>[1]): Promise<DraftState> {
  return withUser(async (userId) => ({ draft: await analyzePhoto(userId, input) }));
}

export async function analyzeTextAction(input: Parameters<typeof analyzeText>[1]): Promise<DraftState> {
  return withUser(async (userId) => ({ draft: await analyzeText(userId, input) }));
}

export async function saveMealAction(input: SaveMealInput): Promise<ActionState & { count?: number }> {
  return withUser(async (userId) => {
    const count = await saveMeal(userId, input);
    revalidatePath("/[locale]", "layout");
    return { ok: true, count };
  });
}
