import { describe, expect, it } from "vitest";

import { savedMealKcal, scaleSavedItem, suggestedMealName } from "@/domain/saved-meals";

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
