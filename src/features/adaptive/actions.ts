"use server";

import { revalidatePath } from "next/cache";

import type { BudgetMode } from "@/domain/profile";
import { type ActionState, toActionState } from "@/server/action-result";
import { setBudgetMode, setGoalLocked, setLargerDay } from "@/server/adaptive";
import { getCurrentUser } from "@/server/session";

async function run(fn: (userId: string) => Promise<void>): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "generic" };
  try {
    await fn(user.id);
  } catch (error) {
    return toActionState(error);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setBudgetModeAction(mode: BudgetMode): Promise<ActionState> {
  return run((userId) => setBudgetMode(userId, mode));
}

export async function setGoalLockedAction(locked: boolean): Promise<ActionState> {
  return run((userId) => setGoalLocked(userId, locked));
}

export async function setLargerDayAction(date: string, larger: boolean): Promise<ActionState> {
  return run((userId) => setLargerDay(userId, date, larger));
}
