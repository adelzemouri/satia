import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db/client";
import { activities, dailySteps, progressPhotos, user } from "@/db/schema";
import { addDays } from "@/domain/energy";
import { todayIso } from "@/domain/dates";
import type { OnboardingInput } from "@/features/onboarding/schema";
import { acceptInvite, createAccessLink, deleteUser, setupFirstAdmin } from "@/server/accounts";
import { activityOverview, addActivity, deleteActivity, importActivityCsv, setSteps } from "@/server/activity";
import {
  addProgressPhoto,
  deleteMeasurement,
  deleteProgressPhoto,
  measurementOverview,
  progressPhotoOverview,
  setMeasurement,
} from "@/server/body";
import { collectUserData } from "@/server/data-export";
import { daySummary, setWeight } from "@/server/journal";
import { saveOnboarding } from "@/server/profile";

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
  disclaimerAccepted: true,
};

const today = todayIso();
const yesterday = addDays(today, -1);
const JPEG_BASE64 = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]).toString("base64");

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
  return row!;
}

async function inviteMember(householdId: string, createdBy: string) {
  const token = await createAccessLink({ kind: "invite", householdId, createdBy, role: "member", label: "x" });
  await acceptInvite({ token, name: "Léo", email: "leo@example.com", password: "mot-de-passe-de-leo" });
  const [row] = await db().select().from(user).where(eq(user.email, "leo@example.com"));
  await saveOnboarding(row!.id, { ...answers, firstName: "Léo" });
  return row!.id;
}

