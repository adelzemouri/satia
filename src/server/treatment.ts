import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { treatmentLogs, treatments } from "@/db/schema";

import { DomainError } from "./errors";
import { assertNotFuture } from "./journal";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "invalid_time");

// --- Traitements suivis ------------------------------------------------------------

export const treatmentSchema = z.object({
  name: z.string().trim().min(1, "required").max(80),
  reminderTime: time.nullable(),
  reminderDays: z.array(z.number().int().min(0).max(6)).max(7),
});

export async function addTreatment(userId: string, input: z.input<typeof treatmentSchema>): Promise<string> {
  const data = treatmentSchema.parse(input);
  const reminderDays = [...new Set(data.reminderDays)].sort();
  if (data.reminderTime && reminderDays.length === 0) throw new DomainError("treatment_days_required");
  const [row] = await db()
    .insert(treatments)
    .values({ userId, name: data.name, reminderTime: data.reminderTime, reminderDays })
    .returning({ id: treatments.id });
  return row!.id;
}

/** Arrête le suivi (et ses rappels) ; le journal des prises est conservé. */
export async function deleteTreatment(userId: string, id: string): Promise<void> {
  await db()
    .delete(treatments)
    .where(and(eq(treatments.id, z.uuid().parse(id)), eq(treatments.userId, userId)));
}

// --- Journal des prises ------------------------------------------------------------

export const treatmentLogSchema = z.object({
  treatmentId: z.uuid().nullable(),
  name: z.string().trim().max(80),
  date: z.iso.date(),
  time,
  note: z.string().trim().max(300),
});

export async function logTreatment(userId: string, input: z.input<typeof treatmentLogSchema>): Promise<void> {
  const data = treatmentLogSchema.parse(input);
  assertNotFuture(data.date);
  let name = data.name;
  if (data.treatmentId) {
    const [treatment] = await db()
      .select({ name: treatments.name })
      .from(treatments)
      .where(and(eq(treatments.id, data.treatmentId), eq(treatments.userId, userId)));
    if (!treatment) throw new DomainError("not_found");
    name = treatment.name;
  }
  if (!name) throw new DomainError("treatment_name_required");
  await db()
    .insert(treatmentLogs)
    .values({ userId, treatmentId: data.treatmentId, name, date: data.date, time: data.time, note: data.note || null });
}

export async function deleteTreatmentLog(userId: string, id: string): Promise<void> {
  await db()
    .delete(treatmentLogs)
    .where(and(eq(treatmentLogs.id, z.uuid().parse(id)), eq(treatmentLogs.userId, userId)));
}

export async function treatmentOverview(userId: string) {
  const [list, logs] = await Promise.all([
    db().select().from(treatments).where(eq(treatments.userId, userId)).orderBy(asc(treatments.createdAt)),
    db()
      .select()
      .from(treatmentLogs)
      .where(eq(treatmentLogs.userId, userId))
      .orderBy(desc(treatmentLogs.date), desc(treatmentLogs.time))
      .limit(30),
  ]);
  return { treatments: list, logs };
}

/** Traitements à rappeler un jour donné (0 = lundi), avec la prise déjà notée ou non. */
export async function treatmentRemindersOn(
  userId: string,
  date: string,
  weekday: number,
): Promise<{ id: string; name: string; time: string; taken: boolean }[]> {
  const [list, logs] = await Promise.all([
    db()
      .select()
      .from(treatments)
      .where(and(eq(treatments.userId, userId), eq(treatments.active, true))),
    db()
      .select({ treatmentId: treatmentLogs.treatmentId })
      .from(treatmentLogs)
      .where(and(eq(treatmentLogs.userId, userId), eq(treatmentLogs.date, date))),
  ]);
  const taken = new Set(logs.map((log) => log.treatmentId));
  return list.flatMap((treatment) =>
    treatment.reminderTime && treatment.reminderDays.includes(weekday)
      ? [{ id: treatment.id, name: treatment.name, time: treatment.reminderTime, taken: taken.has(treatment.id) }]
      : [],
  );
}

export async function treatmentExport(userId: string) {
  const [list, logs] = await Promise.all([
    db().select().from(treatments).where(eq(treatments.userId, userId)),
    db().select().from(treatmentLogs).where(eq(treatmentLogs.userId, userId)).orderBy(asc(treatmentLogs.date)),
  ]);
  return { treatments: list, logs };
}
