import type { LlmProvider, LlmRequest, LlmResponse } from "../types";

/** Réponses fixes par schéma de sortie : les tests n'appellent jamais un vrai LLM. */
const RESPONSES: Record<string, unknown | ((request: LlmRequest) => unknown)> = {
  connection_test: { ok: true },
  meal_items: {
    items: [
      { name: "riz basmati cuit", grams: 180, confidence: 0.8 },
      { name: "poulet rôti", grams: 120, confidence: 0.7 },
    ],
  },
  // Réponse fixe qui cite la dernière ligne (le message de l'utilisateur), pour les tests.
  coach_reply: (request: LlmRequest) => ({
    reply: `Bonne idée ! Tu me demandais : « ${
      request.user
        .split("\n")
        .at(-1)
        ?.replace(/^Moi : /, "") ?? ""
    } ». Un bol de lentilles et des crudités tiennent bien dans ton budget.`,
  }),
  weekly_review: {
    summary: "Belle régularité cette semaine : tes repas sont bien saisis.",
    highlights: ["Des petits-déjeuners réguliers", "Une bonne hydratation"],
    ideas: ["Ajoute une portion de légumes au déjeuner"],
  },
  // Un nouveau plat le premier jour au dîner, la première recette de la liste le lendemain midi.
  menu_plan: {
    meals: [
      {
        day: 0,
        slot: "dinner",
        recipe: null,
        name: "Poêlée de lentilles aux carottes",
        ingredients: [
          { name: "lentille cuite", grams: 200 },
          { name: "carotte crue", grams: 120 },
          { name: "huile d'olive", grams: 10 },
        ],
      },
      { day: 1, slot: "lunch", recipe: 1, name: "", ingredients: [] },
    ],
  },
  recipe_steps: {
    steps: ["Prépare et coupe les ingrédients.", "Fais cuire doucement 10 minutes.", "Assaisonne et sers chaud."],
  },
  fridge: {
    ingredients: ["œuf", "tomate", "fromage râpé", "pain"],
    ideas: [
      {
        name: "Omelette à la tomate",
        ingredients: [
          { name: "œuf entier cru", grams: 120 },
          { name: "tomate crue", grams: 100 },
          { name: "huile d'olive", grams: 5 },
        ],
      },
      {
        name: "Tartines gratinées",
        ingredients: [
          { name: "pain baguette", grams: 80 },
          { name: "tomate crue", grams: 80 },
          { name: "emmental râpé", grams: 30 },
        ],
      },
      {
        name: "Salade de tomates et œuf dur",
        ingredients: [
          { name: "tomate crue", grams: 200 },
          { name: "œuf dur", grams: 60 },
        ],
      },
    ],
  },
  // Une ligne « S<n> … » par séance : titre fixe et exercices principaux dans l'ordre inverse.
  training_plan: (request: LlmRequest) => ({
    intro: "Une semaine progressive : on construit la régularité avant l'intensité.",
    sessions: request.user
      .split("\n")
      .filter((line) => /^S\d+/.test(line))
      .map((line) => {
        const count = (line.match(/\d+\. /g) ?? []).length;
        return {
          index: Number(line.match(/^S(\d+)/)![1]),
          title: `Séance ${line.match(/^S(\d+)/)![1]} en douceur`,
          tip: "Souffle à l'effort et garde le dos bien aligné.",
          order: Array.from({ length: count }, (_, i) => count - i),
        };
      }),
  }),
  // Un aliment par ligne du message : mêmes valeurs moyennes pour chacun.
  food_estimates: (request: LlmRequest) => ({
    items: request.user
      .split("\n")
      .filter(Boolean)
      .map((name) => ({ name, kcal: 150, proteinG: 5, carbsG: 20, fatG: 5 })),
  }),
};

/**
 * Fournisseur déterministe : même requête, même réponse et même consommation de tokens
 * (environ 4 caractères par token, 85 tokens par image en basse résolution).
 */
export function mockProvider(): LlmProvider {
  return {
    name: "mock",
    /** Plus petit JPEG accepté : les tests vérifient le circuit, pas l'image. */
    async generateImage() {
      return { base64: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]).toString("base64") };
    },
    async complete(request: LlmRequest): Promise<LlmResponse> {
      const response = RESPONSES[request.schemaName] ?? {};
      const json = typeof response === "function" ? (response as (request: LlmRequest) => unknown)(request) : response;
      return {
        json,
        usage: {
          inputTokens:
            Math.ceil((request.system.length + request.user.length) / 4) + 85 * (request.images?.length ?? 0),
          outputTokens: Math.ceil(JSON.stringify(json).length / 4),
        },
      };
    },
  };
}
