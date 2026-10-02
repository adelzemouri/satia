"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { type ActionState, toActionState } from "@/server/action-result";
import {
  addProgressPhoto,
  deleteMeasurement,
  deleteProgressPhoto,
  type measurementSchema,
  type progressPhotoSchema,
  setMeasurement,
} from "@/server/body";
import { getCurrentUser } from "@/server/session";

async function run(fn: (userId: string) => Promise<unknown>): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "generic" };
  try {
    await fn(user.id);
  } catch (error) {
    return toActionState(error);
  }
  revalidatePath("/body");
  return { ok: true };
}

export async function setMeasurementAction(input: z.input<typeof measurementSchema>): Promise<ActionState> {
  return run((userId) => setMeasurement(userId, input));
}

export async function deleteMeasurementAction(date: string, kind: string): Promise<ActionState> {
  return run((userId) => deleteMeasurement(userId, date, kind));
}

export async function addProgressPhotoAction(input: z.input<typeof progressPhotoSchema>): Promise<ActionState> {
  return run((userId) => addProgressPhoto(userId, input));
}

export async function deleteProgressPhotoAction(id: string): Promise<ActionState> {
  return run((userId) => deleteProgressPhoto(userId, id));
}
