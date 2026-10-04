import { afterEach, describe, expect, it, vi } from "vitest";

import { fitWithin } from "@/domain/image-size";
import { invalidLlmKeys, parseLlmConfig } from "@/llm/config";
import { parseJsonText, toJsonSchema } from "@/llm/json";
import { costUsdMicros } from "@/llm/pricing";
import { anthropicProvider } from "@/llm/providers/anthropic";
import { mockProvider } from "@/llm/providers/mock";
import { openAiCompatibleProvider } from "@/llm/providers/openai-compatible";
import { mealItemsSchema } from "@/llm/schemas";
import { LlmProviderError, type LlmRequest } from "@/llm/types";

const request: LlmRequest = {
  model: "modele-photo",
  system: "Système court.",
  user: "Que vois-tu ?",
  images: [{ mime: "image/webp", base64: "AAAA" }],
  schemaName: "meal_items",
  jsonSchema: { type: "object" },
  maxOutputTokens: 200,
  lowDetail: true,
};

afterEach(() => vi.unstubAllGlobals());

describe("configuration", () => {
  it("désactive l'IA sans clé, et choisit l'API compatible OpenAI avec une clé", () => {
    expect(parseLlmConfig({}).provider).toBe("none");
    const config = parseLlmConfig({ LLM_API_KEY: "k", LLM_MODEL_VISION: "v", LLM_MODEL_TEXT: "t" });
    expect(config).toMatchObject({ provider: "openai", baseUrl: "https://api.openai.com/v1", jsonMode: "json_schema" });
  });

  it("signale les variables manquantes sans jamais renvoyer leur valeur", () => {
    expect(invalidLlmKeys({ LLM_PROVIDER: "anthropic", LLM_API_KEY: "secret" })).toEqual([
      "LLM_MODEL_VISION",
      "LLM_MODEL_TEXT",
    ]);
    expect(parseLlmConfig({ LLM_PROVIDER: "anthropic", LLM_API_KEY: "secret" }).provider).toBe("none");
  });

  it("lit les tarifs et le plafond, et retire la barre finale de l'URL", () => {
    const config = parseLlmConfig({
      LLM_PROVIDER: "openai",
      LLM_BASE_URL: "https://openrouter.ai/api/v1/",
      LLM_API_KEY: "k",
      LLM_MODEL_VISION: "v",
      LLM_MODEL_TEXT: "t",
      LLM_PRICE_VISION_INPUT: "0.1",
      LLM_PRICE_VISION_OUTPUT: "0.4",
      LLM_MONTHLY_BUDGET_USD: "5",
    });
    expect(config.baseUrl).toBe("https://openrouter.ai/api/v1");
    expect(config.prices.vision).toEqual({ input: 0.1, output: 0.4 });
    expect(config.prices.text).toEqual({ input: 0, output: 0 });
    expect(config.defaultMonthlyBudgetUsd).toBe(5);
  });
});

describe("coûts et formats", () => {
  it("calcule le coût en millionièmes de dollar", () => {
    // 1 000 tokens à 0,10 $/M + 100 tokens à 0,40 $/M = 0,00014 $
    expect(costUsdMicros({ inputTokens: 1000, outputTokens: 100 }, { input: 0.1, output: 0.4 })).toBe(140);
  });

  it("n'envoie au fournisseur que la structure du schéma", () => {
    const schema = toJsonSchema(mealItemsSchema);
    expect(JSON.stringify(schema)).not.toMatch(/additionalProperties|maximum|minLength|\$schema/);
    expect(schema).toMatchObject({ type: "object", required: ["items"], properties: { items: { type: "array" } } });
  });

  it("lit un JSON entouré d'un bloc de code", () => {
    expect(parseJsonText('```json\n{"ok": true}\n```')).toEqual({ ok: true });
    expect(parseJsonText(' {"ok": false} ')).toEqual({ ok: false });
  });

  it("réduit les photos à 768 px de côté long sans les agrandir", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 768, height: 576 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 576, height: 768 });
    expect(fitWithin(640, 480)).toEqual({ width: 640, height: 480 });
  });
});

