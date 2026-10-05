"use server";

import { revalidatePath } from "next/cache";

import { type ActionState, toActionState } from "@/server/action-result";
import { setGoalLocked } from "@/server/adaptive";
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

export async function setGoalLockedAction(locked: boolean): Promise<ActionState> {
  return run((userId) => setGoalLocked(userId, locked));
}
