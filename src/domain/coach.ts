/** Coach (calcul pur) : contexte compact, garde-fous locaux, statistiques du bilan, plat suggéré. */

import type { MealSlot } from "./meals";

/**
 * Demande explicite d'un apport sous le plancher (« 800 kcal par jour ») : le coach répond
 * sans appel au LLM, avec bienveillance.
 */
export function asksBelowFloor(message: string, floor: number): boolean {
  const pattern = /(\d[\d\s.]{1,5})\s*(?:k?cal|calories?)\b/gi;
  for (const match of message.matchAll(pattern)) {
    const value = Number(match[1]!.replace(/[\s.]/g, ""));
    if (value >= 300 && value < floor) return true;
  }
  return false;
}

/**
 * Questions de dosage ou de médicament : elles relèvent d'un professionnel de santé, le coach
 * répond localement sans appel au LLM. Les autres sujets de santé sont cadrés par le prompt.
 */
const MEDICAL_PATTERN = /\b(doses?|dosages?|posologies?|m[ée]dicaments?|injections?|insuline)\b/i;

export function mentionsMedicalTopic(message: string): boolean {
  return MEDICAL_PATTERN.test(message);
}

export type CoachContextInput = {
  firstName: string;
  goal: string;
  dateLabel: string;
  slot: string;
  goalKcal: number | null;
  consumedKcal: number;
  macros: { proteinG: number; carbsG: number; fatG: number };
  macroGoals: { proteinG: number; carbsG: number; fatG: number } | null;
  floorKcal: number;
  trendKg: number | null;
  targetKg: number | null;
  diet: string;
  foodsToAvoid: string;
  fiberG: number;
  fruitVegPortions: number;
  feeling: { hunger: number | null; energy: number | null; mood: number | null };
  weekly: { consumed: number; total: number } | null;
};

/** Contexte injecté dans chaque message : quelques lignes courtes (les tokens se paient). */
export function coachContext(input: CoachContextInput): string {
  const r = Math.round;
  const lines = [
    `Prénom : ${input.firstName}. Objectif : ${input.goal}. ${input.dateLabel}, moment : ${input.slot}.`,
    input.goalKcal !== null
      ? `Aujourd'hui : ${r(input.consumedKcal)} kcal sur ${input.goalKcal} (reste ${input.goalKcal - r(input.consumedKcal)}). Plancher : ${input.floorKcal}.`
      : `Aujourd'hui : ${r(input.consumedKcal)} kcal. Plancher : ${input.floorKcal}.`,
    input.macroGoals
      ? `Macros (g) : protéines ${r(input.macros.proteinG)}/${input.macroGoals.proteinG}, glucides ${r(input.macros.carbsG)}/${input.macroGoals.carbsG}, lipides ${r(input.macros.fatG)}/${input.macroGoals.fatG}.`
      : null,
    `Fibres ${input.fiberG} g, fruits et légumes ${input.fruitVegPortions} portions.`,
    input.weekly ? `Semaine : ${input.weekly.consumed}/${input.weekly.total} kcal.` : null,
    input.trendKg !== null
      ? `Poids (tendance) : ${input.trendKg} kg${input.targetKg !== null ? `, cible ${input.targetKg} kg` : ""}.`
      : null,
    `Alimentation : ${input.diet}${input.foodsToAvoid ? `, à éviter : ${input.foodsToAvoid}` : ""}.`,
    feelingLine(input.feeling),
  ];
  return lines.filter(Boolean).join("\n");
}

function feelingLine(feeling: CoachContextInput["feeling"]): string | null {
  const parts = [
    feeling.hunger !== null && `faim ${feeling.hunger}/5`,
    feeling.energy !== null && `énergie ${feeling.energy}/5`,
    feeling.mood !== null && `humeur ${feeling.mood}/5`,
  ].filter(Boolean);
  return parts.length > 0 ? `Ressenti : ${parts.join(", ")}.` : null;
}

export type DayStats = { date: string; kcal: number; proteinG: number; logged: boolean; energy: number | null };

export type WeekStats = {
  daysLogged: number;
  averageKcal: number;
  averageProteinG: number;
  /** Énergie moyenne les jours pauvres en protéines (< 80 % de l'objectif) et les autres. */
  energyLowProtein: number | null;
  energyOtherDays: number | null;
};

export function weekStats(days: readonly DayStats[], proteinGoalG: number): WeekStats {
  const logged = days.filter((day) => day.logged);
  const average = (values: number[]) =>
    values.length > 0 ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;
  const energy = (low: boolean) => {
    const values = logged
      .filter((day) => day.energy !== null && day.proteinG < proteinGoalG * 0.8 === low)
      .map((day) => day.energy!);
    return values.length >= 2 ? average(values) : null;
  };
  return {
    daysLogged: logged.length,
    averageKcal: Math.round(average(logged.map((day) => day.kcal)) ?? 0),
    averageProteinG: Math.round(average(logged.map((day) => day.proteinG)) ?? 0),
    energyLowProtein: energy(true),
    energyOtherDays: energy(false),
  };
}

export type DishCandidate = {
  id: string;
  name: string;
  portionKcal: number;
  /** Repas où l'utilisateur l'a déjà noté (vide s'il ne l'a jamais noté). */
  slots: readonly MealSlot[];
};

/** Part indicative de l'objectif du jour pour chaque repas. */
export const SLOT_SHARES: Record<MealSlot, number> = { breakfast: 0.25, lunch: 0.35, snack: 0.1, dinner: 0.3 };

/**
 * Plat suggéré sans appel au LLM : une recette ou un favori adapté au repas qui vient (déjà
 * noté à ce repas, ou jamais noté et proposé au déjeuner ou au dîner seulement), dont une
 * portion tient dans la part de ce repas et dans le reste du jour, qui change chaque jour.
 */
export function suggestDish(
  candidates: readonly DishCandidate[],
  { slot, goalKcal, remainingKcal }: { slot: MealSlot; goalKcal: number; remainingKcal: number },
  seed: string,
): DishCandidate | null {
  const budget = Math.min(remainingKcal, Math.round(goalKcal * SLOT_SHARES[slot] * 1.2));
  if (budget < 80) return null;
  const fitting = candidates
    .filter((dish) => (dish.slots.length > 0 ? dish.slots.includes(slot) : slot === "lunch" || slot === "dinner"))
    .filter((dish) => dish.portionKcal <= budget && dish.portionKcal >= budget / 3)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (fitting.length === 0) return null;
  const hash = [...seed].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
  return fitting[hash % fitting.length]!;
}

/**
 * Demande de séance dans le chat (« j'ai 20 minutes, pas de matériel ») : durée et matériel.
 * La séance est alors construite par les règles et le coach se contente de la présenter.
 */
export function workoutRequest(message: string): { minutes: number; noEquipment: boolean } | null {
  const text = message.toLowerCase();
  if (!/(séance|seance|entra[iî]n|exercice|workout|sport|muscu|circuit)/.test(text)) return null;
  const minutes = Number(text.match(/(\d{1,2})\s*(?:min|minutes|mn)\b/)?.[1] ?? 20);
  return {
    minutes: Math.min(60, Math.max(10, minutes)),
    noEquipment: /(sans|pas de|aucun)\s+(?:de\s+)?mat[ée]riel|no equipment/.test(text),
  };
}
