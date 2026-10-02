/** Interface commune à tous les fournisseurs de LLM (voir docs/ARCHITECTURE.md §4). */

export type LlmImage = { mime: "image/webp" | "image/jpeg"; base64: string };

export type LlmRequest = {
  /** `LLM_MODEL_VISION` ou `LLM_MODEL_TEXT`. */
  model: string;
  /** Prompt système court, mis en cache par le fournisseur quand il le permet. */
  system: string;
  user: string;
  images?: LlmImage[];
  /** Nom et schéma JSON de la sortie attendue (dérivé du schéma Zod). */
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  maxOutputTokens: number;
  /** Images en basse résolution (`detail: "low"`) quand le fournisseur le propose. */
  lowDetail?: boolean;
};

export type LlmUsage = { inputTokens: number; outputTokens: number };

export type LlmResponse = { json: unknown; usage: LlmUsage };

export interface LlmProvider {
  readonly name: string;
  complete(request: LlmRequest): Promise<LlmResponse>;
}

/** Échec côté fournisseur : délai dépassé, erreur HTTP ou réponse illisible. */
export class LlmProviderError extends Error {
  constructor(
    message: string,
    public readonly kind: "timeout" | "http" | "invalid_json",
    public readonly usage: LlmUsage = { inputTokens: 0, outputTokens: 0 },
  ) {
    super(message);
  }
}

/** Raisons pour lesquelles l'IA est indisponible ; l'interface propose alors la saisie manuelle. */
export type AiUnavailableReason = "not_configured" | "disabled" | "budget_reached" | "provider_error";

export class AiUnavailableError extends Error {
  constructor(public readonly reason: AiUnavailableReason) {
    super(`ai_${reason}`);
  }
}
