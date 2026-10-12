"use server";

import { revalidatePath } from "next/cache";

import type { MealSlot } from "@/domain/meals";
import { type ActionState, toActionState } from "@/server/action-result";
import { copyEntries } from "@/server/journal";
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

/** Ajoute le repas habituel : copie du dernier jour où il a été saisi. */
export async function addHabitualMealAction(input: {
  fromDate: string;
  slot: MealSlot;
  toDate: string;
}): Promise<ActionState> {
  return run((userId) =>
    copyEntries(userId, { fromDate: input.fromDate, fromSlot: input.slot, toDate: input.toDate, toSlot: input.slot }),
  );
}
