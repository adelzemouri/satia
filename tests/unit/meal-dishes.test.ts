import { describe, expect, it } from "vitest";

import { mealHistoryLines, type HistoryEntry } from "@/domain/coach";
import { realisticGrams } from "@/domain/condiments";
import { dishAfterSwap, groupByDish } from "@/domain/dishes";
import { addDays } from "@/domain/energy";

describe("plats et quantités de la saisie IA", () => {
  it("regroupe les aliments par plat, dans l'ordre d'apparition", () => {
    const groups = groupByDish([
      { name: "pâtes", dish: "Pâtes au saumon" },
      { name: "laitue", dish: "Salade verte" },
      { name: "saumon", dish: "pâtes au saumon" },
      { name: "pomme", dish: null },
      { name: "café" },
    ]);
    expect(groups.map((group) => [group.dish, group.items.map((item) => item.name)])).toEqual([
      ["Pâtes au saumon", ["pâtes", "saumon"]],
      ["Salade verte", ["laitue"]],
      [null, ["pomme"]],
      [null, ["café"]],
    ]);
  });

  it("ramène un assaisonnement démesuré à une portion habituelle", () => {
    expect(realisticGrams("vinaigre balsamique", 100)).toBe(10);
    expect(realisticGrams("Huile d'olive", 100)).toBe(10);
    expect(realisticGrams("vinaigrette", 25)).toBe(25);
    expect(realisticGrams("saumon cuit", 100)).toBe(100);
    expect(realisticGrams("poudre de protéines de lactosérum chocolatée", 899)).toBe(30);
    expect(realisticGrams("whey", 60)).toBe(60);
  });
});

describe("historique des repas pour le coach", () => {
  const today = "2026-10-05";
  const entry = (date: string, slot: HistoryEntry["slot"], label: string, dish: string | null, grams = 100) => ({
    date,
    slot,
    label,
    dish,
    grams,
    kcal: grams * 2,
    proteinG: grams / 10,
  });

  it("détaille aujourd'hui, résume les jours précédents et repère les habitudes", () => {
    const lines = mealHistoryLines(
      [
        entry("2026-10-03", "lunch", "Pâtes alimentaires, cuites", "Pâtes au saumon", 180),
        entry("2026-10-03", "lunch", "Saumon, cuit", "Pâtes au saumon", 100),
        entry("2026-10-04", "dinner", "Pâtes alimentaires, cuites", "Pâtes au saumon", 180),
        entry("2026-10-04", "dinner", "Saumon, cuit", "Pâtes au saumon", 100),
        entry(today, "breakfast", "Yaourt nature", null, 125),
        entry(today, "lunch", "Laitue, crue", "Salade verte", 80),
      ],
      today,
      (days) => addDays(today, -days),
    );
    expect(lines[0]).toBe(
      "Repas d'aujourd'hui : petit-déjeuner : yaourt nature 125 g ; déjeuner : Salade verte (laitue 80 g).",
    );
    expect(lines[1]).toBe("Hier : dîner : Pâtes au saumon (pâtes alimentaires, saumon).");
    expect(lines[2]).toBe("Avant-hier : déjeuner : Pâtes au saumon (pâtes alimentaires, saumon).");
    expect(lines[3]).toBe(
      "7 derniers jours : 10-04 560 kcal et 28 g de protéines ; 10-03 560 kcal et 28 g de protéines.",
    );
    expect(lines[4]).toBe("Le plus souvent : Pâtes au saumon ×2.");
  });

  it("dit simplement quand rien n'est saisi", () => {
    expect(mealHistoryLines([], today, (days) => addDays(today, -days))).toEqual(["Rien de saisi aujourd'hui."]);
  });
});

describe("nom du plat après une correction", () => {
  it("remplace l'aliment nommé dans le plat", () => {
    expect(dishAfterSwap("Riz sauté au porc", ["porc sauté", "Porc, rôti, cuit"], "Veau, rôti, cuit")).toBe(
      "Riz sauté au veau",
    );
    expect(dishAfterSwap("Pâtes au saumon", ["saumon"], "Thon, au naturel, appertisé")).toBe("Pâtes au thon");
    expect(dishAfterSwap("Tajine d'agneau", ["agneau"], "Abricot sec")).toBe("Tajine d'abricot sec");
  });

  it("garde le nom quand l'aliment remplacé n'y figure pas", () => {
    expect(dishAfterSwap("Riz sauté au porc", ["oeuf au plat"], "Oeuf, dur")).toBe("Riz sauté au porc");
    expect(dishAfterSwap("Riz sauté au porc", ["porc"], "Porc, échine, rôtie")).toBe("Riz sauté au porc");
    expect(dishAfterSwap("Tajine d'agneau", ["agneau"], "Veau, rôti, cuit")).toBe("Tajine d'agneau");
    expect(dishAfterSwap("Salade", ["laitue"], "Mâche, crue")).toBe("Salade");
    // Une variante du même aliment ne change pas le plat.
    expect(dishAfterSwap("Riz sauté au porc", ["riz blanc cuit"], "Riz basmati, cuit")).toBe("Riz sauté au porc");
  });

  it("ne dépasse pas la longueur d'un nom de plat", () => {
    const long = "Pommes de terre sautées et lardons à la crème du terroir";
    expect(dishAfterSwap(long, ["lardons"], "Jambon cru de pays affiné longuement, tranche")).toBe(long);
  });
});
