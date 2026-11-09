/**
 * Pépin, coach sportif : choix des phrases écrites à l'avance (aucun appel IA) et repères de
 * fin de séance. Calcul pur, les textes vivent dans les messages i18n (`training.pepin`).
 */
import type { LoggedSet, PlannedSession } from "./types";
import type { PersonalRecord } from "./program";

export type HomeLine =
  | { key: "first" }
  | { key: "firstLater"; day: number }
  | { key: "done" }
  | { key: "rest"; next: number | null }
  | { key: "today"; variant: number };

/** Nombre de variantes de la phrase « séance du jour » (messages `training.pepin.today.N`). */
export const TODAY_VARIANTS = 4;
/** Nombre de titres écrits à l'avance par type de séance (messages `training.titles.<focus>.N`). */
export const TITLE_VARIANTS = 3;

/** Petit nombre stable tiré d'une date ISO, pour varier les phrases d'un jour à l'autre. */
export function dayIndex(date: string, modulo: number): number {
  const days = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  return ((days % modulo) + modulo) % modulo;
}

/** Ce que Pépin dit en haut de l'écran Entraînement. */
export function homeLine({
  date,
  today,
  doneToday,
  everTrained,
  sessions,
}: {
  date: string;
  /** Jour de la semaine d'aujourd'hui, 0 = lundi. */
  today: number;
  doneToday: boolean;
  everTrained: boolean;
  sessions: readonly Pick<PlannedSession, "day">[];
}): HomeLine {
  if (doneToday) return { key: "done" };
  const planned = sessions.some((session) => session.day === today);
  const nextDay =
    sessions
      .map((session) => session.day)
      .filter((day): day is number => day !== null && day > today)
      .sort((a, b) => a - b)[0] ?? null;
  if (!everTrained)
    return planned
      ? { key: "first" }
      : nextDay !== null
        ? { key: "firstLater", day: nextDay }
        : { key: "rest", next: null };
  if (!planned) return { key: "rest", next: nextDay };
  return { key: "today", variant: dayIndex(date, TODAY_VARIANTS) };
}

/** Titre écrit à l'avance quand le coach IA n'a pas donné le sien. */
export function fallbackTitleIndex(day: number | null): number {
  return (day ?? 0) % TITLE_VARIANTS;
}

export type Highlight = {
  exerciseId: string;
  unit: "kg" | "reps" | "seconds";
  value: number;
  /** Repère précédent dans la même unité ; null = premier repère pour cet exercice. */
  previous: number | null;
};

function bestOf(sets: readonly LoggedSet[], pick: (set: LoggedSet) => number | null): number | null {
  let best: number | null = null;
  for (const set of sets) {
    const value = pick(set);
    if (value !== null && value > 0 && (best === null || value > best)) best = value;
  }
  return best;
}

/**
 * Repères à montrer en fin de séance : chaque exercice principal dans sa propre unité (kilos s'il
 * y a une charge, sinon répétitions, sinon secondes). D'abord ce qui progresse, puis les premiers
 * repères ; un exercice qui n'a pas bougé n'est pas montré (on ne parle jamais de recul).
 */
export function sessionHighlights(
  logged: readonly { exerciseId: string; sets: readonly LoggedSet[] }[],
  previous: readonly PersonalRecord[],
  limit = 3,
): Highlight[] {
  const records = new Map(previous.map((record) => [record.exerciseId, record]));
  const improved: Highlight[] = [];
  const firsts: Highlight[] = [];
  for (const item of logged) {
    const record = records.get(item.exerciseId);
    const kg = bestOf(item.sets, (set) => set.weightKg);
    const reps = bestOf(item.sets, (set) => set.reps);
    const seconds = bestOf(item.sets, (set) => set.seconds);
    const highlight: Highlight | null =
      kg !== null
        ? { exerciseId: item.exerciseId, unit: "kg", value: kg, previous: record?.maxWeightKg ?? null }
        : reps !== null
          ? { exerciseId: item.exerciseId, unit: "reps", value: reps, previous: record?.maxReps ?? null }
          : seconds !== null
            ? { exerciseId: item.exerciseId, unit: "seconds", value: seconds, previous: record?.maxSeconds ?? null }
            : null;
    if (!highlight) continue;
    if (highlight.previous === null) firsts.push(highlight);
    else if (highlight.value > highlight.previous) improved.push(highlight);
  }
  return [...improved, ...firsts].slice(0, limit);
}
