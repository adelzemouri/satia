import { z } from "zod";

import { type LlmProvider, LlmProviderError, type LlmRequest, type LlmResponse } from "../types";

import { postJson } from "./http";

const responseSchema = z.object({
  content: z.array(z.object({ type: z.string(), input: z.unknown().optional() })),
  usage: z.object({
    input_tokens: z.number(),
    output_tokens: z.number(),
    cache_creation_input_tokens: z.number().nullish(),
    cache_read_input_tokens: z.number().nullish(),
  }),
});

/**
 * API Messages d'Anthropic. La sortie JSON passe par un outil imposé dont le schéma
 * d'entrée est celui attendu ; le prompt système est marqué comme réutilisable en cache.
 */
export function anthropicProvider(options: { baseUrl: string; apiKey: string }): LlmProvider {
  return {
    name: "anthropic",
    async complete(request: LlmRequest): Promise<LlmResponse> {
      const body = await postJson(
        `${options.baseUrl}/v1/messages`,
        { "x-api-key": options.apiKey, "anthropic-version": "2023-06-01" },
        {
          model: request.model,
          max_tokens: request.maxOutputTokens,
          system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
          messages: [
            {
              role: "user",
              content: [
                ...(request.images ?? []).map((image) => ({
                  type: "image",
                  source: { type: "base64", media_type: image.mime, data: image.base64 },
                })),
                { type: "text", text: request.user },
              ],
            },
          ],
          tools: [{ name: request.schemaName, input_schema: request.jsonSchema }],
          tool_choice: { type: "tool", name: request.schemaName },
        },
      );
      const parsed = responseSchema.safeParse(body);
      if (!parsed.success) throw new LlmProviderError("unexpected response", "invalid_json");
      const { usage: raw } = parsed.data;
      const usage = {
        inputTokens: raw.input_tokens + (raw.cache_creation_input_tokens ?? 0) + (raw.cache_read_input_tokens ?? 0),
        outputTokens: raw.output_tokens,
      };
      const tool = parsed.data.content.find((block) => block.type === "tool_use");
      if (!tool) throw new LlmProviderError("no tool_use block", "invalid_json", usage);
      return { json: tool.input, usage };
    },
  };
}
