import { describe, expect, it } from "vitest";

import {
  asksBelowFloor,
  coachContext,
  type DishCandidate,
  mentionsMedicalTopic,
  suggestDish,
  weekStats,
} from "@/domain/coach";

describe("garde-fous du coach", () => {
  it("repère une demande sous le plancher", () => {
    expect(asksBelowFloor("Je veux manger 800 kcal par jour", 1500)).toBe(true);
    expect(asksBelowFloor("Un menu à 1 000 calories ?", 1200)).toBe(true);
    expect(asksBelowFloor("Il me reste 400 kcal ce soir, une idée ?", 1500)).toBe(true);
    expect(asksBelowFloor("Un menu à 1 800 kcal", 1500)).toBe(false);
    expect(asksBelowFloor("Une collation de 200 kcal", 1500)).toBe(false);
    expect(asksBelowFloor("Que manger ce soir ?", 1500)).toBe(false);
  });

  it("repère les questions de dose ou de médicament", () => {
    expect(mentionsMedicalTopic("Quelle dose d'insuline ?")).toBe(true);
    expect(mentionsMedicalTopic("Je prends un médicament, je peux manger quoi ?")).toBe(true);
    expect(mentionsMedicalTopic("Une idée de dîner léger ?")).toBe(false);
  });
});

describe("contexte du coach", () => {
  it("tient en quelques lignes et omet ce qui manque", () => {
    const context = coachContext({
      firstName: "Lina",
      goal: "perdre du poids",
      dateLabel: "Nous sommes le 2026-10-29",
      slot: "dîner",
      goalKcal: 1800,
      consumedKcal: 1234.4,
      macros: { proteinG: 60.2, carbsG: 150, fatG: 40 },
      macroGoals: { proteinG: 100, carbsG: 200, fatG: 60 },
      floorKcal: 1200,
      trendKg: null,
      targetKg: 65,
      diet: "omnivore",
      foodsToAvoid: "",
      fiberG: 18,
      fruitVegPortions: 3,
      feeling: { hunger: null, energy: 2, mood: null },
      weekly: null,
    });
    expect(context).toContain("1234 kcal sur 1800 (reste 566)");
    expect(context).toContain("protéines 60/100");
    expect(context).toContain("Ressenti : énergie 2/5.");
    expect(context).not.toContain("Poids");
    expect(context).not.toContain("Semaine");
    expect(context.split("\n").length).toBeLessThanOrEqual(6);
  });
});

describe("statistiques de la semaine", () => {
  const day = (date: string, proteinG: number, energy: number | null, logged = true) => ({
    date,
    kcal: logged ? 1800 : 0,
    proteinG,
    logged,
    energy,
  });

  it("compare l'énergie des jours pauvres en protéines aux autres", () => {
    const stats = weekStats(
      [
        day("2026-10-19", 50, 2),
        day("2026-10-20", 60, 3),
        day("2026-10-21", 110, 4),
        day("2026-10-22", 100, 5),
        day("2026-10-23", 0, null, false),
      ],
      100,
    );
    expect(stats).toEqual({
      daysLogged: 4,
      averageKcal: 1800,
      averageProteinG: 80,
      energyLowProtein: 2.5,
      energyOtherDays: 4.5,
    });
  });

  it("n'affiche pas de lien sur une seule journée", () => {
    const stats = weekStats([day("2026-10-19", 50, 2), day("2026-10-20", 110, 4)], 100);
    expect(stats.energyLowProtein).toBeNull();
    expect(stats.energyOtherDays).toBeNull();
  });
});

describe("plat suggéré", () => {
  const dishes = [
    { id: "a", name: "Dahl", portionKcal: 450, slots: [] },
    { id: "b", name: "Salade", portionKcal: 250, slots: ["lunch"] },
    { id: "c", name: "Cabillaud quinoa", portionKcal: 790, slots: [] },
    { id: "d", name: "Pomme", portionKcal: 80, slots: ["snack"] },
    { id: "e", name: "Porridge", portionKcal: 380, slots: ["breakfast"] },
  ] as const satisfies readonly DishCandidate[];
  const day = { goalKcal: 2000, remainingKcal: 2000 };

  it("ne propose au petit-déjeuner que ce qui y a déjà été noté", () => {
    expect(suggestDish(dishes, { ...day, slot: "breakfast" }, "x")?.id).toBe("e");
    expect(suggestDish(dishes.slice(0, 4), { ...day, slot: "breakfast" }, "x")).toBeNull();
    expect(suggestDish(dishes, { ...day, slot: "snack" }, "x")?.id).toBe("d");
  });

  it("garde un plat à la mesure du repas et du reste du jour", () => {
    expect(suggestDish(dishes, { ...day, slot: "dinner" }, "x")?.id).toBe("a");
    expect(suggestDish(dishes, { ...day, slot: "lunch" }, "x")?.id).toMatch(/^[ac]$/);
    expect(suggestDish(dishes, { goalKcal: 2000, remainingKcal: 300, slot: "lunch" }, "x")?.id).toBe("b");
    expect(suggestDish(dishes, { goalKcal: 2000, remainingKcal: 60, slot: "dinner" }, "x")).toBeNull();
  });

  it("est stable pour une même graine et ne dépend pas de l'ordre", () => {
    const first = suggestDish(dishes, { ...day, slot: "lunch" }, "u:2026-10-29");
    expect(suggestDish([...dishes].reverse(), { ...day, slot: "lunch" }, "u:2026-10-29")).toEqual(first);
  });
});
