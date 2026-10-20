"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { type ActionState, toActionState } from "@/server/action-result";
import { type FeedbackInput, sendFeedback, setFeedbackHandled } from "@/server/feedback";
import { publicOrigin } from "@/server/request";
import { getCurrentUser } from "@/server/session";

export async function sendFeedbackAction(input: FeedbackInput): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "generic" };
  try {
    const userAgent = (await headers()).get("user-agent");
    await sendFeedback(user.id, input, { userAgent, origin: await publicOrigin() });
  } catch (error) {
    return toActionState(error);
  }
  revalidatePath("/admin");
  return { ok: true };
}

export async function setFeedbackHandledAction(id: string, handled: boolean): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { error: "generic" };
  try {
    await setFeedbackHandled(user.householdId, id, handled);
  } catch (error) {
    return toActionState(error);
  }
  revalidatePath("/admin");
  revalidatePath("/profile");
  return { ok: true };
}
