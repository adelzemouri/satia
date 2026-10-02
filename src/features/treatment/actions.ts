"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { type ActionState, toActionState } from "@/server/action-result";
import { getCurrentUser } from "@/server/session";
import {
  addTreatment,
  deleteTreatment,
  deleteTreatmentLog,
  logTreatment,
  type treatmentLogSchema,
  type treatmentSchema,
} from "@/server/treatment";

async function run(fn: (userId: string) => Promise<unknown>): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "generic" };
  try {
    await fn(user.id);
  } catch (error) {
    return toActionState(error);
  }
  revalidatePath("/treatment");
  return { ok: true };
}

export async function addTreatmentAction(input: z.input<typeof treatmentSchema>): Promise<ActionState> {
  return run((userId) => addTreatment(userId, input));
}

export async function deleteTreatmentAction(id: string): Promise<ActionState> {
  return run((userId) => deleteTreatment(userId, id));
}

export async function logTreatmentAction(input: z.input<typeof treatmentLogSchema>): Promise<ActionState> {
  return run((userId) => logTreatment(userId, input));
}

export async function deleteTreatmentLogAction(id: string): Promise<ActionState> {
  return run((userId) => deleteTreatmentLog(userId, id));
}
