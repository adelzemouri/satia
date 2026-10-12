import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db/client";
import { notificationLog, pushSubscriptions, user, waterLogs } from "@/db/schema";
import { DEFAULT_NOTIFICATION_PREFS } from "@/domain/notifications";
import type { OnboardingInput } from "@/features/onboarding/schema";
import { setupFirstAdmin } from "@/server/accounts";
import { collectUserData } from "@/server/data-export";
import { searchFoods } from "@/server/foods";
import { addEntry, setWeight } from "@/server/journal";
import {
  getNotificationPrefs,
  type PushPayload,
  removeSubscription,
  runNotifications,
  saveSubscription,
  sendTestNotification,
  setNotificationPrefs,
  setPushSenderForTests,
  subscriptionCount,
} from "@/server/notifications";
import { saveOnboarding } from "@/server/profile";

import { resetDatabase } from "./helpers";

const answers: OnboardingInput = {
  firstName: "Adel",
  sex: "male",
  birthDate: "1988-04-12",
  heightCm: 178,
  weightKg: 82,
  goal: "maintain",
  targetWeightKg: null,
  activityLevel: 2,
  pace: "gentle",
  diet: "omnivore",
  foodsToAvoid: "",
  mealTimes: { breakfast: "07:30", lunch: "12:30", dinner: "20:00" },
  budgetMode: "daily",
  coachStyle: "teacher",
  disclaimerAccepted: true,
};

async function setupUser() {
  await setupFirstAdmin({
    setupToken: process.env.SETUP_TOKEN!,
    householdName: "Famille",
    name: "Adel",
    email: "adel@example.com",
    password: "un-mot-de-passe-solide",
  });
  const [row] = await db().select().from(user).where(eq(user.email, "adel@example.com"));
  await saveOnboarding(row!.id, answers);
  return row!.id;
}

