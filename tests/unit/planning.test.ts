import { describe, expect, it } from "vitest";

import { aisleOf, roundForShopping, shoppingFromPlan } from "@/domain/planning";

describe("rayons", () => {
  it.each([
    ["légumes", "produce"],
    ["fruits", "produce"],
    ["pommes de terre et autres tubercules", "produce"],
    ["fruits à coque et graines oléagineuses", "grocery"],
    ["légumineuses", "grocery"],
    ["viandes crues", "meat_fish"],
    ["poissons cuits", "meat_fish"],
    ["fromages et assimilés", "dairy"],
    ["œufs", "dairy"],
    ["pains et assimilés", "bakery"],
    ["gâteaux et pâtisseries", "bakery"],
    ["eaux", "drinks"],
    ["pâtes, riz et céréales", "grocery"],
    ["huiles et graisses végétales", "grocery"],
    ["plats composés", "other"],
    [null, "other"],
  ] as const)("%s → %s", (group, aisle) => {
    expect(aisleOf(group)).toBe(aisle);
  });
});

describe("arrondi des courses", () => {
  it("arrondit au pas lisible, sans descendre à zéro", () => {
    expect(roundForShopping(1)).toBe(5);
    expect(roundForShopping(42)).toBe(40);
    expect(roundForShopping(43)).toBe(45);
    expect(roundForShopping(234)).toBe(230);
    expect(roundForShopping(1234)).toBe(1250);
  });
});

describe("liste de courses tirée du menu", () => {
  const lentils = { foodId: "l", name: "Lentille", group: "légumineuses", gramsPerServing: 50 };
  const carrot = { foodId: "c", name: "Carotte", group: "légumes", gramsPerServing: 30 };
  const cheese = { foodId: "f", name: "Comté", group: "fromages et assimilés", gramsPerServing: 20 };

  it("additionne les ingrédients selon les parts et trie par rayon", () => {
    const lines = shoppingFromPlan([
      { servings: 4, ingredients: [lentils, carrot] },
      { servings: 2, ingredients: [carrot, cheese] },
    ]);
    expect(lines).toEqual([
      { foodId: "c", name: "Carotte", grams: 180, aisle: "produce" },
      { foodId: "f", name: "Comté", grams: 40, aisle: "dairy" },
      { foodId: "l", name: "Lentille", grams: 200, aisle: "grocery" },
    ]);
  });

  it("renvoie une liste vide sans plat", () => {
    expect(shoppingFromPlan([])).toEqual([]);
  });
});
