import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { activities, dailySteps } from "@/db/schema";

/** Activités libres et pas d'un jour : calories des activités (déjà calculées) et nombre de pas. */
export async function activityOn(userId: string, date: string): Promise<{ activityKcal: number; steps: number }> {
  const [rows, [steps]] = await Promise.all([
    db()
      .select({ kcal: activities.kcal })
      .from(activities)
      .where(and(eq(activities.userId, userId), eq(activities.date, date))),
    db()
      .select({ steps: dailySteps.steps })
      .from(dailySteps)
      .where(and(eq(dailySteps.userId, userId), eq(dailySteps.date, date))),
  ]);
  return { activityKcal: rows.reduce((sum, row) => sum + row.kcal, 0), steps: steps?.steps ?? 0 };
}
