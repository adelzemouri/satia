import "server-only";

import { and, gte, inArray, max } from "drizzle-orm";

import { db } from "@/db/client";
import { mealEntries } from "@/db/schema";
import { BETA_WINDOW_DAYS, type GuestActivity, guestActivity } from "@/domain/beta";
import { todayIso } from "@/domain/dates";
import { addDays } from "@/domain/energy";

/**
 * Assiduité des invités de la bêta : seulement les jours où chacun a noté un repas (et le dernier),
 * jamais ce qu'il a mangé.
 */
export async function guestActivities(
  guests: { id: string; createdAt: Date }[],
  today: string = todayIso(),
): Promise<Map<string, GuestActivity>> {
  const ids = guests.map((guest) => guest.id);
  if (ids.length === 0) return new Map();
  const start = addDays(today, -(BETA_WINDOW_DAYS - 1));
  const [days, lasts] = await Promise.all([
    db()
      .selectDistinct({ userId: mealEntries.userId, date: mealEntries.date })
      .from(mealEntries)
      .where(and(inArray(mealEntries.userId, ids), gte(mealEntries.date, start))),
    db()
      .select({ userId: mealEntries.userId, last: max(mealEntries.date) })
      .from(mealEntries)
      .where(inArray(mealEntries.userId, ids))
      .groupBy(mealEntries.userId),
  ]);
  return new Map(
    guests.map((guest) => {
      const dates = days.filter((row) => row.userId === guest.id).map((row) => row.date);
      const last = lasts.find((row) => row.userId === guest.id)?.last;
      if (last) dates.push(last);
      return [guest.id, guestActivity(dates, todayIso(guest.createdAt), today)];
    }),
  );
}
