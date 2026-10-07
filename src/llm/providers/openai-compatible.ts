import { z } from "zod";

import { parseJsonText } from "../json";
import { type LlmProvider, LlmProviderError, type LlmRequest, type LlmResponse } from "../types";

import { postJson } from "./http";

const imageResponseSchema = z.object({ data: z.array(z.object({ b64_json: z.string().min(1) })).min(1) });

const geminiImageSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(z.object({ inlineData: z.object({ data: z.string().min(1) }).optional() }).loose()),
        }),
      }),
    )
    .min(1),
});

/**
 * Adresse de l'API native de Gemini quand le fournisseur est Gemini (point d'accès
 * `…/v1beta/openai`) et le modèle un modèle d'images Gemini ; sinon null.
 */
export function geminiNativeBase(baseUrl: string, model: string): string | null {
  if (!/^gemini-.*image/.test(model)) return null;
  const match = /^(https:\/\/generativelanguage\.googleapis\.com\/v1\w*)\/openai$/.exec(baseUrl);
  return match ? match[1]! : null;
}

/** Vrai quand le fournisseur est le point d'accès compatible OpenAI de Gemini. */
export function isGeminiOpenAi(baseUrl: string): boolean {
  return /^https:\/\/generativelanguage\.googleapis\.com\/v1\w*\/openai$/.test(baseUrl);
}

/**
 * Réglage de réflexion envoyé avec la requête. Gemini reçoit directement son `thinking_level`
 * (Google déconseille `thinking_budget`, que `reasoning_effort` peut produire) ; « none »
 * devient « minimal », le plus bas niveau des modèles Gemini 3. Les autres fournisseurs
 * gardent `reasoning_effort`.
 */
export function reasoningFields(baseUrl: string, effort: string | undefined): Record<string, unknown> {
  if (!effort) return {};
  if (!isGeminiOpenAi(baseUrl)) return { reasoning_effort: effort };
  const level = effort === "none" ? "minimal" : effort;
  return { extra_body: { google: { thinking_config: { thinking_level: level } } } };
}

/** Une image se génère en quelques secondes, parfois plus : délai plus large que le texte. */
const IMAGE_TIMEOUT_MS = 60_000;

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
          ...reasoningFields(options.baseUrl, options.reasoningEffort),
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
    /**
     * Images : les modèles d'images de Gemini (Nano Banana) passent par l'API native
     * `generateContent` de Google, les autres par « images/generations » (DALL·E, gpt-image…).
     */
    async generateImage(request) {
      const native = geminiNativeBase(options.baseUrl, request.model);
      if (native) {
        const body = await postJson(
          `${native}/models/${encodeURIComponent(request.model)}:generateContent`,
          { "x-goog-api-key": options.apiKey },
          {
            contents: [{ parts: [{ text: request.prompt }] }],
            generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "4:3" } },
          },
          IMAGE_TIMEOUT_MS,
        );
        const parsed = geminiImageSchema.safeParse(body);
        const data = parsed.success
          ? parsed.data.candidates.flatMap((candidate) => candidate.content.parts).find((part) => part.inlineData)
              ?.inlineData?.data
          : undefined;
        if (!data) throw new LlmProviderError("unexpected image response", "invalid_json");
        return { base64: data };
      }
      const body = await postJson(
        `${options.baseUrl}/images/generations`,
        { Authorization: `Bearer ${options.apiKey}` },
        { model: request.model, prompt: request.prompt, n: 1, response_format: "b64_json" },
        IMAGE_TIMEOUT_MS,
      );
      const parsed = imageResponseSchema.safeParse(body);
      if (!parsed.success) throw new LlmProviderError("unexpected image response", "invalid_json");
      return { base64: parsed.data.data[0]!.b64_json };
    },
  };
}
