import { z } from "zod";

const price = z.coerce.number().min(0).max(1000).default(0);

const schema = z
  .object({
    /** `openai` couvre toute API compatible OpenAI (OpenRouter, Gemini, Mistral, DeepSeek, Ollama…). */
    LLM_PROVIDER: z.enum(["openai", "anthropic", "mock", "none"]).optional(),
    LLM_BASE_URL: z.url().optional(),
    LLM_API_KEY: z.string().min(1).optional(),
    LLM_MODEL_VISION: z.string().min(1).optional(),
    LLM_MODEL_TEXT: z.string().min(1).optional(),
    /** `json_object` pour les fournisseurs qui ne gèrent pas les schémas JSON (DeepSeek…). */
    LLM_JSON_MODE: z.enum(["json_schema", "json_object"]).default("json_schema"),
    /** Effort de réflexion des modèles qui « pensent » avant de répondre (tokens facturés en sortie). */
    LLM_REASONING_EFFORT: z.enum(["none", "minimal", "low", "medium", "high"]).optional(),
    /** Tarifs en dollars par million de tokens, pour estimer le coût de chaque appel. */
    LLM_PRICE_VISION_INPUT: price,
    LLM_PRICE_VISION_OUTPUT: price,
    LLM_PRICE_TEXT_INPUT: price,
    LLM_PRICE_TEXT_OUTPUT: price,
    /** Plafond mensuel par défaut, modifiable ensuite par l'admin. */
    LLM_MONTHLY_BUDGET_USD: z.coerce.number().min(0).max(10_000).default(2),
  })
  .transform((env) => ({
    ...env,
    // Sans fournisseur explicite : compatible OpenAI si une clé est fournie, sinon IA désactivée.
    LLM_PROVIDER: env.LLM_PROVIDER ?? (env.LLM_API_KEY ? "openai" : "none"),
  }))
  .superRefine((env, ctx) => {
    if (env.LLM_PROVIDER !== "openai" && env.LLM_PROVIDER !== "anthropic") return;
    for (const key of ["LLM_API_KEY", "LLM_MODEL_VISION", "LLM_MODEL_TEXT"] as const) {
      if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: "required" });
    }
  });

export type ModelKind = "vision" | "text";

export type LlmConfig = {
  provider: "openai" | "anthropic" | "mock" | "none";
  baseUrl: string;
  apiKey: string;
  jsonMode: "json_schema" | "json_object";
  reasoningEffort: "none" | "minimal" | "low" | "medium" | "high" | undefined;
  models: Record<ModelKind, string>;
  /** Dollars par million de tokens. */
  prices: Record<ModelKind, { input: number; output: number }>;
  defaultMonthlyBudgetUsd: number;
};

const DEFAULT_BASE_URL = { openai: "https://api.openai.com/v1", anthropic: "https://api.anthropic.com" } as const;

/** Noms des variables LLM invalides (jamais leurs valeurs), pour /api/health. */
export function invalidLlmKeys(source: Record<string, string | undefined>): string[] {
  const result = schema.safeParse(source);
  return result.success ? [] : [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
}

/** Configuration lue dans les variables d'environnement ; IA désactivée si elle est invalide. */
export function parseLlmConfig(source: Record<string, string | undefined>): LlmConfig {
  const result = schema.safeParse(source);
  const env = result.success ? result.data : schema.parse({});
  const provider = result.success ? env.LLM_PROVIDER : "none";
  return {
    provider,
    baseUrl: (
      env.LLM_BASE_URL ?? (provider === "openai" || provider === "anthropic" ? DEFAULT_BASE_URL[provider] : "")
    ).replace(/\/+$/, ""),
    apiKey: env.LLM_API_KEY ?? "",
    jsonMode: env.LLM_JSON_MODE,
    reasoningEffort: env.LLM_REASONING_EFFORT,
    models: {
      vision: env.LLM_MODEL_VISION ?? (provider === "mock" ? "mock-vision" : ""),
      text: env.LLM_MODEL_TEXT ?? (provider === "mock" ? "mock-text" : ""),
    },
    prices: {
      vision: { input: env.LLM_PRICE_VISION_INPUT, output: env.LLM_PRICE_VISION_OUTPUT },
      text: { input: env.LLM_PRICE_TEXT_INPUT, output: env.LLM_PRICE_TEXT_OUTPUT },
    },
    defaultMonthlyBudgetUsd: env.LLM_MONTHLY_BUDGET_USD,
  };
}

export function llmConfig(): LlmConfig {
  return parseLlmConfig(process.env);
}
