"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { type ActionState, toActionState } from "@/server/action-result";
import {
  type activitySchema,
  addActivity,
  deleteActivity,
  importActivityCsv,
  type ImportResult,
  setSteps,
  type stepsSchema,
} from "@/server/activity";
import { getCurrentUser } from "@/server/session";

async function run<T>(fn: (userId: string) => Promise<T>): Promise<(ActionState & { result?: T }) | null> {
  const user = await getCurrentUser();
  if (!user) return { error: "generic" };
  let result: T;
  try {
    result = await fn(user.id);
  } catch (error) {
    return toActionState(error);
  }
  // L'activité modifie l'objectif du jour : accueil et journal sont rafraîchis aussi.
  revalidatePath("/[locale]", "layout");
  return { ok: true, result };
}

export async function addActivityAction(input: z.input<typeof activitySchema>): Promise<ActionState> {
  return run((userId) => addActivity(userId, input));
}

export async function deleteActivityAction(id: string): Promise<ActionState> {
  return run((userId) => deleteActivity(userId, id));
}

export async function setStepsAction(input: z.input<typeof stepsSchema>): Promise<ActionState> {
  return run((userId) => setSteps(userId, input));
}

export async function importActivityAction(text: string): Promise<(ActionState & { result?: ImportResult }) | null> {
  return run((userId) => importActivityCsv(userId, String(text)));
}
