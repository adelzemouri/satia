import "server-only";

import { and, eq, inArray, lt, sql } from "drizzle-orm";
import webpush from "web-push";
import { z } from "zod";

import { APP_TIMEZONE } from "@/config/app";
import { db } from "@/db/client";
import { mealEntries, notificationLog, profiles, pushSubscriptions, user } from "@/db/schema";
import { addDays } from "@/domain/energy";
import { fastEventsOn } from "@/domain/fasting";
import {
  dueReminders,
  localClock,
  type NotificationPrefs,
  type Reminder,
  withDefaultPrefs,
} from "@/domain/notifications";
import { ritualsToNotify } from "@/domain/rituals";
import { isoWeekStart } from "@/domain/streak";
import en from "@/i18n/messages/en.json";
import fr from "@/i18n/messages/fr.json";

import { env } from "./env";
import { DomainError } from "./errors";
import { fastingAllowed, getFastingPlan } from "./fasting";
import { ritualDates } from "./rituals";
import { mealWaterGlasses, waterOn } from "./journal";
import { treatmentRemindersOn } from "./treatment";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const notificationPrefsSchema = z.object({
  meals: z.boolean(),
  water: z.boolean(),
  weeklyReview: z.boolean(),
  fasting: z.boolean(),
  treatment: z.boolean(),
  weighIn: z.boolean(),
  weighDay: z.number().int().min(1).max(7),
  measurements: z.boolean(),
  progressPhoto: z.boolean(),
  quietStart: time,
  quietEnd: time,
});

/** Services push des navigateurs (Google, Apple, Mozilla, Microsoft) : le serveur n'écrit qu'à eux. */
const PUSH_SERVICE_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "push.apple.com",
  "push.services.mozilla.com",
  "notify.windows.com",
];

export function isPushServiceUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username !== "" || url.password !== "") return false;
  return PUSH_SERVICE_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
}

export const pushSubscriptionSchema = z.object({
  endpoint: z.url().max(2000).refine(isPushServiceUrl, "push_service"),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});
export type PushSubscriptionInput = z.input<typeof pushSubscriptionSchema>;

export function vapidPublicKey(): string | null {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = env();
  return VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY ? VAPID_PUBLIC_KEY : null;
}

export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs | null> {
  const [row] = await db()
    .select({ prefs: profiles.notificationPrefs })
    .from(profiles)
    .where(eq(profiles.userId, userId));
  return row ? withDefaultPrefs(row.prefs) : null;
}

export async function setNotificationPrefs(userId: string, prefs: NotificationPrefs): Promise<void> {
  await db()
    .update(profiles)
    .set({ notificationPrefs: notificationPrefsSchema.parse(prefs), updatedAt: new Date() })
    .where(eq(profiles.userId, userId));
}

/** Enregistre l'abonnement de cet appareil (un appareil passé à un autre compte change de main). */
export async function saveSubscription(
  userId: string,
  input: PushSubscriptionInput,
  userAgent: string | null,
): Promise<void> {
  const { endpoint, keys } = pushSubscriptionSchema.parse(input);
  const values = { userId, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent?.slice(0, 300) ?? null };
  await db()
    .insert(pushSubscriptions)
    .values({ endpoint, ...values })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values });
}

export async function removeSubscription(userId: string, endpoint: string): Promise<void> {
  await db()
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

export async function subscriptionCount(userId: string): Promise<number> {
  const [row] = await db()
    .select({ count: sql<number>`count(*)::int` })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  return row?.count ?? 0;
}

// --- Envoi ---------------------------------------------------------------------------

export type PushPayload = { title: string; body: string; url: string; tag: string };
type Subscription = { endpoint: string; p256dh: string; auth: string };
/** Renvoie le code HTTP du service de push. */
export type PushSender = (subscription: Subscription, payload: PushPayload) => Promise<number>;

let senderForTests: PushSender | null = null;

/** Tests : remplace l'envoi réel (aucun appel réseau). */
export function setPushSenderForTests(sender: PushSender | null): void {
  senderForTests = sender;
}

function webPushSender(subject: string): PushSender {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = env();
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) throw new DomainError("push_not_configured");
  const vapidDetails = {
    subject: env().VAPID_SUBJECT ?? subject,
    publicKey: VAPID_PUBLIC_KEY,
    privateKey: VAPID_PRIVATE_KEY,
  };
  return async (subscription, payload) => {
    try {
      const result = await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify(payload),
        { vapidDetails, TTL: 3600, urgency: "normal" },
      );
      return result.statusCode;
    } catch (error) {
      if (error instanceof webpush.WebPushError) return error.statusCode;
      throw error;
    }
  };
}

/** Envoie à tous les appareils d'un utilisateur ; les abonnements expirés sont supprimés. */
async function sendToUser(userId: string, payload: PushPayload, sender: PushSender): Promise<number> {
  const subscriptions = await db()
    .select({ endpoint: pushSubscriptions.endpoint, p256dh: pushSubscriptions.p256dh, auth: pushSubscriptions.auth })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  let delivered = 0;
  const expired: string[] = [];
  for (const subscription of subscriptions) {
    const status = await sender(subscription, payload).catch(() => 0);
    if (status === 404 || status === 410) expired.push(subscription.endpoint);
    else if (status >= 200 && status < 300) delivered += 1;
  }
  if (expired.length > 0) await db().delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, expired));
  return delivered;
}

const MESSAGES = { fr: fr.notifications.push, en: en.notifications.push };
type Locale = keyof typeof MESSAGES;

function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