const subscription = (id: string) => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/${id}`,
  keys: { p256dh: `p256dh-${id}`, auth: `auth-${id}` },
});

/** Lundi 28 septembre 2026, heure de Paris (UTC+2). */
const monday = (time: string) => new Date(`2026-09-28T${time}:00+02:00`);

describe("notifications", () => {
  let sent: { endpoint: string; payload: PushPayload }[];
  let status: (endpoint: string) => number;

  beforeEach(async () => {
    await resetDatabase();
    sent = [];
    status = () => 201;
    setPushSenderForTests(async (target, payload) => {
      sent.push({ endpoint: target.endpoint, payload });
      return status(target.endpoint);
    });
  });
  afterEach(() => setPushSenderForTests(null));

  it("enregistre un appareil par abonnement et les préférences", async () => {
    const userId = await setupUser();
    expect(await getNotificationPrefs(userId)).toEqual(DEFAULT_NOTIFICATION_PREFS);
    await saveSubscription(userId, subscription("a"), "Firefox");
    await saveSubscription(userId, subscription("a"), "Firefox mis à jour");
    await saveSubscription(userId, subscription("b"), null);
    expect(await subscriptionCount(userId)).toBe(2);
    await removeSubscription(userId, subscription("b").endpoint);
    expect(await subscriptionCount(userId)).toBe(1);
    // Le serveur n'envoie de requêtes qu'aux services push des navigateurs.
    for (const endpoint of [
      "https://example.com/hook",
      "http://fcm.googleapis.com/x",
      "https://fcm.googleapis.com.evil.io/x",
    ]) {
      await expect(saveSubscription(userId, { ...subscription("c"), endpoint }, null)).rejects.toThrow();
    }
    expect(await subscriptionCount(userId)).toBe(1);

    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, water: false, quietStart: "21:30" };
    await setNotificationPrefs(userId, prefs);
    expect(await getNotificationPrefs(userId)).toEqual(prefs);
    await expect(setNotificationPrefs(userId, { ...prefs, quietEnd: "25:00" })).rejects.toThrow();

    const data = await collectUserData(userId);
    expect(data.pushDevices).toEqual([{ userAgent: "Firefox mis à jour", createdAt: expect.any(Date) }]);
    expect(JSON.stringify(data)).not.toContain("auth-a");
  });

  it("envoie un rappel de repas une seule fois, sur chaque appareil, dans la langue de la personne", async () => {
    const userId = await setupUser();
    await saveSubscription(userId, subscription("a"), null);
    await saveSubscription(userId, subscription("b"), null);
    await db().insert(waterLogs).values({ userId, date: "2026-09-28", glasses: 8 });

    expect(await runNotifications(monday("12:45"), "https://pommelia.example")).toEqual({ sent: 0 });
    expect(await runNotifications(monday("13:05"), "https://pommelia.example")).toEqual({ sent: 2 });
    expect(sent.map((entry) => entry.payload)).toEqual([
      {
        title: "Ton déjeuner",
        body: "Pense à noter ton déjeuner quand tu as un moment.",
        url: "/add?slot=lunch",
        tag: "meal-lunch",
      },
      expect.objectContaining({ tag: "meal-lunch" }),
    ]);
    expect(await runNotifications(monday("13:20"), "https://pommelia.example")).toEqual({ sent: 0 });

    await db().update(user).set({ locale: "en" }).where(eq(user.id, userId));
    await runNotifications(monday("20:35"), "https://pommelia.example");
    expect(sent.at(-1)!.payload.title).toBe("Your dinner");
  });

  it("ne rappelle pas un repas déjà noté ni pendant la plage silencieuse", async () => {
    const userId = await setupUser();
    await saveSubscription(userId, subscription("a"), null);
    await db().insert(waterLogs).values({ userId, date: "2026-09-28", glasses: 8 });
    const [bread] = await searchFoods(userId, "pain baguette");
    await addEntry(userId, { date: "2026-09-28", slot: "lunch", foodId: bread!.id, quantity: 60, unit: "g" });
    expect(await runNotifications(monday("13:05"), "https://pommelia.example")).toEqual({ sent: 0 });

    await setNotificationPrefs(userId, { ...DEFAULT_NOTIFICATION_PREFS, quietStart: "19:00", quietEnd: "07:00" });
    expect(await runNotifications(monday("20:35"), "https://pommelia.example")).toEqual({ sent: 0 });
  });

  it("rappelle de boire et annonce le bilan quand la semaine écoulée a assez de jours", async () => {
    const userId = await setupUser();
    await saveSubscription(userId, subscription("a"), null);
    const [bread] = await searchFoods(userId, "pain baguette");
    for (const date of ["2026-09-21", "2026-09-22", "2026-09-24", "2026-09-28"]) {
      await addEntry(userId, { date, slot: "breakfast", foodId: bread!.id, quantity: 60, unit: "g" });
    }
    await runNotifications(monday("11:10"), "https://pommelia.example");
    // Lundi : c'est aussi le jour de pesée par défaut.
    expect(sent.map((entry) => entry.payload.tag).sort()).toEqual(["ritual-weigh", "water", "weekly-review"]);
    expect(sent.find((entry) => entry.payload.tag === "water")!.payload.body).toBe(
      "0 verre(s) sur 8 pour l'instant. Un petit verre maintenant ?",
    );
    expect(sent.find((entry) => entry.payload.tag === "weekly-review")!.payload.url).toBe("/coach");
  });

  it("rappelle la pesée le jour choisi, une fois, sauf si elle est faite", async () => {
    const userId = await setupUser();
    await saveSubscription(userId, subscription("a"), null);
    const rituals = () => sent.map((entry) => entry.payload).filter((payload) => payload.tag.startsWith("ritual"));
    await runNotifications(monday("09:00"), "https://pommelia.example");
    expect(rituals()).toEqual([
      expect.objectContaining({ title: "C'est ton jour de pesée", url: "/", tag: "ritual-weigh" }),
    ]);
    await runNotifications(monday("10:00"), "https://pommelia.example");
    expect(rituals()).toHaveLength(1);

    // Le lundi suivant, déjà pesé : pas de rappel.
    await setWeight(userId, { date: "2026-10-05", weightKg: 70 });
    await runNotifications(new Date("2026-10-05T09:00:00+02:00"), "https://pommelia.example");
    expect(rituals()).toHaveLength(1);
  });

  it("supprime un abonnement expiré et purge le journal après 30 jours", async () => {
    const userId = await setupUser();
    await saveSubscription(userId, subscription("old"), null);
    await saveSubscription(userId, subscription("ok"), null);
    status = (endpoint) => (endpoint.endsWith("/old") ? 410 : 201);
    await db()
      .insert(notificationLog)
      .values({ userId, kind: "meal", key: "2026-08-01:lunch", sentAt: new Date("2026-08-01T12:00:00Z") });

    expect(await sendTestNotification(userId, "https://pommelia.example")).toBe(1);
    expect(sent[0]!.payload).toMatchObject({ title: "Pommelia", url: "/profile" });
    const left = await db().select({ endpoint: pushSubscriptions.endpoint }).from(pushSubscriptions);
    expect(left).toEqual([{ endpoint: subscription("ok").endpoint }]);

    await runNotifications(monday("03:00"), "https://pommelia.example");
    expect(await db().select().from(notificationLog)).toEqual([]);
  });
});
