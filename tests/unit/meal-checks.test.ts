import { describe, expect, it } from "vitest";

import { checkLine, looksUnrelated } from "@/domain/meal-checks";

const line = (label: string, food: { nameFr: string; kcal: number } | null, grams = 200, kcal = 300) =>
  checkLine({ label, food, chosen: false, grams, kcal });

describe("contrôle des aliments proposés par l'IA", () => {
  it("laisse passer une correspondance plausible", () => {
    expect(line("poulet rôti", { nameFr: "Poulet, rôti", kcal: 190 })).toEqual([]);
    expect(line("riz basmati cuit", { nameFr: "Riz basmati, cuit", kcal: 130 })).toEqual([]);
    expect(line("crème liquide", { nameFr: "Crème fluide 30% MG", kcal: 300 }, 20, 60)).toEqual([]);
    expect(line("linguine", { nameFr: "Pâtes sèches, cuites", kcal: 150 }, 250, 375)).toEqual([]);
  });

  it("signale un aliment sans rapport avec ce qui a été reconnu", () => {
    expect(looksUnrelated("sauce au saumon", "Crème brûlée")).toBe(true);
    expect(line("saumon", { nameFr: "Julienne ou Lingue, cuite", kcal: 100 })).toEqual(["unrelated"]);
  });

  it("signale des pâtes ou du riz comptés secs", () => {
    expect(line("pâtes", { nameFr: "Pâtes sèches, crues", kcal: 351 }, 280, 983)).toEqual(["dry", "heavy"]);
    expect(line("riz cru", { nameFr: "Riz blanc, cru", kcal: 350 }, 80, 280)).toEqual([]);
  });

  it("signale une quantité démesurée", () => {
    expect(line("whey", { nameFr: "Whey protéine, poudre", kcal: 380 }, 899, 3400)).toEqual(["heavy"]);
  });

  it("fait confiance à un aliment choisi par l'utilisateur", () => {
    const input = { label: "saumon", food: { nameFr: "Julienne ou Lingue, cuite", kcal: 100 }, grams: 100, kcal: 100 };
    expect(checkLine({ ...input, chosen: true })).toEqual([]);
  });

  it("ne soupçonne pas une estimation de l'IA sur le nom", () => {
    expect(line("gâteau de mamie", null)).toEqual([]);
  });
});
