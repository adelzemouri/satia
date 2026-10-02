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
