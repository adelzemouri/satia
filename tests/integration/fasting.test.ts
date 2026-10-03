import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db/client";
import { fasts, pushSubscriptions, treatmentLogs, user } from "@/db/schema";
import { DEFAULT_FASTING_PLAN, type FastingPlan } from "@/domain/fasting";
import { DEFAULT_NOTIFICATION_PREFS } from "@/domain/notifications";
import type { OnboardingInput } from "@/features/onboarding/schema";
import { setupFirstAdmin } from "@/server/accounts";
import { collectUserData } from "@/server/data-export";
import { currentFast, endFast, fastingOverview, saveFastingPlan, startFast } from "@/server/fasting";
import {
  type PushPayload,
  runNotifications,
  saveSubscription,
  setNotificationPrefs,
  setPushSenderForTests,
} from "@/server/notifications";
import { saveOnboarding } from "@/server/profile";
import {
  addTreatment,
  deleteTreatment,
  logTreatment,
  treatmentOverview,
  treatmentRemindersOn,
} from "@/server/treatment";

import { resetDatabase } from "./helpers";

const answers: OnboardingInput = {
  firstName: "Adel",
  sex: "male",
  birthDate: "1988-04-12",
  heightCm: 178,
  weightKg: 80,
  goal: "maintain",
  targetWeightKg: null,
  activityLevel: 2,
  pace: "gentle",
  diet: "omnivore",
  foodsToAvoid: "",
  mealTimes: { breakfast: "07:30", lunch: "12:30", dinner: "20:00" },
  budgetMode: "daily",
  coachStyle: "zen",
  disclaimerAccepted: true,
};

async function setupUser(birthDate = answers.birthDate) {
  await setupFirstAdmin({
    setupToken: process.env.SETUP_TOKEN!,
    householdName: "Famille",
    name: "Adel",
    email: "adel@example.com",
    password: "un-mot-de-passe-solide",
  });
  const [row] = await db().select().from(user).where(eq(user.email, "adel@example.com"));
  await saveOnboarding(row!.id, { ...answers, birthDate });
  return row!.id;
}

/** 16:8 tous les jours, début à 20 h (heure de Paris). */
const everyDay: FastingPlan = {
  ...DEFAULT_FASTING_PLAN,
  enabled: true,
  autoStart: true,
  days: Array.from({ length: 7 }, () => ({ protocol: "16:8" as const, start: "20:00" })),
};

/** Vendredi 2 octobre 2026, heure de Paris (UTC+2). */
const friday = (time: string) => new Date(`2026-10-02T${time}:00+02:00`);

