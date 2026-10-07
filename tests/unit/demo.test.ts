import { describe, expect, it } from "vitest";

import { catalogRecipe } from "@/domain/recipes/catalog";
import { DEMO_DAYS, demoData } from "@/domain/demo";

describe("données du compte démo", () => {
  const today = "2026-10-07";
  const data = demoData(today);

  it("est déterministe pour une même date", () => {
    expect(demoData(today)).toEqual(data);
  });

  it("couvre les semaines passées et seulement le petit-déjeuner du jour", () => {
    expect(data.start).toBe("2026-09-02");
    const days = new Set(data.entries.map((entry) => entry.date));
    expect(days.size).toBe(DEMO_DAYS + 1 - 2);
    expect(data.entries.every((entry) => entry.date <= today)).toBe(true);
    expect(data.entries.filter((entry) => entry.date === today).map((entry) => entry.slot)).toEqual(
      expect.arrayContaining(["breakfast"]),
    );
    expect(new Set(data.entries.filter((entry) => entry.date === today).map((entry) => entry.slot)).size).toBe(1);
  });

  it("ne renvoie qu'à des recettes du catalogue qui existent", () => {
    for (const entry of data.entries) {
      if ("recipe" in entry.food) expect(catalogRecipe(entry.food.recipe), entry.food.recipe).toBeDefined();
    }
  });

  it("montre une perte de poids douce et des valeurs plausibles", () => {
    const first = data.weights[0]!.weightKg;
    const last = data.weights.at(-1)!.weightKg;
    expect(first - last).toBeGreaterThan(1);
    expect(first - last).toBeLessThan(3.5);
    expect(data.water.every((row) => row.glasses >= 0 && row.glasses <= 12)).toBe(true);
    expect(data.checkins.every((row) => [row.hunger, row.energy, row.mood].every((v) => v >= 1 && v <= 5))).toBe(true);
  });
});
