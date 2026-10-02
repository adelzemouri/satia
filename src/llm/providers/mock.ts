import type { LlmProvider, LlmRequest, LlmResponse } from "../types";

/** Réponses fixes par schéma de sortie : les tests n'appellent jamais un vrai LLM. */
const RESPONSES: Record<string, unknown> = {
  connection_test: { ok: true },
  meal_items: {
    items: [
      { name: "riz basmati cuit", grams: 180, confidence: 0.8 },
      { name: "poulet rôti", grams: 120, confidence: 0.7 },
    ],
  },
};

/**
 * Fournisseur déterministe : même requête, même réponse et même consommation de tokens
 * (environ 4 caractères par token, 85 tokens par image en basse résolution).
 */
export function mockProvider(): LlmProvider {
  return {
    name: "mock",
    async complete(request: LlmRequest): Promise<LlmResponse> {
      const json = RESPONSES[request.schemaName] ?? {};
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
