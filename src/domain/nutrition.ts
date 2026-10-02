/** Valeurs nutritionnelles (calcul pur). */

export type Nutrients = { kcal: number; proteinG: number; carbsG: number; fatG: number };

export const ZERO_NUTRIENTS: Nutrients = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

/** Valeurs pour une quantité en grammes, à partir des valeurs pour 100 g. */
export function nutrientsFor(per100g: Nutrients, grams: number): Nutrients {
  const ratio = grams / 100;
  return {
    kcal: round1(per100g.kcal * ratio),
    proteinG: round1(per100g.proteinG * ratio),
    carbsG: round1(per100g.carbsG * ratio),
    fatG: round1(per100g.fatG * ratio),
  };
}

export function sumNutrients(items: readonly Nutrients[]): Nutrients {
  const total = items.reduce(
    (acc, item) => ({
      kcal: acc.kcal + item.kcal,
      proteinG: acc.proteinG + item.proteinG,
      carbsG: acc.carbsG + item.carbsG,
      fatG: acc.fatG + item.fatG,
    }),
    ZERO_NUTRIENTS,
  );
  return {
    kcal: round1(total.kcal),
    proteinG: round1(total.proteinG),
    carbsG: round1(total.carbsG),
    fatG: round1(total.fatG),
  };
}

/** Valeurs pour 100 g d'une recette, à partir de ses ingrédients et de son poids total. */
export function recipePer100g(ingredients: readonly Nutrients[], totalGrams: number): Nutrients {
  if (totalGrams <= 0) return ZERO_NUTRIENTS;
  return nutrientsFor(sumNutrients(ingredients), 10_000 / totalGrams);
}

/** Énergie estimée depuis les macros (4/4/9 kcal par gramme), quand l'énergie manque. */
export function kcalFromMacros(proteinG: number, carbsG: number, fatG: number): number {
  return round1(proteinG * 4 + carbsG * 4 + fatG * 9);
}

/**
 * Zone du jour selon l'apport comparé à la dépense estimée (TDEE) :
 * en dessous de 95 % → perte, au-dessus de 105 % → prise, sinon maintien.
 */
export type EnergyZone = "loss" | "maintenance" | "gain";
export function energyZone(intakeKcal: number, tdee: number): EnergyZone {
  if (intakeKcal < tdee * 0.95) return "loss";
  if (intakeKcal > tdee * 1.05) return "gain";
  return "maintenance";
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
