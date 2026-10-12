import "server-only";

import { and, eq, gte } from "drizzle-orm";

import { bodyMeasurements, progressPhotos, weightEntries } from "@/db/schema";
import { db } from "@/db/client";
import { addDays } from "@/domain/energy";
import { WEIGH_MILESTONES } from "@/domain/rituals";

/** Assez d'historique pour la plus longue série de pesées annoncée (52 semaines). */
const HISTORY_DAYS = 7 * (Math.max(...WEIGH_MILESTONES) + 1);

export type RitualDates = { weighDates: string[]; measureDates: string[]; photoDates: string[] };

/** Dates des pesées, mensurations et photos de progrès récentes (les valeurs ne sont pas lues). */
export async function ritualDates(userId: string, today: string): Promise<RitualDates> {
  const since = addDays(today, -HISTORY_DAYS);
  const [weights, measures, photos] = await Promise.all([
    db()
      .select({ date: weightEntries.date })
      .from(weightEntries)
      .where(and(eq(weightEntries.userId, userId), gte(weightEntries.date, since))),
    db()
      .selectDistinct({ date: bodyMeasurements.date })
      .from(bodyMeasurements)
      .where(and(eq(bodyMeasurements.userId, userId), gte(bodyMeasurements.date, since))),
    db()
      .selectDistinct({ date: progressPhotos.date })
      .from(progressPhotos)
      .where(and(eq(progressPhotos.userId, userId), gte(progressPhotos.date, since))),
  ]);
  const dates = (rows: { date: string }[]) => rows.map((row) => row.date);
  return { weighDates: dates(weights), measureDates: dates(measures), photoDates: dates(photos) };
}