export function reminderPayload(reminder: Reminder, locale: Locale): PushPayload {
  const m = MESSAGES[locale];
  switch (reminder.kind) {
    case "meal":
      return {
        title: m.meal[reminder.slot].title,
        body: m.meal[reminder.slot].body,
        url: `/add?slot=${reminder.slot}`,
        tag: `meal-${reminder.slot}`,
      };
    case "water":
      return {
        title: m.water.title,
        body: format(m.water.body, { glasses: reminder.glasses, goal: reminder.goal }),
        url: "/",
        tag: "water",
      };
    case "weekly_review":
      return { title: m.weeklyReview.title, body: m.weeklyReview.body, url: "/coach", tag: "weekly-review" };
    case "fast_start":
      return { title: m.fastStart.title, body: m.fastStart.body, url: "/fasting", tag: "fasting" };
    case "fast_end":
      return { title: m.fastEnd.title, body: m.fastEnd.body, url: "/fasting", tag: "fasting" };
    case "treatment":
      return {
        title: m.treatment.title,
        body: format(m.treatment.body, { name: reminder.name }),
        url: "/treatment",
        tag: `treatment-${reminder.key}`,
      };
    case "ritual":
      return {
        title: m.ritual[reminder.ritual].title,
        body: m.ritual[reminder.ritual].body,
        url: "/",
        tag: `ritual-${reminder.ritual}`,
      };
  }
}

export async function sendTestNotification(userId: string, origin: string): Promise<number> {
  const [row] = await db().select({ locale: user.locale }).from(user).where(eq(user.id, userId));
  const m = MESSAGES[row?.locale ?? "fr"];
  return sendToUser(
    userId,
    { title: m.test.title, body: m.test.body, url: "/profile", tag: "test" },
    senderForTests ?? webPushSender(origin),
  );
}

/** Au moins 3 jours saisis la semaine écoulée : le bilan du coach pourra être rédigé. */
const REVIEW_MIN_DAYS = 3;

/**
 * Tâche planifiée (toutes les 15 minutes environ) : calcule les rappels dus pour chaque
 * personne abonnée et les envoie une seule fois. Renvoie le nombre de notifications délivrées.
 */
export async function runNotifications(now: Date, origin: string): Promise<{ sent: number }> {
  const { date, time, weekday } = localClock(now, APP_TIMEZONE);
  const weekStart = isoWeekStart(date);
  const lastWeek = addDays(weekStart, -7);
  await db()
    .delete(notificationLog)
    .where(lt(notificationLog.sentAt, new Date(now.getTime() - 30 * 86_400_000)));

  const people = await db()
    .selectDistinct({
      userId: profiles.userId,
      locale: user.locale,
      prefs: profiles.notificationPrefs,
      mealTimes: profiles.mealTimes,
      waterGoal: profiles.waterGoalGlasses,
    })
    .from(profiles)
    .innerJoin(user, eq(user.id, profiles.userId))
    .innerJoin(pushSubscriptions, eq(pushSubscriptions.userId, profiles.userId));
  if (people.length === 0) return { sent: 0 };
  const sender = senderForTests ?? webPushSender(origin);

  let sent = 0;
  for (const person of people) {
    const prefs = withDefaultPrefs(person.prefs);
    const wantsRituals = prefs.weighIn || prefs.measurements || prefs.progressPhoto;
    const [slots, water, reviewDays, fastEvents, treatments, rituals] = await Promise.all([
      db()
        .selectDistinct({ slot: mealEntries.slot })
        .from(mealEntries)
        .where(and(eq(mealEntries.userId, person.userId), eq(mealEntries.date, date))),
      Promise.all([waterOn(person.userId, date), mealWaterGlasses(person.userId, date)]),
      weekday === 1 && prefs.weeklyReview
        ? db()
            .select({ count: sql<number>`count(distinct ${mealEntries.date})::int` })
            .from(mealEntries)
            .where(
              and(
                eq(mealEntries.userId, person.userId),
                sql`${mealEntries.date} between ${lastWeek} and ${addDays(lastWeek, 6)}`,
              ),
            )
        : [{ count: 0 }],
      prefs.fasting
        ? Promise.all([getFastingPlan(person.userId), fastingAllowed(person.userId)]).then(([plan, allowed]) =>
            allowed ? fastEventsOn(plan, date) : [],
          )
        : [],
      prefs.treatment ? treatmentRemindersOn(person.userId, date, weekday - 1) : [],
      wantsRituals
        ? ritualDates(person.userId, date).then((dates) => ritualsToNotify({ today: date, prefs, ...dates }))
        : [],
    ]);
    const due = dueReminders({
      date,
      time,
      weekday,
      weekStart,
      prefs,
      mealTimes: person.mealTimes,
      loggedSlots: new Set(slots.map((row) => row.slot)),
      waterGlasses: water[0] + water[1],
      waterGoal: person.waterGoal,
      reviewReady: (reviewDays[0]?.count ?? 0) >= REVIEW_MIN_DAYS,
      fastEvents,
      treatments,
      rituals,
    });
    for (const reminder of due) {
      // Le journal est écrit avant l'envoi : deux passages simultanés n'envoient qu'une fois.
      const claimed = await db()
        .insert(notificationLog)
        .values({ userId: person.userId, kind: reminder.kind, key: reminder.key, sentAt: now })
        .onConflictDoNothing()
        .returning({ key: notificationLog.key });
      if (claimed.length === 0) continue;
      sent += await sendToUser(person.userId, reminderPayload(reminder, person.locale), sender);
    }
  }
  return { sent };
}

/** Pour l'export : appareils abonnés (sans les clés) et préférences. */
export async function notificationExport(userId: string) {
  return db()
    .select({ userAgent: pushSubscriptions.userAgent, createdAt: pushSubscriptions.createdAt })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
}
