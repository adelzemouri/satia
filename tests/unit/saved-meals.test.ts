import { describe, expect, it } from "vitest";

import { macroSplit, savedMealKcal, scaleSavedItem, suggestedMealName } from "@/domain/saved-meals";

describe("suggestedMealName", () => {
  it("reprend les deux premiers aliments et compte les autres", () => {
    expect(suggestedMealName(["Granola maison"])).toBe("Granola maison");
    expect(suggestedMealName(["Granola", "Yaourt nature"])).toBe("Granola, Yaourt nature");
    expect(suggestedMealName(["Granola", "Yaourt", "Myrtilles", "Café"])).toBe("Granola, Yaourt +2");
  });

  it("reste vide sans aliment et tient dans la longueur permise", () => {
    expect(suggestedMealName([" ", ""])).toBe("");
    const long = suggestedMealName(["a".repeat(50), "b".repeat(50)], 60);
    expect(long).toHaveLength(60);
    expect(long.endsWith("…")).toBe(true);
  });
});

describe("savedMealKcal", () => {
  it("additionne et arrondit", () => {
    expect(savedMealKcal([{ kcal: 212.4 }, { kcal: 80.3 }])).toBe(293);
    expect(savedMealKcal([])).toBe(0);
  });
});

describe("scaleSavedItem", () => {
  const item = {
    label: "Œuf dur",
    unit: "piece",
    quantity: 1,
    grams: 55,
    kcal: 74,
    proteinG: 7,
    carbsG: 0.3,
    fatG: 5.2,
  };

  it("suit la nouvelle quantité dans l'unité de la ligne", () => {
    expect(scaleSavedItem(item, 2)).toEqual({
      ...item,
      quantity: 2,
      grams: 110,
      kcal: 148,
      proteinG: 14,
      carbsG: 0.6,
      fatG: 10.4,
    });
    expect(scaleSavedItem(item, 1)).toEqual(item);
  });
});

describe("macroSplit", () => {
  it("donne les grammes et la part des calories de chaque macro, total 100 %", () => {
    const split = macroSplit([
      { proteinG: 20.4, carbsG: 50, fatG: 10 },
      { proteinG: 7.8, carbsG: 2.2, fatG: 11.1 },
    ]);
    expect(split).toMatchObject({ proteinG: 28, carbsG: 52, fatG: 21 });
    expect(split.percent).toEqual({ protein: 22, carbs: 41, fat: 37 });
  });

  it("arrondit sans perdre ni ajouter de point", () => {
    const { percent } = macroSplit([
      { proteinG: 1, carbsG: 1, fatG: 0 },
      { proteinG: 0, carbsG: 0, fatG: 4 / 9 },
    ]);
    expect(percent.protein + percent.carbs + percent.fat).toBe(100);
  });

  it("reste à zéro sans macros", () => {
    expect(macroSplit([]).percent).toEqual({ protein: 0, carbs: 0, fat: 0 });
  });
});
