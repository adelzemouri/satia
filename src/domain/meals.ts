/** Repas de la journée, dans l'ordre d'affichage. */
export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

/** Repas probable selon l'heure locale (quand on ouvre l'ajout sans préciser le repas). */
export function slotAt(now: Date, timeZone: string): MealSlot {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone }).format(now));
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 18) return "snack";
  return "dinner";
}

/** Horaires habituels « HH:MM » des repas principaux ; null au petit-déjeuner pour qui n'en prend pas. */
export type MealTimes = { breakfast: string | null; lunch: string; dinner: string };

/** La personne a indiqué ne pas prendre de petit-déjeuner. */
export function skipsBreakfast(mealTimes: MealTimes): boolean {
  return mealTimes.breakfast === null;
}

/** Repas à mettre en avant maintenant : sans petit-déjeuner, le matin prépare le déjeuner. */
export function upcomingSlot(slot: MealSlot, noBreakfast: boolean): MealSlot {
  return noBreakfast && slot === "breakfast" ? "lunch" : slot;
}
