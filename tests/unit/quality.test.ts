import { describe, expect, it } from "vitest";

import {
  dayQuality,
  fruitVegShareForCategories,
  fruitVegShareForGroup,
  type QualityItem,
  recipeQuality,
  toNovaGroup,
  toNutriscore,
  weekQuality,
} from "@/domain/quality";

function item(patch: Partial<QualityItem>): QualityItem {
  return {
    date: "2026-10-01",
    name: "Aliment",
    grams: 100,
    kcal: 100,
    fiberG: null,
    sugarsG: null,
    saltG: null,
    novaGroup: null,
    fruitVegShare: 0,
    ...patch,
  };
}

describe("qualité nutritionnelle", () => {
  it("compte les fibres et les portions de fruits et légumes du jour", () => {
    expect(
      dayQuality([
        item({ name: "Lentilles", grams: 200, fiberG: 8 }),
        item({ name: "Pomme", grams: 160, fiberG: 2, fruitVegShare: 1 }),
        item({ name: "Ratatouille", grams: 100, fruitVegShare: 0.8 }),
      ]),
    ).toEqual({ fiberG: 19.2, fruitVegPortions: 3 });
  });

  it("calcule le bilan de la semaine sur les jours saisis, avec des idées positives", () => {
    const week = weekQuality([
      item({ date: "2026-10-01", name: "Chips", kcal: 500, grams: 90, saltG: 1.5, novaGroup: 4 }),
      item({ date: "2026-10-01", name: "Pâtes", kcal: 500, grams: 250, saltG: 0.1, fiberG: 2, novaGroup: 1 }),
      item({ date: "2026-10-02", name: "Soupe", kcal: 200, grams: 300, saltG: 0.8, fruitVegShare: 1 }),
    ])!;
    expect(week.daysLogged).toBe(2);
    expect(week.ultraProcessedShare).toBe(0.5);
    expect(week.novaCoverage).toBe(0.83);
    expect(week.saltPerDay).toBe(2);
    expect(week.fruitVegPortionsPerDay).toBe(1.9);
    expect(week.topSalt).toEqual(["Soupe", "Chips", "Pâtes"]);
    expect(week.topUltraProcessed).toEqual(["Chips"]);
    expect(week.suggestions).toEqual(["fruitVeg", "fiber"]);
    expect(weekQuality([])).toBeNull();
  });

  it("félicite quand tout va bien", () => {
    const days = ["2026-10-01", "2026-10-02"].flatMap((date) => [
      item({ date, grams: 400, fiberG: 8, fruitVegShare: 1, saltG: 0.5, novaGroup: 1 }),
    ]);
    expect(weekQuality(days)!.suggestions).toEqual(["keepGoing"]);
  });

  it("calcule la qualité d'une recette à partir de ses ingrédients", () => {
    expect(
      recipeQuality(
        [
          { grams: 300, fiberG: 2, sugarsG: 3, saltG: 0.1, fruitVegShare: 1 },
          { grams: 100, fiberG: 3, sugarsG: null, saltG: 1, fruitVegShare: 0 },
        ],
        400,
      ),
    ).toEqual({ fiberG: 2.25, sugarsG: null, saltG: 0.33, fruitVegShare: 0.75 });
  });

  it("lit Nutri-Score, NOVA et fruits/légumes des sources ouvertes", () => {
    expect(toNutriscore("B")).toBe("b");
    expect(toNutriscore("not-applicable")).toBeNull();
    expect(toNovaGroup(4)).toBe(4);
    expect(toNovaGroup(7)).toBeNull();
    expect(fruitVegShareForGroup("légumes")).toBe(1);
    expect(fruitVegShareForGroup("fruits à coque et graines oléagineuses")).toBe(0);
    expect(fruitVegShareForCategories(["en:plant-based-foods", "en:fresh-vegetables"])).toBe(1);
    expect(fruitVegShareForCategories(["en:beverages", "en:fresh-fruits"])).toBe(0);
  });
});
