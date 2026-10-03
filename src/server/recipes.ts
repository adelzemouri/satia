import "server-only";

import { and, eq, like } from "drizzle-orm";

import { db } from "@/db/client";
import { foods } from "@/db/schema";
import { CATALOG, CATALOG_PREFIX, type CatalogRecipe, catalogRecipeFor } from "@/domain/recipes/catalog";

export type CatalogEntry = {
  id: string;
  recipe: CatalogRecipe;
  portionKcal: number;
  portionProteinG: number;
};

/** Recettes du catalogue présentes en base, dans l'ordre du catalogue. */
export async function catalogEntries(): Promise<CatalogEntry[]> {
  const rows = await db()
    .select({
      id: foods.id,
      sourceRef: foods.sourceRef,
      kcal: foods.kcal,
      proteinG: foods.proteinG,
      unitWeights: foods.unitWeights,
    })
    .from(foods)
    .where(and(eq(foods.source, "recipe"), like(foods.sourceRef, `${CATALOG_PREFIX}%`)));
  const order = new Map(CATALOG.map((recipe, index) => [recipe.slug, index]));
  return rows
    .flatMap((row) => {
      const recipe = catalogRecipeFor(row.sourceRef);
      if (!recipe) return [];
      const portion = row.unitWeights?.portion ?? 100;
      return [
        {
          id: row.id,
          recipe,
          portionKcal: Math.round((row.kcal * portion) / 100),
          portionProteinG: Math.round((row.proteinG * portion) / 100),
        },
      ];
    })
    .sort((a, b) => order.get(a.recipe.slug)! - order.get(b.recipe.slug)!);
}
