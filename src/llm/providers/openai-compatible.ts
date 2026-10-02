import { z } from "zod";

import { parseJsonText } from "../json";
import { type LlmProvider, LlmProviderError, type LlmRequest, type LlmResponse } from "../types";

import { postJson } from "./http";

const responseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }).partial().optional(),
});

/**
 * API « chat completions » d'OpenAI, reprise par OpenRouter, Gemini, Mistral, DeepSeek,
 * Ollama, etc. Sortie en JSON imposée par `response_format`.
 */
export function openAiCompatibleProvider(options: {
  baseUrl: string;
  apiKey: string;
  jsonMode: "json_schema" | "json_object";
  reasoningEffort?: string | undefined;
}): LlmProvider {
  return {
    name: "openai",
    async complete(request: LlmRequest): Promise<LlmResponse> {
      const content = request.images?.length
        ? [
            { type: "text", text: request.user },
            ...request.images.map((image) => ({
              type: "image_url",
              image_url: {
                url: `data:${image.mime};base64,${image.base64}`,
                ...(request.lowDetail && { detail: "low" }),
              },
            })),
          ]
        : request.user;
      const body = await postJson(
        `${options.baseUrl}/chat/completions`,
        { Authorization: `Bearer ${options.apiKey}` },
        {
          model: request.model,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content },
          ],
          max_tokens: request.maxOutputTokens,
          ...(options.reasoningEffort && { reasoning_effort: options.reasoningEffort }),
          response_format:
            options.jsonMode === "json_schema"
              ? { type: "json_schema", json_schema: { name: request.schemaName, schema: request.jsonSchema } }
              : { type: "json_object" },
        },
      );
      const parsed = responseSchema.safeParse(body);
      if (!parsed.success) throw new LlmProviderError("unexpected response", "invalid_json");
      const usage = {
        inputTokens: parsed.data.usage?.prompt_tokens ?? 0,
        outputTokens: parsed.data.usage?.completion_tokens ?? 0,
      };
      try {
        return { json: parseJsonText(parsed.data.choices[0]!.message.content ?? ""), usage };
      } catch {
        throw new LlmProviderError("invalid JSON", "invalid_json", usage);
      }
    },
  };
}
