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
