"use server";

import { revalidatePath } from "next/cache";

import type { CoachTopic } from "@/domain/coach-topic";
import { type ActionState, toActionState } from "@/server/action-result";
import { clearCoachMessages, ensureWeeklyReview, sendCoachMessage } from "@/server/coach";
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

export type CoachAnswer = { content: string; notice: "floor" | "medical" | "care" | null };

/** Question posée depuis une page (repas, recette, journée) : la réponse revient dans le panneau. */
export async function askCoachAction(
  text: string,
  topic: CoachTopic,
): Promise<{ answer: CoachAnswer } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "generic" };
  try {
    const saved = await sendCoachMessage(user.id, text, topic);
    revalidatePath("/coach");
    return { answer: { content: saved.content, notice: saved.notice } };
  } catch (error) {
    return { error: toActionState(error)?.error ?? "generic" };
  }
}

export async function clearCoachMessagesAction(): Promise<ActionState> {
  return run(clearCoachMessages);
}

/** Rédige le bilan de la semaine écoulée s'il manque (au plus un appel au LLM par semaine). */
export async function ensureWeeklyReviewAction(): Promise<ActionState> {
  return run(ensureWeeklyReview);
}
