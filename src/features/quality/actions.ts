"use server";

import { revalidatePath } from "next/cache";

import type { MealSlot } from "@/domain/meals";
import { type ActionState, toActionState } from "@/server/action-result";
import { copyEntries } from "@/server/journal";
import { type checkinSchema, setCheckin } from "@/server/quality";
import { getCurrentUser } from "@/server/session";

import type { z } from "zod";

async function run(fn: (userId: string) => Promise<unknown>): Promise<ActionState> {
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

export async function setCheckinAction(input: z.input<typeof checkinSchema>): Promise<ActionState> {
  return run((userId) => setCheckin(userId, input));
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
