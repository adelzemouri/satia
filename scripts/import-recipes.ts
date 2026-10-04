/**
 * Charge les recettes du catalogue (`src/domain/recipes/catalog.ts`) dans la table `foods`
 * (source « recipe », `source_ref` = `catalog:<slug>`, visibles par tous), avec leurs
 * ingrédients. Lancé après l'import Ciqual ; ne fait rien si rien n'a changé.
 */
import { createHash } from "node:crypto";

import postgres from "postgres";

import { CATALOG, CATALOG_PREFIX } from "../src/domain/recipes/catalog";
import { RECIPE_PHOTOS } from "../src/features/recipes/recipe-photos";
import { catalogRecipeValues, type IngredientValues } from "../src/domain/recipes/values";
import { normalizeForSearch } from "../src/domain/search";

const SETTING_KEY = "recipes_catalog_sha256";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL manquante");
const sql = postgres(url, { max: 1 });

try {
  const codes = [...new Set(CATALOG.flatMap((recipe) => recipe.ingredients.map(([code]) => code)))];
  const ingredients = await sql<
    (IngredientValues & { id: string; source_ref: string })[]
  >`select id, source_ref, kcal::float8 as kcal, protein_g::float8 as "proteinG", carbs_g::float8 as "carbsG",
      fat_g::float8 as "fatG", fiber_g::float8 as "fiberG", sugars_g::float8 as "sugarsG", salt_g::float8 as "saltG",
      fruit_veg_share::float8 as "fruitVegShare"
    from foods where source = 'ciqual' and source_ref in ${sql(codes)}`;
  if (ingredients.length === 0) {
    console.log("Table Ciqual vide : import des recettes ignoré.");
  } else {
    const byCode = new Map(ingredients.map((row) => [row.source_ref, row]));
    const hash = createHash("sha256")
      .update(JSON.stringify(CATALOG))
      .update(JSON.stringify([...RECIPE_PHOTOS].sort()))
      .update(JSON.stringify(ingredients.map((row) => [row.source_ref, row.kcal, row.proteinG])))
      .digest("hex");
    const [current] = await sql<
      { value: string }[]
    >`select value #>> '{}' as value from app_settings where key = ${SETTING_KEY}`;
    const [counted] = await sql<
      { count: number }[]
    >`select count(*)::int as count from foods where source = 'recipe' and source_ref like ${`${CATALOG_PREFIX}%`}`;
    if (current?.value === hash && counted?.count === CATALOG.length) {
      console.log("Recettes du catalogue déjà à jour.");
    } else {
      await sql.begin(async (tx) => {
        for (const recipe of CATALOG) {
          const values = catalogRecipeValues(recipe, byCode);
          const row = {
            source: "recipe",
            source_ref: `${CATALOG_PREFIX}${recipe.slug}`,
            name_fr: recipe.name,
            name_en: recipe.nameEn,
            search_name: normalizeForSearch(recipe.name),
            kcal: values.kcal,
            protein_g: values.proteinG,
            carbs_g: values.carbsG,
            fat_g: values.fatG,
            fiber_g: values.fiberG,
            sugars_g: values.sugarsG,
            salt_g: values.saltG,
            fruit_veg_share: values.fruitVegShare,
            servings: recipe.servings,
            unit_weights: sql.json({ portion: values.portionGrams }),
            // La photo de la recette sert de vignette partout où l'aliment apparaît (listes, quantité, journal).
            image_url: RECIPE_PHOTOS.has(recipe.slug) ? `/recipes/${recipe.slug}-480.webp` : null,
          };
          const [saved] = await tx<{ id: string }[]>`
            insert into foods ${tx(row)}
            on conflict (source, source_ref) do update set
              name_fr = excluded.name_fr, name_en = excluded.name_en, search_name = excluded.search_name,
              kcal = excluded.kcal, protein_g = excluded.protein_g, carbs_g = excluded.carbs_g, fat_g = excluded.fat_g,
              fiber_g = excluded.fiber_g, sugars_g = excluded.sugars_g, salt_g = excluded.salt_g,
              fruit_veg_share = excluded.fruit_veg_share, servings = excluded.servings,
              unit_weights = excluded.unit_weights, image_url = excluded.image_url, updated_at = now()
            returning id
          `;
          await tx`delete from recipe_items where recipe_id = ${saved!.id}`;
          await tx`insert into recipe_items ${tx(
            recipe.ingredients.map(([code, grams], position) => ({
              recipe_id: saved!.id,
              food_id: byCode.get(code)!.id,
              grams,
              position,
            })),
          )}`;
        }
        await tx`
          insert into app_settings (key, value) values (${SETTING_KEY}, ${tx.json(hash)})
          on conflict (key) do update set value = excluded.value, updated_at = now()
        `;
      });
      console.log(`${CATALOG.length} recettes du catalogue importées.`);
    }
  }
} finally {
  await sql.end();
}
