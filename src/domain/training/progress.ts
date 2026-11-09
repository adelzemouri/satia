/**
 * « Mes repères » : la progression de chaque exercice dans sa propre unité (kilos s'il y a eu
 * une charge, sinon répétitions, sinon secondes), séance après séance. Calcul pur.
 */
import type { LoggedExercise, LoggedSet, Muscle } from "./types";

export type MarkUnit = "kg" | "reps" | "seconds";

export type ProgressMark = {
  exerciseId: string;
  unit: MarkUnit;
  /** Meilleure valeur de chaque séance, de la plus ancienne à la plus récente. */
  points: number[];
  first: number;
  best: number;
  lastDate: string;
};

/** Familles de repères, pour les pastilles de filtre. */
export const MARK_KINDS = ["strength", "core", "cardio", "mobility"] as const;
export type MarkKind = (typeof MARK_KINDS)[number];

export function markKind(muscle: Muscle): MarkKind {
  if (muscle === "core") return "core";
  if (muscle === "cardio" || muscle === "full_body") return "cardio";
  if (muscle === "mobility") return "mobility";
  return "strength";
}

const PICK: Record<MarkUnit, (set: LoggedSet) => number | null> = {
  kg: (set) => set.weightKg,
  reps: (set) => set.reps,
  seconds: (set) => set.seconds,
};

function bestOf(sets: readonly LoggedSet[], unit: MarkUnit): number | null {
  let best: number | null = null;
  for (const set of sets) {
    const value = PICK[unit](set);
    if (value !== null && value > 0 && (best === null || value > best)) best = value;
  }
  return best;
}

/**
 * Séries de progression par exercice, à partir des séances (dans n'importe quel ordre). L'unité
 * d'un exercice est celle de sa mesure la plus parlante : la charge dès qu'une charge a été notée.
 * Tri : les exercices qui ont le plus progressé d'abord, puis les plus récents.
 */
export function progressMarks(
  sessions: readonly { date: string; items: readonly LoggedExercise[] }[],
  keep: (exerciseId: string) => boolean = () => true,
): ProgressMark[] {
  const chronological = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const byExercise = new Map<string, { date: string; sets: LoggedSet[] }[]>();
  for (const session of chronological) {
    for (const item of session.items) {
      if (!keep(item.exerciseId) || item.sets.length === 0) continue;
      const list = byExercise.get(item.exerciseId) ?? [];
      list.push({ date: session.date, sets: item.sets });
      byExercise.set(item.exerciseId, list);
    }
  }
  const marks: ProgressMark[] = [];
  for (const [exerciseId, entries] of byExercise) {
    const all = entries.flatMap((entry) => entry.sets);
    const unit: MarkUnit | null =
      bestOf(all, "kg") !== null
        ? "kg"
        : bestOf(all, "reps") !== null
          ? "reps"
          : bestOf(all, "seconds") !== null
            ? "seconds"
            : null;
    if (!unit) continue;
    const points = entries.map((entry) => bestOf(entry.sets, unit)).filter((value): value is number => value !== null);
    if (points.length === 0) continue;
    marks.push({
      exerciseId,
      unit,
      points,
      first: points[0]!,
      best: Math.max(...points),
      lastDate: entries[entries.length - 1]!.date,
    });
  }
  const gain = (mark: ProgressMark) => (mark.best - mark.first) / mark.first;
  return marks.sort((a, b) => gain(b) - gain(a) || b.lastDate.localeCompare(a.lastDate));
}

/** Ce que Pépin dit en haut de « Mon suivi ». */
export type SuiviLine = { key: "none" } | { key: "steady"; sessions: number } | { key: "progress"; mark: ProgressMark };

export function suiviLine(sessionCount: number, marks: readonly ProgressMark[]): SuiviLine {
  if (sessionCount === 0) return { key: "none" };
  const top = marks[0];
  if (top && top.best > top.first) return { key: "progress", mark: top };
  return { key: "steady", sessions: sessionCount };
}
