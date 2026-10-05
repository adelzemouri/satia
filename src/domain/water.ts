/** Eau bue : verres saisis au compteur et eau notée dans les repas (calcul pur). */

/** Contenance d'un verre. */
export const GLASS_ML = 250;

/** Groupe Ciqual des eaux de boisson. */
export const WATER_GROUP = "eaux";

/**
 * Un aliment compte comme de l'eau s'il est dans le groupe Ciqual des eaux, ou si son nom
 * commence par « eau » sans apporter d'énergie (eau de coco, eau-de-vie : non).
 */
export function isWaterFood(food: { groupFr: string | null; kcal: number; searchName: string }): boolean {
  return food.groupFr === WATER_GROUP || (food.kcal <= 1 && /^eaux?( |$)/.test(food.searchName));
}

/** Verres comptés pour l'eau d'un repas, arrondis au verre le plus proche. */
export function glassesFromMl(ml: number): number {
  return ml > 0 ? Math.round(ml / GLASS_ML) : 0;
}
