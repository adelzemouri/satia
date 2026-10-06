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
const MEDICAL_PATTERN =
  /\b(doses?|dosages?|posologies?|m[ée]dicaments?|injections?|insuline|ozempic|wegovy|mounjaro|saxenda|s[ée]maglutide|tirz[ée]patide|liraglutide|glp-?1)\b/i;

export function mentionsMedicalTopic(message: string): boolean {
  return MEDICAL_PATTERN.test(message);
}

/**
 * Signes de pratiques à risque (purge, laxatifs, arrêt de l'alimentation, jeûne de plusieurs
 * jours) : le coach répond localement, avec douceur, et oriente vers un professionnel.
 */
const CARE_PATTERNS = [
  /\blaxatifs?\b|\bdiur[ée]tiques?\b|\bcoupe-?faim\b/i,
  /\b(me faire |se faire )?vomir\b|\bvomissements?\b|\bpurger?\b/i,
  /\banorexi\w*|\bboulimi\w*|\bhyperphagi\w*/i,
  /\b(ne plus|arr[êe]ter de|plus jamais) manger\b|\bsauter tous (les|mes) repas\b/i,
  /\bje[uû]n\w*\s+(?:de\s+|pendant\s+)?(?:\d+|deux|trois|quatre|cinq|six|sept|plusieurs)\s*jours?\b/i,
];
/** Au-delà, un jeûne sort de ce que propose l'app (20 h au plus). */
const MAX_FAST_HOURS = 24;

export function mentionsRiskyPractice(message: string): boolean {
  if (CARE_PATTERNS.some((pattern) => pattern.test(message))) return true;
  for (const match of message.matchAll(/je[uû]n\w*\D{0,20}?(\d{2,3})\s*h(?:eures?)?\b/gi)) {
    if (Number(match[1]) > MAX_FAST_HOURS) return true;
  }
  return false;
}

/**
 * Réponse du LLM qui propose un apport quotidien sous le plancher (« 1 000 kcal par jour ») :
 * elle est remplacée par la réponse locale. Seuls les totaux journaliers comptent, pas
 * « il te reste 400 kcal ».
 */
export function suggestsDailyBelowFloor(reply: string, floor: number): boolean {
  const pattern =
    /(\d[\d\s.\u202f\u00a0]{1,6})\s*(?:k?cal|calories?)\b[^.!?\n]{0,25}?(?:par jour|\/\s*jour|par journ[ée]e|quotidien\w*|chaque jour|per day|a day)/gi;
  for (const match of reply.matchAll(pattern)) {
    const value = Number(match[1]!.replace(/[\s.\u202f\u00a0]/g, ""));
    if (value >= 300 && value < floor) return true;
  }
  return false;
}

/** Message utilisateur aplati sur une ligne pour le prompt : il ne peut pas imiter une réplique du coach. */
export function promptLine(message: string): string {
  return message.replace(/\s+/g, " ").trim();
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
  /** Lignes de l'historique des repas (voir `mealHistoryLines`). */
  history?: readonly string[];
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
    ...(input.history ?? []),
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

// --- Historique des repas pour le coach ------------------------------------------------

export type HistoryEntry = {
  date: string;
  slot: MealSlot;
  label: string;
  dish: string | null;
  grams: number;
  kcal: number;
  proteinG: number;
};

const SLOT_NAMES: Record<MealSlot, string> = {
  breakfast: "petit-déjeuner",
  lunch: "déjeuner",
  snack: "collation",
  dinner: "dîner",
};
const SLOT_ORDER: readonly MealSlot[] = ["breakfast", "lunch", "snack", "dinner"];

/** « Pâtes alimentaires, cuites, nature » → « pâtes alimentaires » : le début suffit au coach. */
function shortName(label: string): string {
  return label.split(/[,(]/)[0]!.trim().toLowerCase();
}

/** Repas d'un jour, regroupés par plat : « déjeuner : Pâtes au saumon (pâtes 180 g, saumon 100 g) ». */
function dayMeals(entries: readonly HistoryEntry[], withGrams: boolean): string {
  return SLOT_ORDER.flatMap((slot) => {
    const inSlot = entries.filter((entry) => entry.slot === slot);
    if (inSlot.length === 0) return [];
    const parts: string[] = [];
    const byDish = new Map<string, HistoryEntry[]>();
    for (const entry of inSlot) {
      if (entry.dish) byDish.set(entry.dish, [...(byDish.get(entry.dish) ?? []), entry]);
      else parts.push(food(entry));
    }
    for (const [dish, items] of byDish) parts.unshift(`${dish} (${items.map(food).join(", ")})`);
    return [`${SLOT_NAMES[slot]} : ${parts.join(", ")}`];
  }).join(" ; ");

  function food(entry: HistoryEntry): string {
    return withGrams ? `${shortName(entry.label)} ${Math.round(entry.grams)} g` : shortName(entry.label);
  }
}

/** Jours passés dont le coach voit le détail des repas (au-delà, les moyennes de `longHistoryLines`). */
export const DETAILED_MEAL_DAYS = 6;

/**
 * Historique des repas pour personnaliser le coach : le détail d'aujourd'hui (avec les grammes),
 * les plats de chacun des 6 jours précédents, les totaux des 7 derniers jours et les plats les
 * plus fréquents sur tout l'historique fourni. Quelques lignes : les tokens se paient.
 */
export function mealHistoryLines(
  entries: readonly HistoryEntry[],
  today: string,
  dayBefore: (days: number) => string,
): string[] {
  const byDate = new Map<string, HistoryEntry[]>();
  for (const entry of entries) byDate.set(entry.date, [...(byDate.get(entry.date) ?? []), entry]);
  const on = (date: string) => byDate.get(date) ?? [];
  const lines: string[] = [];
  const todays = on(today);
  lines.push(todays.length > 0 ? `Repas d'aujourd'hui : ${dayMeals(todays, true)}.` : "Rien de saisi aujourd'hui.");
  for (let offset = 1; offset <= DETAILED_MEAL_DAYS; offset++) {
    const date = dayBefore(offset);
    const day = on(date);
    const name = offset === 1 ? "Hier" : offset === 2 ? "Avant-hier" : `Le ${date.slice(5)}`;
    if (day.length > 0) lines.push(`${name} : ${dayMeals(day, false)}.`);
  }
  const week = Array.from({ length: 7 }, (_, index) => dayBefore(index + 1)).flatMap((date) => {
    const day = on(date);
    if (day.length === 0) return [];
    const kcal = day.reduce((sum, entry) => sum + entry.kcal, 0);
    const protein = day.reduce((sum, entry) => sum + entry.proteinG, 0);
    return [`${date.slice(5)} ${Math.round(kcal)} kcal et ${Math.round(protein)} g de protéines`];
  });
  if (week.length > 0) lines.push(`7 derniers jours : ${week.join(" ; ")}.`);
  // Un plat compte une fois par repas, pas une fois par ingrédient.
  const occurrences = new Map<string, string>();
  for (const entry of entries) {
    const key = entry.dish ? `${entry.date}|${entry.slot}|${entry.dish}` : `${entry.date}|${entry.slot}|${entry.label}`;
    occurrences.set(key, entry.dish ?? shortName(entry.label));
  }
  const counts = new Map<string, number>();
  for (const name of occurrences.values()) counts.set(name, (counts.get(name) ?? 0) + 1);
  const frequent = [...counts]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, count]) => `${name} ×${count}`);
  if (frequent.length > 0) lines.push(`Le plus souvent : ${frequent.join(", ")}.`);
  return lines;
}
