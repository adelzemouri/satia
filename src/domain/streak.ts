import { addDays } from "./energy";

/**
 * Streak : jours consécutifs avec au moins un repas saisi. Un jour manqué par semaine
 * civile (lundi → dimanche) est couvert automatiquement par un « gel ».
 * Un jour non encore saisi aujourd'hui ne casse pas la série.
 */
export type Streak = { days: number; frozenDays: string[] };

export function computeStreak(loggedDays: ReadonlySet<string>, today: string): Streak {
  const frozenDays: string[] = [];
  const frozenWeeks = new Set<string>();
  let days = 0;
  let cursor = loggedDays.has(today) ? today : addDays(today, -1);

  // On remonte le temps jusqu'au premier jour manqué non couvert.
  for (;;) {
    if (loggedDays.has(cursor)) {
      days += 1;
    } else {
      const week = isoWeekStart(cursor);
      // Un gel ne compte que s'il relie deux jours saisis : le jour d'avant doit l'être aussi.
      if (frozenWeeks.has(week) || !loggedDays.has(addDays(cursor, -1)) || days === 0) break;
      frozenWeeks.add(week);
      frozenDays.push(cursor);
    }
    cursor = addDays(cursor, -1);
  }
  return { days, frozenDays };
}

/** Lundi de la semaine ISO du jour donné. */
export function isoWeekStart(isoDate: string): string {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return addDays(isoDate, -((day + 6) % 7));
}