describe("fournisseurs", () => {
  it("API compatible OpenAI : image en basse résolution, schéma JSON, tokens lus", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json({
        choices: [{ message: { content: '{"items":[]}' } }],
        usage: { prompt_tokens: 120, completion_tokens: 8 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = openAiCompatibleProvider({
      baseUrl: "https://llm.test/v1",
      apiKey: "cle",
      jsonMode: "json_schema",
    });
    const response = await provider.complete(request);
    expect(response).toEqual({ json: { items: [] }, usage: { inputTokens: 120, outputTokens: 8 } });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://llm.test/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer cle");
    const body = JSON.parse(String(init.body));
    expect(body.messages[1].content[1].image_url).toEqual({ url: "data:image/webp;base64,AAAA", detail: "low" });
    expect(body.response_format.json_schema.name).toBe("meal_items");
    expect(body.max_tokens).toBe(200);
    expect(body).not.toHaveProperty("reasoning_effort");
  });

  it("API compatible OpenAI : une réponse illisible garde les tokens consommés", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ choices: [{ message: { content: "pas du JSON" } }], usage: { prompt_tokens: 50 } }),
      ),
    );
    const provider = openAiCompatibleProvider({
      baseUrl: "https://llm.test/v1",
      apiKey: "k",
      jsonMode: "json_object",
      reasoningEffort: "low",
    });
    const error = await provider.complete(request).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(LlmProviderError);
    expect(error).toMatchObject({ kind: "invalid_json", usage: { inputTokens: 50, outputTokens: 0 } });
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]![1]!.body));
    expect(body).toMatchObject({ reasoning_effort: "low", response_format: { type: "json_object" } });
  });

  it("API compatible OpenAI : une erreur HTTP devient une erreur fournisseur", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("quota", { status: 429 })),
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const provider = openAiCompatibleProvider({ baseUrl: "https://llm.test/v1", apiKey: "k", jsonMode: "json_schema" });
    await expect(provider.complete(request)).rejects.toMatchObject({ kind: "http" });
  });

  it("Anthropic : outil imposé, prompt système en cache, tokens du cache comptés", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json({
        content: [{ type: "tool_use", input: { items: [] } }],
        usage: { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 20 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = anthropicProvider({ baseUrl: "https://api.anthropic.com", apiKey: "cle" });
    const response = await provider.complete(request);
    expect(response).toEqual({ json: { items: [] }, usage: { inputTokens: 120, outputTokens: 10 } });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const body = JSON.parse(String(init.body));
    expect(body.tool_choice).toEqual({ type: "tool", name: "meal_items" });
    expect(body.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(body.messages[0].content[0].source).toEqual({ type: "base64", media_type: "image/webp", data: "AAAA" });
  });

  it("fournisseur simulé : déterministe", async () => {
    const first = await mockProvider().complete(request);
    expect(await mockProvider().complete(request)).toEqual(first);
    expect(mealItemsSchema.safeParse(first.json).success).toBe(true);
  });

  it("images : Nano Banana par l'API native de Gemini, sinon images/generations", async () => {
    const fetchMock = vi.fn(async (url: string, _init: RequestInit) =>
      Response.json(
        url.includes(":generateContent")
          ? {
              candidates: [
                { content: { parts: [{ text: "voilà" }, { inlineData: { mimeType: "image/png", data: "UE5H" } }] } },
              ],
            }
          : { data: [{ b64_json: "SlBH" }] },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const gemini = openAiCompatibleProvider({
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: "cle",
      jsonMode: "json_schema",
    });
    expect(await gemini.generateImage!({ model: "gemini-3.1-flash-image", prompt: "Gratin" })).toEqual({
      base64: "UE5H",
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("cle");
    expect(JSON.parse(String(init.body)).generationConfig).toEqual({
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: "4:3" },
    });

    const other = openAiCompatibleProvider({ baseUrl: "https://llm.test/v1", apiKey: "k", jsonMode: "json_schema" });
    expect(await other.generateImage!({ model: "gpt-image-1", prompt: "Gratin" })).toEqual({ base64: "SlBH" });
    expect(fetchMock.mock.calls[1]![0]).toBe("https://llm.test/v1/images/generations");
  });
});