describe("jeûne et traitement", () => {
  beforeEach(resetDatabase);
  afterEach(() => setPushSenderForTests(null));

  it("démarrage automatique : la fenêtre du planning s'ouvre une seule fois et se referme à la fin prévue", async () => {
    const userId = await setupUser();
    await saveFastingPlan(userId, everyDay);

    const morning = await fastingOverview(userId, friday("09:00"));
    expect(morning.current).toMatchObject({
      startedAt: "2026-10-01T18:00:00.000Z",
      targetMinutes: 960,
      protocol: "16:8",
      source: "auto",
    });
    await fastingOverview(userId, friday("09:30"));
    expect(await db().select().from(fasts)).toHaveLength(1);

    const noon = await fastingOverview(userId, friday("12:30"));
    expect(noon.current).toBeNull();
    expect(noon.history).toEqual([
      expect.objectContaining({ startedAt: "2026-10-01T18:00:00.000Z", endedAt: "2026-10-02T10:00:00.000Z" }),
    ]);
    expect(noon.next?.start).toBe("2026-10-02T18:00:00.000Z");
    expect(noon.stats.completedLast7).toBe(1);
  });

  it("un jeûne arrêté plus tôt n'est pas relancé dans la même fenêtre", async () => {
    const userId = await setupUser();
    await saveFastingPlan(userId, everyDay);
    await fastingOverview(userId, friday("08:00"));
    await endFast(userId, friday("08:15"));
    const later = await fastingOverview(userId, friday("09:00"));
    expect(later.current).toBeNull();
    expect(later.history).toHaveLength(1);
    expect(await currentFast(userId, friday("09:00"))).toBeNull();
  });

  it("jeûne manuel : un seul à la fois, avec le protocole du jour", async () => {
    const userId = await setupUser();
    await startFast(userId, friday("13:00"));
    await expect(startFast(userId, friday("13:05"))).rejects.toThrow("fast_running");
    const overview = await fastingOverview(userId, friday("14:00"));
    expect(overview.current).toMatchObject({ targetMinutes: 14 * 60, source: "manual" });
    await endFast(userId, friday("15:00"));
    await expect(endFast(userId, friday("15:01"))).rejects.toThrow("not_found");
  });

  it("le jeûne n'est pas proposé avant 18 ans", async () => {
    const minor = await setupUser("2012-03-01");
    expect((await fastingOverview(minor)).allowed).toBe(false);
    await expect(saveFastingPlan(minor, everyDay)).rejects.toThrow("fasting_minor");
    await expect(startFast(minor)).rejects.toThrow("fasting_minor");
  });

  it("valide la durée du protocole perso", async () => {
    const userId = await setupUser();
    await expect(saveFastingPlan(userId, { ...everyDay, customHours: 24 })).rejects.toThrow("fasting_hours");
  });

  it("traitement : journal des prises, rappels et suivi arrêté sans perdre l'historique", async () => {
    const userId = await setupUser();
    await expect(addTreatment(userId, { name: "Injection", reminderTime: "09:00", reminderDays: [] })).rejects.toThrow(
      "treatment_days_required",
    );
    const id = await addTreatment(userId, { name: "Injection", reminderTime: "09:00", reminderDays: [4, 4] });
    expect(await treatmentRemindersOn(userId, "2026-10-02", 4)).toEqual([
      { id, name: "Injection", time: "09:00", taken: false },
    ]);
    await logTreatment(userId, { treatmentId: id, name: "", date: "2026-10-02", time: "09:05", note: "cuisse" });
    expect((await treatmentRemindersOn(userId, "2026-10-02", 4))[0]?.taken).toBe(true);
    await expect(
      logTreatment(userId, { treatmentId: null, name: " ", date: "2026-10-02", time: "10:00", note: "" }),
    ).rejects.toThrow("treatment_name_required");
    await logTreatment(userId, { treatmentId: null, name: "Vitamine D", date: "2026-10-01", time: "08:00", note: "" });

    await deleteTreatment(userId, id);
    const overview = await treatmentOverview(userId);
    expect(overview.treatments).toEqual([]);
    expect(overview.logs.map((log) => [log.name, log.treatmentId, log.note])).toEqual([
      ["Injection", null, "cuisse"],
      ["Vitamine D", null, null],
    ]);
    const data = await collectUserData(userId);
    expect(data.treatmentLogs).toHaveLength(2);
    expect(Object.keys(data.treatmentLogs[0]!)).not.toContain("dose");
  });

  it("rappels : début de jeûne et traitement envoyés une seule fois, selon les préférences", async () => {
    const userId = await setupUser();
    await saveFastingPlan(userId, everyDay);
    await setNotificationPrefs(userId, { ...DEFAULT_NOTIFICATION_PREFS, meals: false, water: false });
    await saveSubscription(userId, { endpoint: "https://push.example.com/a", keys: { p256dh: "p", auth: "a" } }, null);
    await addTreatment(userId, { name: "Injection", reminderTime: "09:00", reminderDays: [4] });
    const sent: PushPayload[] = [];
    setPushSenderForTests(async (_target, payload) => (sent.push(payload), 201));

    await runNotifications(friday("09:10"), "https://pommelia.example");
    await runNotifications(friday("09:25"), "https://pommelia.example");
    await runNotifications(friday("12:10"), "https://pommelia.example");
    await runNotifications(friday("20:05"), "https://pommelia.example");
    expect(sent.map((payload) => payload.url)).toEqual(["/treatment", "/fasting", "/fasting"]);
    expect(sent[0]!.body).toContain("Injection");
    expect(sent[1]!.title).toBe("Ta fenêtre de repas s'ouvre");
    expect(sent[2]!.title).toBe("Ta fenêtre de jeûne commence");

    await setNotificationPrefs(userId, { ...DEFAULT_NOTIFICATION_PREFS, fasting: false, treatment: false });
    await db().delete(treatmentLogs);
    sent.length = 0;
    await runNotifications(new Date("2026-10-09T20:05:00+02:00"), "https://pommelia.example");
    await runNotifications(new Date("2026-10-09T09:10:00+02:00"), "https://pommelia.example");
    expect(sent.filter((payload) => payload.url !== "/add?slot=breakfast")).toEqual([]);
    expect(await db().select().from(pushSubscriptions)).toHaveLength(1);
  });
});