describe("corps et activité", () => {
  beforeEach(resetDatabase);

  it("mensurations : une valeur par jour et par tour, évolution depuis la première", async () => {
    const { id } = await setupUser();
    await setMeasurement(id, { date: yesterday, kind: "waist", valueCm: 92.04 });
    await setMeasurement(id, { date: today, kind: "waist", valueCm: 91 });
    await setMeasurement(id, { date: today, kind: "waist", valueCm: 90.5 });
    const overview = await measurementOverview(id);
    expect(overview.changes).toEqual([{ kind: "waist", first: 92, latest: 90.5, latestDate: today, change: -1.5 }]);
    expect(overview.history).toHaveLength(2);

    await expect(setMeasurement(id, { date: today, kind: "hips", valueCm: 4 })).rejects.toThrow("measurement_range");
    await expect(setMeasurement(id, { date: addDays(today, 1), kind: "hips", valueCm: 100 })).rejects.toThrow(
      "future_date",
    );
    await deleteMeasurement(id, yesterday, "waist");
    expect((await measurementOverview(id)).changes[0]).toMatchObject({ first: 90.5, change: 0 });
  });

  it("activité : calories calculées côté serveur avec le dernier poids, ajoutées à l'objectif du jour", async () => {
    const { id } = await setupUser();
    const before = await daySummary(id, today);
    await setWeight(id, { date: today, weightKg: 70 });
    const reference = await daySummary(id, today);

    await addActivity(id, { date: today, type: "walking", intensity: "moderate", durationMin: 60 });
    const [row] = await db().select().from(activities);
    expect(row).toMatchObject({ kcal: 245, source: "manual" });

    // 10 000 pas au niveau d'activité 2 (seuil 5 000) : 5 000 × 0,0005 × 70 = 175 kcal.
    await setSteps(id, { date: today, steps: 10_000 });
    const after = await daySummary(id, today);
    expect(after.activity).toEqual({ burnedKcal: 245 + 175, steps: 10_000 });
    expect(after.goal!.kcal).toBe(reference.goal!.kcal + 420);
    expect(after.goal!.carbsG).toBeGreaterThan(reference.goal!.carbsG);
    expect(before.activity).toEqual({ burnedKcal: 0, steps: 0 });

    // Zéro pas efface la saisie ; un membre ne supprime pas l'activité d'un autre.
    await setSteps(id, { date: today, steps: 0 });
    expect(await db().select().from(dailySteps)).toEqual([]);
    await expect(addActivity(id, { date: today, type: "running", intensity: "light", durationMin: 0 })).rejects.toThrow(
      "duration_range",
    );
    await deleteActivity("00000000-0000-4000-8000-000000000000", row!.id);
    expect(await db().select().from(activities)).toHaveLength(1);
    await deleteActivity(id, row!.id);
    expect((await activityOverview(id)).activities).toEqual([]);
  });

  it("import CSV : pas et activités, un second import remplace le premier sans toucher aux saisies manuelles", async () => {
    const { id } = await setupUser();
    await addActivity(id, { date: yesterday, type: "dancing", intensity: "light", durationMin: 30 });
    const csv = [
      "Date;Type d'activité;Durée;Pas",
      `${yesterday};Course à pied;00:30:00;12000`,
      `${today};;;6500`,
      "pas une date;Vélo;20;",
    ].join("\n");
    expect(await importActivityCsv(id, csv)).toEqual({ days: 2, activities: 1, skipped: 1 });
    expect(await importActivityCsv(id, csv)).toEqual({ days: 2, activities: 1, skipped: 1 });

    const overview = await activityOverview(id, today);
    expect(overview.steps).toEqual([
      { date: yesterday, steps: 12_000 },
      { date: today, steps: 6500 },
    ]);
    expect(overview.activities.map((activity) => [activity.type, activity.source]).sort()).toEqual([
      ["dancing", "manual"],
      ["running", "import"],
    ]);

    await expect(importActivityCsv(id, "Nom,Poids\nA,70\n")).rejects.toThrow("import_invalid");
    await expect(importActivityCsv(id, "Date,Steps\nhier,10\n")).rejects.toThrow("import_empty");
  });

  it("photos de progression : privées, comparées par pose, supprimées avec le compte", async () => {
    const owner = await setupUser();
    const leoId = await inviteMember(owner.householdId, owner.id);
    await addProgressPhoto(leoId, { date: yesterday, pose: "front", imageBase64: JPEG_BASE64, mime: "image/jpeg" });
    const latest = await addProgressPhoto(leoId, {
      date: today,
      pose: "front",
      imageBase64: JPEG_BASE64,
      mime: "image/jpeg",
    });
    await addProgressPhoto(leoId, { date: today, pose: "side", imageBase64: JPEG_BASE64, mime: "image/jpeg" });
    await expect(
      addProgressPhoto(leoId, {
        date: today,
        pose: "back",
        imageBase64: Buffer.from("texte").toString("base64"),
        mime: "image/jpeg",
      }),
    ).rejects.toThrow("invalid_photo");

    const overview = await progressPhotoOverview(leoId);
    expect(overview.recent).toHaveLength(3);
    expect(overview.compare.map((pair) => [pair.pose, pair.latest.id])).toEqual([["front", latest]]);
    const response = await fetch(overview.compare[0]!.latest.url);
    expect(response.status).toBe(200);
    expect((await progressPhotoOverview(owner.id)).recent).toEqual([]);

    const rows = await db().select().from(progressPhotos).where(eq(progressPhotos.userId, leoId));
    expect(rows.every((row) => row.objectKey.startsWith(`progress/${leoId}/`))).toBe(true);
    await expect(deleteProgressPhoto(owner.id, latest)).rejects.toThrow("not_found");
    await deleteProgressPhoto(leoId, latest);
    const gone = await fetch(overview.compare[0]!.latest.url);
    expect(gone.status).toBe(404);

    const data = await collectUserData(leoId);
    expect(data.progressPhotos).toHaveLength(2);
    expect(JSON.stringify(data.progressPhotos)).not.toContain("progress/");

    const remaining = await progressPhotoOverview(leoId);
    await deleteUser(leoId);
    expect(await db().select().from(progressPhotos)).toEqual([]);
    for (const photo of remaining.recent) expect((await fetch(photo.url)).status).toBe(404);
  });
});
