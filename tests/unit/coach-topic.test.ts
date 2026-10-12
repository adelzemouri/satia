import { describe, expect, it } from "vitest";

import { coachTopicSchema, dayTopicLine, foodTopicLine, mealTopicLine } from "@/domain/coach-topic";

const entries = [
  { slot: "lunch", label: "Poulet rôti", grams: 150, kcal: 300, proteinG: 40 },
  { slot: "lunch", label: "Riz\nbasmati", grams: 180.4, kcal: 230, proteinG: 5 },
  { slot: "breakfast", label: "Porridge", grams: 250, kcal: 320, proteinG: 11 },
] as const;

describe("sujet d'une question au coach", () => {
  it("décrit un aliment ou une recette, avec la portion", () => {
    expect(
      foodTopicLine({
        name: "Curry de lentilles",
        recipe: true,
        kcal: 120,
        proteinG: 6.4,
        carbsG: 15,
        fatG: 3,
        portionG: 350,
      }),
    ).toBe(
      "Sujet de la question : la recette « Curry de lentilles » (120 kcal, protéines 6 g, glucides 15 g, lipides 3 g pour 100 g, portion 350 g (420 kcal)).",
    );
    expect(
      foodTopicLine({ name: "Pomme", recipe: false, kcal: 52, proteinG: 0.3, carbsG: 11, fatG: 0.2, portionG: null }),
    ).toContain("l'aliment « Pomme »");
  });

  it("décrit un repas du journal sur une seule ligne", () => {
    expect(mealTopicLine("2026-10-12", "lunch", entries)).toBe(
      "Sujet de la question : son déjeuner du 2026-10-12 : Poulet rôti 150 g, Riz basmati 180 g (530 kcal, 45 g de protéines).",
    );
    expect(mealTopicLine("2026-10-12", "dinner", entries)).toBe(
      "Sujet de la question : son dîner du 2026-10-12, rien de saisi.",
    );
  });

  it("décrit une journée repas par repas, avec l'objectif", () => {
    expect(dayTopicLine("2026-10-12", 2100, entries)).toBe(
      "Sujet de la question : sa journée du 2026-10-12 : petit-déjeuner : Porridge 250 g ; déjeuner : Poulet rôti 150 g, Riz basmati 180 g. Total 850 kcal sur 2100, 56 g de protéines.",
    );
    expect(dayTopicLine("2026-10-12", null, [])).toBe(
      "Sujet de la question : sa journée du 2026-10-12, rien de saisi.",
    );
  });

  it("n'accepte que des identifiants valides", () => {
    expect(coachTopicSchema.safeParse({ kind: "food", id: "pas-un-uuid" }).success).toBe(false);
    expect(coachTopicSchema.safeParse({ kind: "meal", date: "2026-10-12", slot: "brunch" }).success).toBe(false);
    expect(coachTopicSchema.safeParse({ kind: "day", date: "2026-10-12" }).success).toBe(true);
  });
});
