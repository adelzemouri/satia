import { describe, expect, it } from "vitest";

import { catalogRecipe } from "@/domain/recipes/catalog";
import { DEMO_DAYS, demoData, demoDays, demoSlotsBefore } from "@/domain/demo";

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

describe("jours de démo pour combler les trous", () => {
  it("donne la même journée quelle que soit la période demandée", () => {
    const long = demoDays({ start: "2026-09-02", from: "2026-09-02", today: "2026-10-18", todaySlots: ["breakfast"] });
    const short = demoDays({ start: "2026-09-02", from: "2026-10-10", today: "2026-10-18", todaySlots: ["breakfast"] });
    const day = (data: typeof long) => data.entries.filter((entry) => entry.date === "2026-10-12");
    expect(day(short)).toEqual(day(long));
    expect(day(long).length).toBeGreaterThan(3);
    // La pente du poids part du début de l'historique, pas du début du trou.
    expect(short.weights.find((row) => row.date === "2026-10-11")).toEqual(
      long.weights.find((row) => row.date === "2026-10-11"),
    );
  });

  it("ne saisit aujourd'hui que les repas déjà passés", () => {
    expect(demoSlotsBefore("06:00")).toEqual(["breakfast"]);
    expect(demoSlotsBefore("13:00")).toEqual(["breakfast", "lunch"]);
    expect(demoSlotsBefore("21:00")).toEqual(["breakfast", "lunch", "snack", "dinner"]);
    const data = demoDays({
      start: "2026-09-02",
      from: "2026-10-18",
      today: "2026-10-18",
      todaySlots: ["breakfast", "lunch"],
    });
    expect(new Set(data.entries.map((entry) => entry.slot))).toEqual(new Set(["breakfast", "lunch"]));
    expect(data.activities).toEqual([]);
  });
});
