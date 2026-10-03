import { type Nutrients, nutrientsFor, recipePer100g } from "@/domain/nutrition";
import { recipeQuality } from "@/domain/quality";

import type { CatalogRecipe } from "./catalog";

/** Valeurs Ciqual pour 100 g d'un ingrédient. */
export type IngredientValues = Nutrients & {
  fiberG: number | null;
  sugarsG: number | null;
  saltG: number | null;
  fruitVegShare: number;
};

/**
 * Valeurs pour 100 g d'une recette du catalogue et poids d'une portion, calculés comme pour
 * une recette saisie par la famille (les ingrédients sont pesés crus ou cuits selon la recette).
 */
export function catalogRecipeValues(recipe: CatalogRecipe, byCode: ReadonlyMap<string, IngredientValues>) {
  const items = recipe.ingredients.map(([code, grams]) => {
    const values = byCode.get(code);
    if (!values) throw new Error(`Ingrédient Ciqual ${code} introuvable pour « ${recipe.slug} »`);
    return { ...values, grams };
  });
  const totalGrams = items.reduce((sum, item) => sum + item.grams, 0);
  return {
    ...recipePer100g(
      items.map((item) => nutrientsFor(item, item.grams)),
      totalGrams,
    ),
    ...recipeQuality(items, totalGrams),
    portionGrams: Math.round((totalGrams / recipe.servings) * 10) / 10,
  };
}
