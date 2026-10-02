import type { LlmConfig } from "../config";
import type { LlmProvider } from "../types";

import { anthropicProvider } from "./anthropic";
import { mockProvider } from "./mock";
import { openAiCompatibleProvider } from "./openai-compatible";

let override: LlmProvider | null = null;

/** Remplace le fournisseur dans les tests (réponse invalide, panne…) ; `null` rétablit la config. */
export function setProviderForTests(provider: LlmProvider | null): void {
  override = provider;
}

export function providerFor(config: LlmConfig): LlmProvider | null {
  if (override) return override;
  switch (config.provider) {
    case "openai":
      return openAiCompatibleProvider(config);
    case "anthropic":
      return anthropicProvider(config);
    case "mock":
      return mockProvider();
    case "none":
      return null;
  }
}
