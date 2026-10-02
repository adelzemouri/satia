import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { trainingPrograms, trainingSessions } from "@/db/schema";
import { isoWeekStart } from "@/domain/streak";

/** Jour de la semaine d'une date ISO, 0 = lundi. */
export function weekdayOf(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/** Entraînement d'un jour pour l'objectif nutritionnel : calories dépensées et séance prévue ou faite. */
export async function trainingOn(
  userId: string,
  date: string,
): Promise<{ burnedKcal: number; sessions: number; planned: boolean }> {
  const [done, [program]] = await Promise.all([
    db()
      .select({ kcal: trainingSessions.kcal })
      .from(trainingSessions)
      .where(and(eq(trainingSessions.userId, userId), eq(trainingSessions.date, date))),
    db()
      .select({ sessions: trainingPrograms.sessions })
      .from(trainingPrograms)
      .where(and(eq(trainingPrograms.userId, userId), eq(trainingPrograms.weekStart, isoWeekStart(date)))),
  ]);
  const weekday = weekdayOf(date);
  return {
    burnedKcal: done.reduce((sum, row) => sum + row.kcal, 0),
    sessions: done.length,
    planned: program?.sessions.some((session) => session.day === weekday) ?? false,
  };
}
