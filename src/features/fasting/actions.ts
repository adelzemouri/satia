"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { type ActionState, toActionState } from "@/server/action-result";
import { deleteFast, endFast, type fastingPlanSchema, saveFastingPlan, startFast } from "@/server/fasting";
import { getCurrentUser } from "@/server/session";

async function run(fn: (userId: string) => Promise<unknown>): Promise<ActionState> {
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

export async function saveFastingPlanAction(input: z.input<typeof fastingPlanSchema>): Promise<ActionState> {
  return run((userId) => saveFastingPlan(userId, input));
}

export async function startFastAction(): Promise<ActionState> {
  return run((userId) => startFast(userId));
}

export async function endFastAction(): Promise<ActionState> {
  return run((userId) => endFast(userId));
}

export async function deleteFastAction(id: string): Promise<ActionState> {
  return run((userId) => deleteFast(userId, id));
}
