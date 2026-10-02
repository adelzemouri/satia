import { describe, expect, it } from "vitest";

import { energyZone, kcalFromMacros, nutrientsFor, recipePer100g, sumNutrients } from "@/domain/nutrition";
import { normalizeForSearch } from "@/domain/search";
import { computeStreak, isoWeekStart } from "@/domain/streak";
import { availableUnits, toGrams } from "@/domain/units";
import { projectGoalDate, weeklyChangeKg, weightTrend } from "@/domain/weight-trend";

describe("toGrams", () => {
  const milk = { densityGPerMl: 1.03 };
  const bread = { unitWeights: { slice: 40 } };

  it("convertit les masses", () => {
    expect(toGrams(150, "g", {})).toBe(150);
    expect(toGrams(0.5, "kg", {})).toBe(500);
  });

  it("convertit les volumes avec la masse volumique de l'aliment", () => {
    expect(toGrams(200, "ml", milk)).toBeCloseTo(206);
    expect(toGrams(2, "tbsp", milk)).toBeCloseTo(30.9);
    expect(toGrams(1, "cup", milk)).toBeCloseTo(257.5);
    expect(toGrams(25, "cl", milk)).toBeCloseTo(257.5);
  });

  it("refuse un volume quand la masse volumique est inconnue", () => {
    expect(toGrams(200, "ml", bread)).toBeNull();
  });

  it("utilise le poids unitaire connu", () => {
    expect(toGrams(2, "slice", bread)).toBe(80);
    expect(toGrams(1, "piece", bread)).toBeNull();
  });

  it("refuse les quantités nulles ou négatives", () => {
    expect(toGrams(0, "g", {})).toBeNull();
    expect(toGrams(-1, "g", {})).toBeNull();
  });

  it("ne propose que les unités convertibles", () => {
    expect(availableUnits(bread)).toEqual(["g", "kg", "slice"]);
    expect(availableUnits(milk)).toEqual(["g", "kg", "ml", "cl", "l", "tsp", "tbsp", "cup"]);
  });
});

describe("nutrition", () => {
  const rice = { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 };

  it("calcule les valeurs d'une quantité", () => {
    expect(nutrientsFor(rice, 200)).toEqual({ kcal: 260, proteinG: 5.4, carbsG: 56, fatG: 0.6 });
  });

  it("additionne des aliments", () => {
    expect(sumNutrients([nutrientsFor(rice, 100), nutrientsFor(rice, 50)])).toEqual({
      kcal: 195,
      proteinG: 4.1,
      carbsG: 42,
      fatG: 0.5,
    });
  });

  it("ramène une recette à 100 g", () => {
    const ingredients = [nutrientsFor(rice, 300), { kcal: 90, proteinG: 0, carbsG: 0, fatG: 10 }];
    expect(recipePer100g(ingredients, 400)).toEqual({ kcal: 120, proteinG: 2, carbsG: 21, fatG: 2.7 });
  });

  it("estime l'énergie depuis les macros", () => {
    expect(kcalFromMacros(10, 20, 5)).toBe(165);
  });

  it("situe l'apport par rapport à la dépense", () => {
    expect(energyZone(1800, 2200)).toBe("loss");
    expect(energyZone(2200, 2200)).toBe("maintenance");
    expect(energyZone(2600, 2200)).toBe("gain");
  });
});

describe("normalizeForSearch", () => {
  it("retire accents, ligatures et ponctuation", () => {
    expect(normalizeForSearch("Œuf dur, écalé")).toBe("oeuf dur ecale");
    expect(normalizeForSearch("  Crème   fraîche 30% ")).toBe("creme fraiche 30");
  });
});

describe("computeStreak", () => {
  const days = (...list: string[]) => new Set(list);

  it("compte les jours consécutifs jusqu'à aujourd'hui", () => {
    expect(computeStreak(days("2026-10-01", "2026-10-02"), "2026-10-02")).toEqual({ days: 2, frozenDays: [] });
  });

  it("ne casse pas la série si aujourd'hui n'est pas encore saisi", () => {
    expect(computeStreak(days("2026-09-30", "2026-10-01"), "2026-10-02").days).toBe(2);
  });

  it("couvre un jour manqué par semaine avec un gel", () => {
    // Semaine du lundi 28/09 : mercredi 30 manqué.
    const streak = computeStreak(days("2026-09-28", "2026-09-29", "2026-10-01", "2026-10-02"), "2026-10-02");
    expect(streak).toEqual({ days: 4, frozenDays: ["2026-09-30"] });
  });

  it("n'accorde qu'un gel par semaine", () => {
    const streak = computeStreak(days("2026-09-28", "2026-09-30", "2026-10-02"), "2026-10-02");
    expect(streak).toEqual({ days: 2, frozenDays: ["2026-10-01"] });
  });

  it("ne couvre pas deux jours manqués d'affilée", () => {
    expect(computeStreak(days("2026-09-28", "2026-10-01", "2026-10-02"), "2026-10-02").days).toBe(2);
  });

  it("vaut zéro sans saisie récente", () => {
    expect(computeStreak(days("2026-09-20"), "2026-10-02").days).toBe(0);
  });

  it("trouve le lundi de la semaine", () => {
    expect(isoWeekStart("2026-10-04")).toBe("2026-09-28");
    expect(isoWeekStart("2026-09-28")).toBe("2026-09-28");
  });
});

describe("weightTrend", () => {
  it("lisse les pesées et garde la tendance les jours sans pesée", () => {
    const points = weightTrend([
      { date: "2026-10-01", weightKg: 80 },
      { date: "2026-10-03", weightKg: 82 },
    ]);
    expect(points).toEqual([
      { date: "2026-10-01", trendKg: 80, weightKg: 80 },
      { date: "2026-10-02", trendKg: 80, weightKg: null },
      { date: "2026-10-03", trendKg: 80.2, weightKg: 82 },
    ]);
  });

  it("mesure la pente hebdomadaire et projette la date d'objectif", () => {
    const weighIns = Array.from({ length: 28 }, (_, i) => ({
      date: `2026-09-${String(i + 1).padStart(2, "0")}`,
      weightKg: 80 - (i * 0.5) / 7,
    }));
    const points = weightTrend(weighIns);
    const weekly = weeklyChangeKg(points)!;
    expect(weekly).toBeLessThan(0);
    expect(weekly).toBeGreaterThan(-0.5);
    expect(projectGoalDate(points.at(-1)!, weekly, 75)).toMatch(/^202[67]-/);
    expect(projectGoalDate(points.at(-1)!, weekly, 85)).toBeNull();
  });

  it("n'estime pas de pente avec moins d'une semaine de données", () => {
    expect(weeklyChangeKg(weightTrend([{ date: "2026-10-01", weightKg: 80 }]))).toBeNull();
  });
});
