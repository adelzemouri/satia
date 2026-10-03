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

const COUNT_WORDS: [CountUnit, string][] = [
  ["slice", "tranches?|slices?"],
  [
    "piece",
    "pi[eè]ces?|pieces?|unit[ée]s?|biscuits?|g[aâ]teaux?|madeleines?|barres?|bars?|cookies?|cr[eê]pes?|galettes?|pots?|sachets?",
  ],
];

/**
 * Poids d'une tranche ou d'une pièce déduit de la portion d'un produit Open Food Facts,
 * par exemple « 2 tranches (50 g) » → 25 g la tranche. Rien si le texte ne le dit pas.
 */
export function countUnitsFromServing(
  servingSize: string | null | undefined,
  servingGrams: number | null | undefined,
): Partial<Record<CountUnit, number>> {
  if (!servingSize || !servingGrams || servingGrams <= 0) return {};
  for (const [unit, words] of COUNT_WORDS) {
    // Le nombre placé juste avant le mot (« 2 tranches »), sinon une seule.
    const match = new RegExp(`(?:(\\d+(?:[.,]\\d+)?)\\s*)?(?:${words})(?![a-zà-ÿ])`, "i").exec(servingSize);
    if (!match) continue;
    const count = Number(match[1]?.replace(",", ".") ?? 1);
    if (!Number.isFinite(count) || count <= 0 || count > 50) return {};
    return { [unit]: Math.round((servingGrams / count) * 10) / 10 };
  }
  return {};
}

/** Pas des boutons − et + : 10 g ou 10 ml, une demi-unité pour les tranches, pièces et portions. */
export function stepQuantity(current: number, unit: Unit, direction: 1 | -1): string {
  const step = unit === "g" || unit === "ml" ? 10 : 0.5;
  const base = Number.isFinite(current) && current > 0 ? current : 0;
  // On se cale sur le pas (95 g → 100 g ou 90 g), sans descendre sous un pas.
  const snapped = direction > 0 ? Math.floor(base / step) * step + step : Math.ceil(base / step) * step - step;
  return String(Math.max(step, Math.round(snapped * 10) / 10));
}
