"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import type { NotificationPrefs } from "@/domain/notifications";
import { type ActionState, toActionState } from "@/server/action-result";
import {
  type PushSubscriptionInput,
  removeSubscription,
  saveSubscription,
  sendTestNotification,
  setNotificationPrefs,
} from "@/server/notifications";
import { enforceRateLimit } from "@/server/rate-limit";
import { publicOrigin } from "@/server/request";
import { getCurrentUser } from "@/server/session";

async function run(fn: (userId: string) => Promise<unknown>): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "generic" };
  try {
    await fn(user.id);
  } catch (error) {
    return toActionState(error);
  }
  revalidatePath("/profile");
  return { ok: true };
}

export async function savePushSubscriptionAction(subscription: PushSubscriptionInput): Promise<ActionState> {
  const userAgent = (await headers()).get("user-agent");
  return run((userId) => saveSubscription(userId, subscription, userAgent));
}

export async function removePushSubscriptionAction(endpoint: string): Promise<ActionState> {
  return run((userId) => removeSubscription(userId, endpoint));
}

export async function setNotificationPrefsAction(prefs: NotificationPrefs): Promise<ActionState> {
  return run((userId) => setNotificationPrefs(userId, prefs));
}

export async function sendTestNotificationAction(): Promise<ActionState> {
  const origin = await publicOrigin();
  return run(async (userId) => {
    await enforceRateLimit(`push:test:${userId}`, { window: 60, max: 3 });
    await sendTestNotification(userId, origin);
  });
}
