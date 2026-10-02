import { describe, expect, it } from "vitest";

import { correctionRules, isCorrection, parseSegment, resolveLocally, splitMealText } from "@/domain/meal-text";
import { mealUserPrompt } from "@/llm/prompts/meal";
import { mockProvider } from "@/llm/providers/mock";
import { foodEstimatesSchema } from "@/llm/schemas";

const TARTINE = "11111111-1111-4111-8111-111111111111";
const CAFE = "22222222-2222-4222-8222-222222222222";
const RIZ = "33333333-3333-4333-8333-333333333333";
const PATES = "44444444-4444-4444-8444-444444444444";

describe("texte libre", () => {
  it("découpe sur les virgules, « et », « puis » et les retours à la ligne", () => {
    expect(splitMealText("2 œufs brouillés et une tartine beurrée, un café\npuis une pomme")).toEqual([
      "2 œufs brouillés",
      "une tartine beurrée",
      "un café",
      "une pomme",
    ]);
    expect(splitMealText("riz + poulet ; salade")).toEqual(["riz", "poulet", "salade"]);
  });

  it("lit le nombre ou le poids placé devant l'aliment", () => {
    expect(parseSegment("2 tartines")).toEqual({ count: 2, grams: null, rest: "tartines" });
    expect(parseSegment("une pomme")).toEqual({ count: 1, grams: null, rest: "pomme" });
    expect(parseSegment("150 g de riz")).toEqual({ count: null, grams: 150, rest: "riz" });
    expect(parseSegment("1,5 kg de pommes de terre")).toEqual({ count: null, grams: 1500, rest: "pommes de terre" });
    expect(parseSegment("200g d'épinards")).toEqual({ count: null, grams: 200, rest: "epinards" });
    expect(parseSegment("ma tartine")).toEqual({ count: null, grams: null, rest: "ma tartine" });
    expect(parseSegment("Riz")).toEqual({ count: null, grams: null, rest: "riz" });
  });
});

describe("dictionnaire personnel et habitudes", () => {
  const expressions = [
    { phraseNormalized: "ma tartine", foodId: TARTINE, quantity: 1, unit: "slice" as const },
    { phraseNormalized: "mon cafe du matin", foodId: CAFE, quantity: 200, unit: "ml" as const },
  ];
  const rules = new Map([["riz", { foodId: RIZ, grams: 200 }]]);

  it("reconnaît tout le texte sans IA quand chaque morceau est connu", () => {
    expect(resolveLocally("Ma tartine et mon café du matin", expressions, rules)).toEqual([
      { foodId: TARTINE, quantity: 1, unit: "slice", label: "ma tartine", ruleLabel: null },
      { foodId: CAFE, quantity: 200, unit: "ml", label: "mon café du matin", ruleLabel: null },
    ]);
  });

  it("multiplie une expression ou une habitude par le nombre dit, ou prend le poids dit", () => {
    expect(resolveLocally("2 ma tartine, riz", expressions, rules)).toEqual([
      { foodId: TARTINE, quantity: 2, unit: "slice", label: "2 ma tartine", ruleLabel: null },
      { foodId: RIZ, quantity: 200, unit: "g", label: "riz", ruleLabel: "riz" },
    ]);
    expect(resolveLocally("150 g de riz", expressions, rules)).toEqual([
      { foodId: RIZ, quantity: 150, unit: "g", label: "150 g de riz", ruleLabel: "riz" },
    ]);
  });

  it("laisse la main à l'IA dès qu'un morceau est inconnu", () => {
    expect(resolveLocally("ma tartine et une banane", expressions, rules)).toBeNull();
    expect(resolveLocally("   ", expressions, rules)).toBeNull();
  });

  it("transforme les corrections répétées en règles, au poids médian", () => {
    const corrections = [
      { aiLabel: "riz", foodId: RIZ, grams: 180 },
      { aiLabel: "riz", foodId: RIZ, grams: 220 },
      { aiLabel: "riz", foodId: RIZ, grams: 200 },
      { aiLabel: "riz", foodId: PATES, grams: 150 },
      // Une seule fois : pas encore une habitude.
      { aiLabel: "pates", foodId: PATES, grams: 250 },
    ];
    expect([...correctionRules(corrections)]).toEqual([["riz", { foodId: RIZ, grams: 200 }]]);
  });

  it("ne compte pas un petit ajustement de poids comme une correction", () => {
    expect(isCorrection({ foodId: RIZ, grams: 200 }, { foodId: RIZ, grams: 210 })).toBe(false);
    expect(isCorrection({ foodId: RIZ, grams: 200 }, { foodId: RIZ, grams: 260 })).toBe(true);
    expect(isCorrection({ foodId: RIZ, grams: 30 }, { foodId: RIZ, grams: 34 })).toBe(false);
    expect(isCorrection({ foodId: null, grams: 200 }, { foodId: RIZ, grams: 200 })).toBe(true);
    expect(isCorrection({ foodId: RIZ, grams: 200 }, { foodId: PATES, grams: 200 })).toBe(true);
  });
});

describe("prompts de saisie", () => {
  it("ajoute la précision, le contenant et les habitudes en lignes courtes", () => {
    expect(
      mealUserPrompt("Analyse cette photo.", {
        note: "sauce à part",
        containers: ["grand bol (bol, 500 ml)"],
        habits: ["riz → Riz blanc, cuit, 200 g"],
      }),
    ).toBe(
      "Analyse cette photo.\nPrécision : sauce à part\nContenants : grand bol (bol, 500 ml)\nHabitudes : riz → Riz blanc, cuit, 200 g",
    );
    expect(mealUserPrompt("Analyse cette photo.", { containers: [], habits: [] })).toBe("Analyse cette photo.");
  });

  it("le fournisseur simulé estime un aliment par ligne, dans un format valide", async () => {
    const response = await mockProvider().complete({
      model: "mock-text",
      system: "s",
      user: "plat inconnu\nautre plat",
      schemaName: "food_estimates",
      jsonSchema: {},
      maxOutputTokens: 100,
    });
    const parsed = foodEstimatesSchema.parse(response.json);
    expect(parsed.items.map((item) => item.name)).toEqual(["plat inconnu", "autre plat"]);
  });
});
