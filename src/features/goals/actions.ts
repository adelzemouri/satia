"use server";

import { revalidatePath } from "next/cache";

import { type ActionState, toActionState } from "@/server/action-result";
import {
  type GoalChange,
  type GoalProposal,
  proposeGoal,
  setAutomaticCalories,
  setManualCalories,
  updateGoal,
} from "@/server/goal-settings";
import { getCurrentUser } from "@/server/session";

async function run(fn: (userId: string) => Promise<void>): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "generic" };
  try {
    await fn(user.id);
  } catch (error) {
    return toActionState(error);
  }
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

/** Calories qu'entraînerait le changement, sans rien enregistrer. */
export async function proposeGoalAction(change: GoalChange): Promise<GoalProposal | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  try {
    return (await proposeGoal(user.id, change)).proposal;
  } catch {
    return null;
  }
}

export async function updateGoalAction(change: GoalChange): Promise<ActionState> {
  return run((userId) => updateGoal(userId, change));
}

export async function setManualCaloriesAction(kcal: number): Promise<ActionState> {
  return run((userId) => setManualCalories(userId, kcal));
}

export async function setAutomaticCaloriesAction(): Promise<ActionState> {
  return run((userId) => setAutomaticCalories(userId));
}
