/** Unités de saisie et conversion en grammes (calcul pur). */

export const UNITS = ["g", "kg", "ml", "cl", "l", "tsp", "tbsp", "cup", "portion", "piece", "slice"] as const;
export type Unit = (typeof UNITS)[number];

/** Unités dont le poids dépend de l'aliment (poids d'une pièce, d'une tranche…). */
export const COUNT_UNITS = ["portion", "piece", "slice"] as const satisfies readonly Unit[];
export type CountUnit = (typeof COUNT_UNITS)[number];

/** Volumes en ml des unités de volume. */
const VOLUME_ML: Partial<Record<Unit, number>> = { ml: 1, cl: 10, l: 1000, tsp: 5, tbsp: 15, cup: 250 };

export type ConversionInfo = {
  /** Masse volumique en g/ml ; absente si inconnue (les volumes ne sont alors pas proposés). */
  densityGPerMl?: number | null;
  /** Poids en grammes d'une portion, d'une pièce ou d'une tranche, quand on le connaît. */
  unitWeights?: Partial<Record<CountUnit, number>> | null;
};

/** Convertit une quantité en grammes, ou null si l'unité n'a pas de sens pour cet aliment. */
export function toGrams(quantity: number, unit: Unit, food: ConversionInfo): number | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  if (unit === "g") return quantity;
  if (unit === "kg") return quantity * 1000;
  const ml = VOLUME_ML[unit];
  if (ml !== undefined) return food.densityGPerMl ? quantity * ml * food.densityGPerMl : null;
  const weight = food.unitWeights?.[unit as CountUnit];
  return weight ? quantity * weight : null;
}

/** Unités proposées pour un aliment, dans l'ordre d'affichage. */
export function availableUnits(food: ConversionInfo): Unit[] {
  return UNITS.filter((unit) => toGrams(1, unit, food) !== null);
}
