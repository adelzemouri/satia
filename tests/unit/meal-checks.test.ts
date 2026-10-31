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
    expect(line("oignon vert", { nameFr: "Ciboule ou Ciboulette, fraîche", kcal: 30 }, 15, 4)).toEqual([]);
  });

  it("ne soupçonne pas une précision que le nom de la base sous-entend", () => {
    // « eau » se cherche aussi comme « eau du robinet » : la variante ne doit pas exclure l'eau minérale.
    expect(line("eau", { nameFr: "Eau minérale", kcal: 0 }, 250, 0)).toEqual([]);
    expect(line("verre d'eau", { nameFr: "Eau du robinet", kcal: 0 }, 250, 0)).toEqual([]);
    expect(line("œuf de poule dur", { nameFr: "Oeuf, dur", kcal: 134 }, 165, 221)).toEqual([]);
    expect(line("œufs durs", { nameFr: "Oeuf, dur", kcal: 134 }, 165, 221)).toEqual([]);
    expect(line("bol de riz", { nameFr: "Riz blanc, cuit", kcal: 130 })).toEqual([]);
  });

  it("ne prend pas une pâte à tartiner pour des pâtes sèches", () => {
    // Le cacao de l'IA est le chocolat de la base ; une pâte à tartiner n'est pas un féculent.
    const spread = { nameFr: "Pâte à tartiner chocolat et noisette", kcal: 545 };
    expect(line("pâte à tartiner noisette cacao", spread, 20, 109)).toEqual([]);
    expect(line("pâte feuilletée", { nameFr: "Pâte feuilletée, crue", kcal: 400 }, 50, 200)).toEqual([]);
    expect(line("pâté de campagne", { nameFr: "Pâté de campagne", kcal: 300 }, 40, 120)).toEqual([]);
    expect(line("yogourt nature", { nameFr: "Yaourt, lait entier, nature", kcal: 85 }, 125, 106)).toEqual([]);
    // Les pâtes, elles, restent contrôlées.
    expect(line("pâtes à la carbonara", { nameFr: "Pâtes sèches, crues", kcal: 351 }, 100, 351)).toContain("dry");
  });

  it("signale un aliment sans rapport avec ce qui a été reconnu", () => {
    expect(looksUnrelated("sauce au saumon", "Crème brûlée")).toBe(true);
    expect(line("saumon", { nameFr: "Julienne ou Lingue, cuite", kcal: 100 })).toEqual(["unrelated"]);
    // Un mot en commun ne suffit pas : la tomate manque.
    expect(
      line(
        "coulis de tomate",
        { nameFr: "Coulis de fruits rouges (framboises, fraises, groseilles, cassis)", kcal: 108 },
        60,
        65,
      ),
    ).toEqual(["unrelated"]);
    expect(line("coulis de tomate", { nameFr: "Tomate, coulis, appertisé", kcal: 44 }, 60, 26)).toEqual([]);
    expect(line("œuf entier cru", { nameFr: "Oeuf, cru", kcal: 140 }, 120, 168)).toEqual([]);
    // Les mots courts comptent aussi : de l'eau n'est pas du thé, un œuf dur n'est pas cru.
    expect(line("eau", { nameFr: "Thé infusé, non sucré", kcal: 1 }, 250, 3)).toEqual(["unrelated"]);
    expect(line("riz", { nameFr: "Thon, au naturel", kcal: 110 })).toEqual(["unrelated"]);
    expect(line("œuf de poule dur", { nameFr: "Oeuf, cru", kcal: 140 }, 165, 231)).toEqual(["unrelated"]);
    expect(line("œuf de caille", { nameFr: "Oeuf, dur", kcal: 134 }, 30, 40)).toEqual(["unrelated"]);
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
