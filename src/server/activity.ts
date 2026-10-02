import "server-only";

import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { activities, dailySteps } from "@/db/schema";
import { ACTIVITY_TYPES, activityKcal, INTENSITIES } from "@/domain/activity";
import { IMPORT_MAX_BYTES, parseActivityCsv } from "@/domain/activity-import";
import { todayIso } from "@/domain/dates";
import { addDays } from "@/domain/energy";

import { DomainError } from "./errors";
import { assertNotFuture, latestWeight } from "./journal";
import { getProfile } from "./profile";

const isoDate = z.iso.date();

/** Poids retenu pour les calories d'une activité : dernier poids connu, sinon celui du départ. */
async function weightFor(userId: string, date: string): Promise<number> {
  const weight = await latestWeight(userId, date);
  if (weight) return weight;
  return (await getProfile(userId))?.startWeightKg ?? 70;
}

// --- Activités -------------------------------------------------------------------

export const activitySchema = z.object({
  date: isoDate,
  type: z.enum(ACTIVITY_TYPES),
  intensity: z.enum(INTENSITIES),
  durationMin: z.number().int("duration_range").min(1, "duration_range").max(600, "duration_range"),
});

/** Activité saisie à la main : les calories sont calculées côté serveur, jamais reçues du client. */
export async function addActivity(userId: string, input: z.input<typeof activitySchema>): Promise<void> {
  const data = activitySchema.parse(input);
  assertNotFuture(data.date);
  const kcal = activityKcal(data.type, data.intensity, await weightFor(userId, data.date), data.durationMin);
  await db()
    .insert(activities)
    .values({ userId, ...data, kcal });
}

export async function deleteActivity(userId: string, id: string): Promise<void> {
  await db()
    .delete(activities)
    .where(and(eq(activities.id, z.uuid().parse(id)), eq(activities.userId, userId)));
}

// --- Pas ---------------------------------------------------------------------------

export const stepsSchema = z.object({
  date: isoDate,
  steps: z.number().int("steps_range").min(0, "steps_range").max(100_000, "steps_range"),
});

/** Pas du jour ; zéro efface la saisie. */
export async function setSteps(userId: string, input: z.input<typeof stepsSchema>): Promise<void> {
  const data = stepsSchema.parse(input);
  assertNotFuture(data.date);
  if (data.steps === 0) {
    await db()
      .delete(dailySteps)
      .where(and(eq(dailySteps.userId, userId), eq(dailySteps.date, data.date)));
    return;
  }
  await db()
    .insert(dailySteps)
    .values({ userId, ...data })
    .onConflictDoUpdate({ target: [dailySteps.userId, dailySteps.date], set: { steps: data.steps } });
}

// --- Import CSV --------------------------------------------------------------------

export type ImportResult = { days: number; activities: number; skipped: number };

/**
 * Import d'un export CSV (Google Fit, Apple Santé, montre…). Les pas remplacent ceux des jours
 * concernés ; les activités déjà importées pour ces jours sont remplacées, pour qu'un second
 * import du même fichier ne les compte pas deux fois. Les saisies manuelles ne bougent pas.
 */
export async function importActivityCsv(userId: string, text: string): Promise<ImportResult> {
  if (Buffer.byteLength(text, "utf8") > IMPORT_MAX_BYTES) throw new DomainError("import_too_large");
  let parsed;
  try {
    parsed = parseActivityCsv(text, todayIso());
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    throw new DomainError(code === "import_too_large" ? "import_too_large" : "import_invalid");
  }
  const days = [...new Set([...parsed.steps.keys(), ...parsed.activities.map((activity) => activity.date)])];
  if (days.length === 0) throw new DomainError("import_empty");

  const weights = new Map<string, number>();
  for (const date of new Set(parsed.activities.map((activity) => activity.date))) {
    weights.set(date, await weightFor(userId, date));
  }
  await db().transaction(async (tx) => {
    for (const [date, steps] of parsed.steps) {
      await tx
        .insert(dailySteps)
        .values({ userId, date, steps })
        .onConflictDoUpdate({ target: [dailySteps.userId, dailySteps.date], set: { steps } });
    }
    const activityDays = [...weights.keys()];
    if (activityDays.length > 0) {
      await tx
        .delete(activities)
        .where(
          and(eq(activities.userId, userId), eq(activities.source, "import"), inArray(activities.date, activityDays)),
        );
      await tx.insert(activities).values(
        parsed.activities.map((activity) => ({
          userId,
          ...activity,
          intensity: "moderate" as const,
          kcal: activityKcal(activity.type, "moderate", weights.get(activity.date)!, activity.durationMin),
          source: "import" as const,
        })),
      );
    }
  });
  return { days: parsed.steps.size, activities: parsed.activities.length, skipped: parsed.skipped };
}

// --- Lecture -----------------------------------------------------------------------

/** Activités et pas des derniers jours, pour la page Activité. */
export async function activityOverview(userId: string, today: string = todayIso()) {
  const since = addDays(today, -13);
  const [recent, steps] = await Promise.all([
    db()
      .select()
      .from(activities)
      .where(and(eq(activities.userId, userId), gte(activities.date, since)))
      .orderBy(desc(activities.date), desc(activities.createdAt)),
    db()
      .select({ date: dailySteps.date, steps: dailySteps.steps })
      .from(dailySteps)
      .where(and(eq(dailySteps.userId, userId), gte(dailySteps.date, since)))
      .orderBy(asc(dailySteps.date)),
  ]);
  return { activities: recent, steps };
}

export async function activityExport(userId: string) {
  const [rows, steps] = await Promise.all([
    db().select().from(activities).where(eq(activities.userId, userId)).orderBy(asc(activities.date)),
    db().select().from(dailySteps).where(eq(dailySteps.userId, userId)).orderBy(asc(dailySteps.date)),
  ]);
  return { activities: rows, steps };
}
