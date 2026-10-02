"use server";

import { revalidatePath } from "next/cache";

import { type ActionState, toActionState } from "@/server/action-result";
import { getCurrentUser } from "@/server/session";
import {
  addCustomExercise,
  type customExerciseSchema,
  deleteCustomExercise,
  deleteSession,
  type LogSessionInput,
  logSession,
  personalizeProgram,
  saveTrainingProfile,
  setExerciseExcluded,
  type TrainingProfileInput,
} from "@/server/training";
import type { z } from "zod";

async function run(fn: (userId: string) => Promise<unknown>): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "generic" };
  try {
    await fn(user.id);
  } catch (error) {
    return toActionState(error);
  }
  revalidatePath("/training", "layout");
  revalidatePath("/");
  return { ok: true };
}

export async function saveTrainingProfileAction(input: TrainingProfileInput): Promise<ActionState> {
  return run((userId) => saveTrainingProfile(userId, input));
}

export async function personalizeProgramAction(): Promise<ActionState> {
  return run((userId) => personalizeProgram(userId));
}

export async function setExerciseExcludedAction(exerciseId: string, excluded: boolean): Promise<ActionState> {
  return run((userId) => setExerciseExcluded(userId, exerciseId, excluded));
}

export async function logSessionAction(input: LogSessionInput): Promise<ActionState> {
  return run((userId) => logSession(userId, input));
}

export async function deleteSessionAction(id: string): Promise<ActionState> {
  return run((userId) => deleteSession(userId, id));
}

export async function addCustomExerciseAction(input: z.input<typeof customExerciseSchema>): Promise<ActionState> {
  return run((userId) => addCustomExercise(userId, input));
}

export async function deleteCustomExerciseAction(id: string): Promise<ActionState> {
  return run((userId) => deleteCustomExercise(userId, id));
}
