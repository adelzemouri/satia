"use server";

import { revalidatePath } from "next/cache";

import { type ActionState, toActionState } from "@/server/action-result";
import { analyzePhoto, analyzeText, saveMeal, type SaveMealInput } from "@/server/meal-ai";
import { createContainer, deleteContainer, deleteExpression, saveExpression } from "@/server/personal";
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

export async function createContainerAction(input: Parameters<typeof createContainer>[1]): Promise<ActionState> {
  return withUser(async (userId) => {
    await createContainer(userId, input);
    revalidatePath("/[locale]/containers", "page");
    return { ok: true };
  });
}

export async function deleteContainerAction(id: string): Promise<ActionState> {
  return withUser(async (userId) => {
    await deleteContainer(userId, id);
    revalidatePath("/[locale]/containers", "page");
    return { ok: true };
  });
}

export async function saveExpressionAction(input: Parameters<typeof saveExpression>[1]): Promise<ActionState> {
  return withUser(async (userId) => {
    await saveExpression(userId, input);
    revalidatePath("/[locale]/dictionary", "page");
    return { ok: true };
  });
}

export async function deleteExpressionAction(id: string): Promise<ActionState> {
  return withUser(async (userId) => {
    await deleteExpression(userId, id);
    revalidatePath("/[locale]/dictionary", "page");
    return { ok: true };
  });
}
