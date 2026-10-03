/**
 * Message du jour de l'accueil : une phrase qui change selon l'heure et la journée, toujours
 * encourageante. Calcul pur ; le texte est dans les traductions (`home.daily.*`).
 */

export const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365] as const;

export type DailyContext = {
  /** Heure locale (0–23). */
  hour: number;
  /** Repas principaux (petit-déjeuner, déjeuner, dîner) déjà notés aujourd'hui. */
  mainMealsLogged: number;
  /** Une saisie existe-t-elle aujourd'hui (tous repas confondus) ? */
  loggedToday: boolean;
  /** Calories restantes ; négatif au-delà de l'objectif, null sans objectif. */
  remainingKcal: number | null;
  waterGlasses: number;
  waterGoal: number;
  streakDays: number;
  /** Graine stable sur la journée, pour varier les conseils sans qu'ils changent à chaque visite. */
  seed: string;
};

export type DailyMessage =
  | { key: "streak"; days: number }
  | { key: "dayComplete" }
  | { key: "waterDone" }
  | { key: "morning" }
  | { key: "lunch" }
  | { key: "afternoon" }
  | { key: "eveningRoom"; kcal: number }
  | { key: "eveningFull" }
  | { key: "tip"; index: number };

/** Nombre de conseils généraux dans les traductions (`home.daily.tips`). */
export const TIP_COUNT = 6;

function hash(text: string): number {
  return [...text].reduce((value, char) => (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0, 7);
}

export function dailyMessage(context: DailyContext): DailyMessage {
  const { hour, mainMealsLogged, loggedToday, remainingKcal, streakDays } = context;
  if (loggedToday && (STREAK_MILESTONES as readonly number[]).includes(streakDays)) {
    return { key: "streak", days: streakDays };
  }
  if (mainMealsLogged >= 3) return { key: "dayComplete" };
  if (context.waterGoal > 0 && context.waterGlasses >= context.waterGoal) return { key: "waterDone" };
  if (hour < 11 && !loggedToday) return { key: "morning" };
  if (hour >= 11 && hour < 14 && mainMealsLogged < 2) return { key: "lunch" };
  if (hour >= 18 && remainingKcal !== null) {
    // Au-delà de l'objectif : pas de reproche, on regarde vers demain.
    if (remainingKcal < 0) return { key: "eveningFull" };
    if (remainingKcal >= 250) return { key: "eveningRoom", kcal: Math.round(remainingKcal / 10) * 10 };
  }
  if (hour >= 14 && hour < 18) return { key: "afternoon" };
  return { key: "tip", index: hash(context.seed) % TIP_COUNT };
}
