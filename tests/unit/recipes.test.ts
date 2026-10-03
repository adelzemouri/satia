import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CATALOG, catalogRecipeFor, ideasForSlot, RECIPE_CATEGORIES } from "@/domain/recipes/catalog";
import { ART_HEIGHT, ART_WIDTH, inArea, layoutDish } from "@/domain/recipes/dish-art";
import { catalogRecipeValues, type IngredientValues } from "@/domain/recipes/values";

import { parseCsvLine } from "../../scripts/ciqual/format";

const ciqual = new Map(
  readFileSync("data/ciqual-2020.csv", "utf8")
    .trim()
    .split("\n")
    .slice(1)
    .map(parseCsvLine)
    .map((row): [string, IngredientValues] => [
      row[0]!,
      {
        kcal: Number(row[4]),
        proteinG: Number(row[5]),
        carbsG: Number(row[6]),
        fatG: Number(row[7]),
        fiberG: row[8] ? Number(row[8]) : null,
        sugarsG: row[9] ? Number(row[9]) : null,
        saltG: row[10] ? Number(row[10]) : null,
        fruitVegShare: 0,
      },
    ]),
);

describe("catalogue de recettes", () => {
  it("a des recettes complètes dans chaque catégorie", () => {
    expect(new Set(CATALOG.map((recipe) => recipe.slug)).size).toBe(CATALOG.length);
    for (const category of RECIPE_CATEGORIES) {
      expect(CATALOG.filter((recipe) => recipe.category === category).length).toBeGreaterThanOrEqual(3);
    }
    for (const recipe of CATALOG) {
      expect(recipe.slug).toMatch(/^[a-z0-9-]+$/);
      expect(recipe.steps.length).toBeGreaterThanOrEqual(2);
      expect(recipe.ingredients.length).toBeGreaterThanOrEqual(2);
      expect(recipe.servings).toBeGreaterThan(0);
      expect(recipe.art.layers.length).toBeGreaterThan(0);
    }
  });

  it("ne cite que des ingrédients de la table Ciqual et donne des portions raisonnables", () => {
    for (const recipe of CATALOG) {
      for (const [code] of recipe.ingredients) expect(ciqual.has(code), `${recipe.slug} : ${code}`).toBe(true);
      const values = catalogRecipeValues(recipe, ciqual);
      const portionKcal = (values.kcal * values.portionGrams) / 100;
      expect(portionKcal, recipe.slug).toBeGreaterThan(80);
      expect(portionKcal, recipe.slug).toBeLessThan(700);
    }
  });

  it("retrouve une recette depuis la référence de l'aliment", () => {
    expect(catalogRecipeFor("catalog:minestrone")?.name).toBe("Minestrone");
    expect(catalogRecipeFor("3017620422003")).toBeUndefined();
    expect(catalogRecipeFor(null)).toBeUndefined();
  });

  it("propose des idées du repas, stables dans la journée", () => {
    const entries = CATALOG.map((recipe) => ({ recipe }));
    const breakfast = ideasForSlot(entries, "breakfast", "u:2026-10-03", 4);
    expect(breakfast).toHaveLength(4);
    expect(breakfast.every(({ recipe }) => ["breakfast", "snack"].includes(recipe.category))).toBe(true);
    expect(ideasForSlot(entries, "breakfast", "u:2026-10-03", 4)).toEqual(breakfast);
    expect(
      ideasForSlot(entries, "dinner", "u:2026-10-03", 40).every(({ recipe }) => recipe.category !== "dessert"),
    ).toBe(true);
  });
});

describe("illustrations de plats", () => {
  it("place les ingrédients dans la vignette, toujours au même endroit", () => {
    for (const recipe of CATALOG) {
      const layers = layoutDish(recipe.art, recipe.slug);
      expect(layoutDish(recipe.art, recipe.slug)).toEqual(layers);
      for (const layer of layers) {
        if (layer.kind !== "pieces") continue;
        expect(layer.pieces.length, recipe.slug).toBeGreaterThan(0);
        for (const piece of layer.pieces) {
          expect(piece.x).toBeGreaterThan(0);
          expect(piece.x).toBeLessThan(ART_WIDTH);
          expect(piece.y).toBeGreaterThan(0);
          expect(piece.y).toBeLessThan(ART_HEIGHT);
        }
      }
    }
  });

  it("découpe le récipient en zones", () => {
    expect(inArea("left", -10, 0, 30)).toBe(true);
    expect(inArea("left", 10, 0, 30)).toBe(false);
    expect(inArea("center", 5, 5, 30)).toBe(true);
    expect(inArea("ring", 5, 5, 30)).toBe(false);
    expect(inArea("all", 40, 0, 30)).toBe(false);
    // Quatre parts : une à droite (en partant du haut), une en bas, une à gauche, une en haut.
    expect(inArea("sector:0/4", 10, -10, 30)).toBe(true);
    expect(inArea("sector:1/4", 10, 10, 30)).toBe(true);
    expect(inArea("sector:2/4", -10, 10, 30)).toBe(true);
    expect(inArea("sector:3/4", -10, -10, 30)).toBe(true);
  });
});
