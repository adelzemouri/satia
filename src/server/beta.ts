import "server-only";

import { and, count, desc, eq, gte, inArray, max } from "drizzle-orm";

import { db } from "@/db/client";
import {
  coachMessages,
  llmCalls,
  mealEntries,
  mealPlanItems,
  pushSubscriptions,
  session,
  trainingSessions,
} from "@/db/schema";
import {
  BETA_WINDOW_DAYS,
  deviceFromUserAgent,
  type EntryShare,
  entryShares,
  type GuestActivity,
  type GuestDevice,
  type GuestFeature,
  guestActivity,
} from "@/domain/beta";
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

export type GuestDetails = {
  /** Dernière visite connue : session rafraîchie (au plus une fois par jour) ou dernier aliment noté. */
  lastSeen: Date | null;
  entries: EntryShare[];
  entryCount: number;
  /** Sur la même fenêtre de 28 jours : messages à Pépin, plats ajoutés au menu, idées frigo, séances. */
  features: Record<GuestFeature, number>;
  device: GuestDevice | null;
  reminders: boolean;
};

/**
 * Ce que la fiche d'un invité montre en plus : comment et quand il utilise l'appli, jamais le
 * contenu de ses repas, son poids ni ses objectifs.
 */
export async function guestDetails(ids: string[], today: string = todayIso()): Promise<Map<string, GuestDetails>> {
  if (ids.length === 0) return new Map();
  const startDate = addDays(today, -(BETA_WINDOW_DAYS - 1));
  // Même fenêtre que la bande des 28 jours, à quelques heures de fuseau près.
  const since = new Date(`${startDate}T00:00:00Z`);
  const [methods, lastMeals, sessions, coach, menu, fridge, training, pushes] = await Promise.all([
    db()
      .select({ userId: mealEntries.userId, method: mealEntries.inputMethod, count: count() })
      .from(mealEntries)
      .where(and(inArray(mealEntries.userId, ids), gte(mealEntries.date, startDate)))
      .groupBy(mealEntries.userId, mealEntries.inputMethod),
    db()
      .select({ userId: mealEntries.userId, last: max(mealEntries.createdAt) })
      .from(mealEntries)
      .where(inArray(mealEntries.userId, ids))
      .groupBy(mealEntries.userId),
    db()
      .select({ userId: session.userId, updatedAt: session.updatedAt, userAgent: session.userAgent })
      .from(session)
      .where(inArray(session.userId, ids))
      .orderBy(desc(session.updatedAt)),
    db()
      .select({ userId: coachMessages.userId, count: count() })
      .from(coachMessages)
      .where(
        and(inArray(coachMessages.userId, ids), eq(coachMessages.role, "user"), gte(coachMessages.createdAt, since)),
      )
      .groupBy(coachMessages.userId),
    db()
      .select({ userId: mealPlanItems.createdBy, count: count() })
      .from(mealPlanItems)
      .where(and(inArray(mealPlanItems.createdBy, ids), gte(mealPlanItems.createdAt, since)))
      .groupBy(mealPlanItems.createdBy),
    db()
      .select({ userId: llmCalls.userId, count: count() })
      .from(llmCalls)
      .where(and(inArray(llmCalls.userId, ids), eq(llmCalls.feature, "fridge"), gte(llmCalls.createdAt, since)))
      .groupBy(llmCalls.userId),
    db()
      .select({ userId: trainingSessions.userId, count: count() })
      .from(trainingSessions)
      .where(and(inArray(trainingSessions.userId, ids), gte(trainingSessions.date, startDate)))
      .groupBy(trainingSessions.userId),
    db()
      .selectDistinct({ userId: pushSubscriptions.userId })
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, ids)),
  ]);
  const countFor = (rows: { userId: string | null; count: number }[], id: string) =>
    rows.find((row) => row.userId === id)?.count ?? 0;
  return new Map(
    ids.map((id) => {
      const own = methods.filter((row) => row.userId === id);
      const latest = sessions.find((row) => row.userId === id);
      const lastMeal = lastMeals.find((row) => row.userId === id)?.last ?? null;
      const seen = [latest?.updatedAt, lastMeal].filter((date): date is Date => date instanceof Date);
      const details: GuestDetails = {
        lastSeen: seen.length > 0 ? new Date(Math.max(...seen.map((date) => date.getTime()))) : null,
        entries: entryShares(own),
        entryCount: own.reduce((sum, row) => sum + row.count, 0),
        features: {
          coach: countFor(coach, id),
          menu: countFor(menu, id),
          fridge: countFor(fridge, id),
          training: countFor(training, id),
        },
        device: deviceFromUserAgent(latest?.userAgent),
        reminders: pushes.some((row) => row.userId === id),
      };
      return [id, details];
    }),
  );
}
