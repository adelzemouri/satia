"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { type ActionState, toActionState } from "@/server/action-result";
import {
  addPlanItem,
  addShoppingItem,
  clearCheckedShopping,
  type FridgeResult,
  fridgeIdeas,
  type fridgeInputSchema,
  generateMenu,
  type generateMenuSchema,
  type PlanItemInput,
  removePlanItem,
  saveIdeaAsRecipe,
  type saveIdeaSchema,
  setShoppingChecked,
  type shoppingItemSchema,
  shoppingFromMenu,
} from "@/server/planning";
import { fillRecipePhotosLater } from "@/server/foods";
import { getCurrentUser } from "@/server/session";

type User = { id: string; householdId: string };

async function run(fn: (user: User) => Promise<unknown>): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "generic" };
  try {
    await fn(user);
  } catch (error) {
    return toActionState(error);
  }
  revalidatePath("/plan");
  revalidatePath("/shopping");
  return { ok: true };
}

export async function addPlanItemAction(input: PlanItemInput): Promise<ActionState> {
  return run((user) => addPlanItem(user.id, user.householdId, input));
}

export async function removePlanItemAction(id: string): Promise<ActionState> {
  return run((user) => removePlanItem(user.householdId, id));
}

export async function generateMenuAction(
  input: z.input<typeof generateMenuSchema>,
): Promise<{ ok?: boolean; error?: string; added?: number }> {
  let added = 0;
  const result = await run(async (user) => {
    added = await generateMenu(user.id, user.householdId, input);
    // Les recettes créées par le menu reçoivent leur photo après la réponse.
    fillRecipePhotosLater(user.id, 3);
  });
  return result?.ok ? { ok: true, added } : { error: result?.error ?? "generic" };
}

export async function shoppingFromMenuAction(
  weekStart: string,
): Promise<{ ok?: boolean; error?: string; count?: number }> {
  let count = 0;
  const result = await run(async (user) => {
    count = await shoppingFromMenu(user.householdId, weekStart);
  });
  return result?.ok ? { ok: true, count } : { error: result?.error ?? "generic" };
}

export async function addShoppingItemAction(input: z.input<typeof shoppingItemSchema>): Promise<ActionState> {
  return run((user) => addShoppingItem(user.householdId, input));
}

export async function setShoppingCheckedAction(id: string, checked: boolean): Promise<ActionState> {
  return run((user) => setShoppingChecked(user.householdId, id, checked));
}

export async function clearCheckedShoppingAction(): Promise<ActionState> {
  return run((user) => clearCheckedShopping(user.householdId));
}

export async function fridgeIdeasAction(
  input: z.input<typeof fridgeInputSchema>,
): Promise<{ error?: string; result?: FridgeResult }> {
  const user = await getCurrentUser();
  if (!user) return { error: "generic" };
  try {
    return { result: await fridgeIdeas(user.id, input) };
  } catch (error) {
    return { error: toActionState(error)?.error ?? "generic" };
  }
}

export async function saveIdeaAction(input: z.input<typeof saveIdeaSchema>): Promise<{ error?: string; id?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "generic" };
  try {
    const id = await saveIdeaAsRecipe(user.id, input);
    fillRecipePhotosLater(user.id, 1);
    revalidatePath("/recipes");
    return { id };
  } catch (error) {
    return { error: toActionState(error)?.error ?? "generic" };
  }
}
