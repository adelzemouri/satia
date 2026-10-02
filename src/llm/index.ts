import "server-only";

import type { z } from "zod";

import type { LlmFeature } from "@/db/schema";

import { llmConfig, type ModelKind } from "./config";
import { assertAiAvailable } from "./guard";
import { toJsonSchema } from "./json";
import { costUsdMicros } from "./pricing";
import { CONNECTION_TEST_PROMPT } from "./prompts/connection-test";
import { providerFor } from "./providers";
import { connectionTestSchema } from "./schemas";
import { AiUnavailableError, type LlmImage, LlmProviderError, type LlmUsage } from "./types";
import { recordCall } from "./usage";

export { AiUnavailableError } from "./types";

type CallOptions<T extends z.ZodType> = {
  userId: string;
  feature: LlmFeature;
  kind: ModelKind;
  system: string;
  user: string;
  images?: LlmImage[];
  /** Nom de la sortie (sert aussi à choisir la réponse du fournisseur simulé). */
  schemaName: string;
  schema: T;
  maxOutputTokens: number;
};

export type CallResult<T> = { data: T; usage: LlmUsage; costUsdMicros: number; latencyMs: number; model: string };

/**
 * Point d'entrée unique vers le LLM : garde (configuration, interrupteur admin, plafond
 * mensuel, débit), appel, validation Zod avec une seule nouvelle tentative, puis
 * journalisation de chaque tentative dans `llm_calls`, réussie ou non.
 */
export async function callLlm<T extends z.ZodType>(options: CallOptions<T>): Promise<CallResult<z.infer<T>>> {
  const config = llmConfig();
  await assertAiAvailable(options.userId, config);
  const provider = providerFor(config);
  if (!provider) throw new AiUnavailableError("not_configured");

  const model = config.models[options.kind];
  const price = config.prices[options.kind];
  const request = {
    model,
    system: options.system,
    user: options.user,
    images: options.images,
    schemaName: options.schemaName,
    jsonSchema: toJsonSchema(options.schema),
    maxOutputTokens: options.maxOutputTokens,
    lowDetail: true,
  };
  const log = (usage: LlmUsage, latencyMs: number, status: "ok" | "invalid_output" | "error" | "timeout") =>
    recordCall({
      userId: options.userId,
      feature: options.feature,
      provider: provider.name,
      model,
      tokensIn: usage.inputTokens,
      tokensOut: usage.outputTokens,
      costUsdMicros: costUsdMicros(usage, price),
      latencyMs,
      status,
    });

  for (let attempt = 0; attempt < 2; attempt++) {
    const started = performance.now();
    try {
      const response = await provider.complete(request);
      const latencyMs = Math.round(performance.now() - started);
      const parsed = options.schema.safeParse(response.json);
      await log(response.usage, latencyMs, parsed.success ? "ok" : "invalid_output");
      if (parsed.success) {
        return {
          data: parsed.data,
          usage: response.usage,
          costUsdMicros: costUsdMicros(response.usage, price),
          latencyMs,
          model,
        };
      }
    } catch (error) {
      if (!(error instanceof LlmProviderError)) throw error;
      const latencyMs = Math.round(performance.now() - started);
      const status = error.kind === "timeout" ? "timeout" : error.kind === "invalid_json" ? "invalid_output" : "error";
      await log(error.usage, latencyMs, status);
      // Seule une sortie illisible justifie une nouvelle tentative ; une panne, non.
      if (error.kind !== "invalid_json") break;
    }
  }
  throw new AiUnavailableError("provider_error");
}

/** Vérifie la clé et les deux modèles avec un appel minimal (page admin). */
export async function testConnection(userId: string) {
  const call = (kind: ModelKind) =>
    callLlm({
      userId,
      feature: "connection_test",
      kind,
      ...CONNECTION_TEST_PROMPT,
      schemaName: "connection_test",
      schema: connectionTestSchema,
      // Marge pour les modèles qui réfléchissent avant de répondre (réflexion comptée en sortie).
      maxOutputTokens: 1024,
    });
  const text = await call("text");
  const config = llmConfig();
  const vision = config.models.vision === config.models.text ? text : await call("vision");
  return { text, vision };
}
