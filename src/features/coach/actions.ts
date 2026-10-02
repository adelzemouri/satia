"use server";

import { revalidatePath } from "next/cache";

import type { CoachStyle } from "@/domain/profile";
import { type ActionState, toActionState } from "@/server/action-result";
import { clearCoachMessages, ensureWeeklyReview, sendCoachMessage, setCoachStyle } from "@/server/coach";
import { getCurrentUser } from "@/server/session";

async function run(fn: (userId: string) => Promise<unknown>): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "generic" };
  try {
    await fn(user.id);
  } catch (error) {
    return toActionState(error);
  }
  revalidatePath("/coach");
  return { ok: true };
}

export async function sendCoachMessageAction(text: string): Promise<ActionState> {
  return run((userId) => sendCoachMessage(userId, text));
}

export async function clearCoachMessagesAction(): Promise<ActionState> {
  return run(clearCoachMessages);
}

export async function setCoachStyleAction(style: CoachStyle): Promise<ActionState> {
  return run((userId) => setCoachStyle(userId, style));
}

/** Rédige le bilan de la semaine écoulée s'il manque (au plus un appel au LLM par semaine). */
export async function ensureWeeklyReviewAction(): Promise<ActionState> {
  return run(ensureWeeklyReview);
}
