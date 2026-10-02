import type { LlmUsage } from "./types";

/**
 * Coût estimé en millionièmes de dollar. Un tarif de 1 $ par million de tokens vaut
 * exactement 1 millionième de dollar par token, d'où le simple produit.
 */
export function costUsdMicros(usage: LlmUsage, price: { input: number; output: number }): number {
  return Math.round(usage.inputTokens * price.input + usage.outputTokens * price.output);
}

export function microsToUsd(micros: number): number {
  return micros / 1_000_000;
}
