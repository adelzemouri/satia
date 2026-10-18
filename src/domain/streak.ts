import { STREAK_MILESTONES } from "./daily-message";
import { addDays } from "./energy";

/**
 * Streak : jours consécutifs avec au moins un repas saisi. Un jour manqué par semaine
 * civile (lundi → dimanche) est couvert automatiquement par un « gel ».
 * Un jour non encore saisi aujourd'hui ne casse pas la série.
 */
export type Streak = { days: number; frozenDays: string[] };

type Run = Streak & { start: string; end: string };

/** Série qui se termine au jour saisi `end`, en remontant le temps jusqu'au premier trou non couvert. */
function runEndingAt(loggedDays: ReadonlySet<string>, end: string): Run {
  const frozenDays: string[] = [];
  const frozenWeeks = new Set<string>();
  let days = 0;
  let start = end;
  let cursor = end;
  for (;;) {
    if (loggedDays.has(cursor)) {
      days += 1;
      start = cursor;
    } else {
      const week = isoWeekStart(cursor);
      // Un gel ne compte que s'il relie deux jours saisis : le jour d'avant doit l'être aussi.
      if (frozenWeeks.has(week) || !loggedDays.has(addDays(cursor, -1)) || days === 0) break;
      frozenWeeks.add(week);
      frozenDays.push(cursor);
    }
    cursor = addDays(cursor, -1);
  }
  return { days, frozenDays, start, end };
}

export function computeStreak(loggedDays: ReadonlySet<string>, today: string): Streak {
  const { days, frozenDays } = runEndingAt(loggedDays, loggedDays.has(today) ? today : addDays(today, -1));
  return { days, frozenDays };
}

/** Lundi de la semaine ISO du jour donné. */
export function isoWeekStart(isoDate: string): string {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return addDays(isoDate, -((day + 6) % 7));
}

export type StreakStep = { days: number; reachedOn: string };

export type StreakStats = {
  current: Streak;
  /** Plus longue série jamais faite (au moins la série en cours). */
  best: number;
  /** Jours avec au moins un repas, depuis le début. */
  totalDays: number;
  /** Étapes franchies, avec le jour où elles l'ont été. Une étape gagnée ne se perd jamais. */
  steps: StreakStep[];
  /** Prochaine étape à franchir et jours de série en cours qui manquent pour l'atteindre. */
  next: { days: number; remaining: number } | null;
  /** Jours manqués couverts par un gel, dans toutes les séries. */
  restDays: string[];
};

/**
 * Bilan des jours saisis pour la fiche « Ma série » : l'historique est découpé en séries avec
 * la même règle que le compteur de l'accueil, en partant du jour le plus récent.
 */
export function streakStats(loggedDays: ReadonlySet<string>, today: string): StreakStats {
  const sorted = [...loggedDays].filter((day) => day <= today).sort();
  const logged = new Set(sorted);
  const runs: Run[] = [];
  let index = sorted.length - 1;
  while (index >= 0) {
    const run = runEndingAt(logged, sorted[index] as string);
    runs.push(run);
    while (index >= 0 && (sorted[index] as string) >= run.start) index -= 1;
  }
  runs.reverse();

  const current = computeStreak(logged, today);
  const best = Math.max(current.days, ...runs.map((run) => run.days), 0);

  const steps: StreakStep[] = [];
  for (const milestone of STREAK_MILESTONES) {
    const run = runs.find((candidate) => candidate.days >= milestone);
    if (!run) break;
    // Le jour de l'étape est le n-ième jour saisi de la série.
    const runDays = sorted.filter((day) => day >= run.start && day <= run.end);
    steps.push({ days: milestone, reachedOn: runDays[milestone - 1] as string });
  }
  const nextDays = STREAK_MILESTONES.find((milestone) => milestone > best);

  return {
    current,
    best,
    totalDays: sorted.length,
    steps,
    next: nextDays === undefined ? null : { days: nextDays, remaining: nextDays - current.days },
    restDays: runs.flatMap((run) => run.frozenDays).sort(),
  };
}

export type CalendarDay = { date: string; state: "logged" | "rest" | "empty" | "future" };

/** Les `weeks` dernières semaines, du lundi au dimanche, la dernière contenant aujourd'hui. */
export function streakCalendar(
  loggedDays: ReadonlySet<string>,
  restDays: readonly string[],
  today: string,
  weeks = 5,
): CalendarDay[] {
  const rest = new Set(restDays);
  const first = addDays(isoWeekStart(today), -7 * (weeks - 1));
  return Array.from({ length: weeks * 7 }, (_, offset) => {
    const date = addDays(first, offset);
    const state = date > today ? "future" : loggedDays.has(date) ? "logged" : rest.has(date) ? "rest" : "empty";
    return { date, state };
  });
}
