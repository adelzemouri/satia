import { burnedKcal } from "./training/program";

/** Activités libres (hors séances Training), du plus courant au plus rare. */
export const ACTIVITY_TYPES = [
  "walking",
  "running",
  "cycling",
  "swimming",
  "hiking",
  "dancing",
  "yoga",
  "strength",
  "team_sport",
  "racket_sport",
  "climbing",
  "skiing",
  "gardening",
  "housework",
  "other",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const INTENSITIES = ["light", "moderate", "vigorous"] as const;
export type Intensity = (typeof INTENSITIES)[number];

/**
 * Équivalents métaboliques (MET) par intensité, arrondis à partir des valeurs usuelles
 * publiées pour chaque famille d'activité (1 MET ≈ dépense au repos).
 */
export const ACTIVITY_METS: Record<ActivityType, Record<Intensity, number>> = {
  walking: { light: 2.8, moderate: 3.5, vigorous: 5 },
  running: { light: 7, moderate: 9, vigorous: 11.5 },
  cycling: { light: 4, moderate: 6.8, vigorous: 10 },
  swimming: { light: 5, moderate: 7, vigorous: 9.8 },
  hiking: { light: 5.3, moderate: 6, vigorous: 7.8 },
  dancing: { light: 3, moderate: 5, vigorous: 7.3 },
  yoga: { light: 2.5, moderate: 3, vigorous: 4 },
  strength: { light: 3.5, moderate: 5, vigorous: 6 },
  team_sport: { light: 5, moderate: 7, vigorous: 9 },
  racket_sport: { light: 5, moderate: 7, vigorous: 8 },
  climbing: { light: 5.8, moderate: 8, vigorous: 9.5 },
  skiing: { light: 4.3, moderate: 6.8, vigorous: 8.5 },
  gardening: { light: 3, moderate: 3.8, vigorous: 5 },
  housework: { light: 2.3, moderate: 3.3, vigorous: 4 },
  other: { light: 3, moderate: 4.5, vigorous: 6.5 },
};

/** Calories dépensées pendant une activité : MET × poids (kg) × durée (h). */
export function activityKcal(type: ActivityType, intensity: Intensity, weightKg: number, minutes: number): number {
  return burnedKcal(ACTIVITY_METS[type][intensity], weightKg, minutes);
}

/**
 * Pas déjà comptés dans le niveau d'activité du profil : seuls les pas au-delà de ce
 * seuil ajoutent des calories, pour ne pas compter deux fois la marche du quotidien.
 */
export const STEP_BASELINES: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 3000,
  2: 5000,
  3: 7500,
  4: 10_000,
  5: 12_500,
};

/** Dépense d'un pas de marche, par kilo de poids corporel (≈ 0,035 kcal pour 70 kg). */
export const KCAL_PER_STEP_PER_KG = 0.0005;

/** Calories des pas au-delà du seuil du niveau d'activité. */
export function stepsKcal(steps: number, weightKg: number, activityLevel: 1 | 2 | 3 | 4 | 5): number {
  return Math.round(Math.max(0, steps - STEP_BASELINES[activityLevel]) * KCAL_PER_STEP_PER_KG * weightKg);
}

/** Mensurations suivies (tour de…), en centimètres. */
export const MEASUREMENT_KINDS = ["waist", "hips", "chest", "arm", "thigh", "neck"] as const;
export type MeasurementKind = (typeof MEASUREMENT_KINDS)[number];

/** Poses des photos de progression, pour comparer des images comparables. */
export const POSES = ["front", "side", "back"] as const;
export type Pose = (typeof POSES)[number];

/** Première et dernière mesure de chaque mensuration, et l'évolution entre les deux. */
export function measurementChanges(
  rows: readonly { date: string; kind: MeasurementKind; valueCm: number }[],
): { kind: MeasurementKind; first: number; latest: number; latestDate: string; change: number }[] {
  return MEASUREMENT_KINDS.flatMap((kind) => {
    const sorted = rows.filter((row) => row.kind === kind).sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0];
    const latest = sorted.at(-1);
    if (!first || !latest) return [];
    return [
      {
        kind,
        first: first.valueCm,
        latest: latest.valueCm,
        latestDate: latest.date,
        change: Math.round((latest.valueCm - first.valueCm) * 10) / 10,
      },
    ];
  });
}
