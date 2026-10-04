import { describe, expect, it } from "vitest";

import { savedMealKcal, suggestedMealName } from "@/domain/saved-meals";

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
