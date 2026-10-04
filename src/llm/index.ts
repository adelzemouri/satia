import "server-only";

import type { z } from "zod";

import type { LlmFeature } from "@/db/schema";
import type { CoachStyle } from "@/domain/profile";

import { llmConfig, type ModelKind } from "./config";
import { assertAiAvailable } from "./guard";
import { toJsonSchema } from "./json";
import { costUsdMicros } from "./pricing";
import { CONNECTION_TEST_PROMPT } from "./prompts/connection-test";
import {
  FOOD_ESTIMATE_SYSTEM,
  MEAL_PHOTO_SYSTEM,
  MEAL_TEXT_SYSTEM,
  mealUserPrompt,
  type PromptContext,
} from "./prompts/meal";
import { providerFor } from "./providers";
import { recipeImagePrompt } from "./prompts/recipe-image";
import { coachSystem, weeklyReviewSystem } from "./prompts/coach";
import { FRIDGE_SYSTEM, MENU_PLAN_SYSTEM } from "./prompts/planning";
import { trainingPlanSystem } from "./prompts/training";
import {
  coachReplySchema,
  connectionTestSchema,
  foodEstimatesSchema,
  fridgeSchema,
  mealItemsSchema,
  menuPlanSchema,
  trainingPlanSchema,
  weeklyReviewSchema,
} from "./schemas";
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

/**
 * Photo d'illustration d'une recette (modèle d'images), soumise aux mêmes gardes que les
 * autres appels et journalisée au prix d'une image. Renvoie les octets de l'image.
 */
export async function generateRecipeImage(
  userId: string,
  name: string,
  ingredients: readonly string[],
): Promise<Uint8Array> {
  const config = llmConfig();
  await assertAiAvailable(userId, config);
  const provider = providerFor(config);
  if (!provider?.generateImage || !config.imageModel) throw new AiUnavailableError("not_configured");
  const started = performance.now();
  const log = (status: "ok" | "error" | "timeout" | "invalid_output", cost: number) =>
    recordCall({
      userId,
      feature: "recipe_image",
      provider: provider.name,
      model: config.imageModel,
      tokensIn: 0,
      tokensOut: 0,
      costUsdMicros: cost,
      latencyMs: Math.round(performance.now() - started),
      status,
    });
  try {
    const image = await provider.generateImage({
      model: config.imageModel,
      prompt: recipeImagePrompt(name, ingredients),
    });
    await log("ok", Math.round(config.imagePrice * 1_000_000));
    return Uint8Array.from(Buffer.from(image.base64, "base64"));
  } catch (error) {
    if (!(error instanceof LlmProviderError)) throw error;
    await log(error.kind === "timeout" ? "timeout" : error.kind === "invalid_json" ? "invalid_output" : "error", 0);
    throw new AiUnavailableError("provider_error");
  }
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

/** Marge de sortie des appels de saisie : les modèles qui réfléchissent comptent cette réflexion en sortie. */
const MEAL_OUTPUT_TOKENS = 2048;

export type MealItem = z.infer<typeof mealItemsSchema>["items"][number];
export type FoodEstimate = z.infer<typeof foodEstimatesSchema>["items"][number];

/** Aliments et quantités visibles sur une photo (modèle vision, image en basse résolution). */
export async function analyzeMealPhoto(userId: string, image: LlmImage, context: PromptContext): Promise<MealItem[]> {
  const result = await callLlm({
    userId,
    feature: "meal_photo",
    kind: "vision",
    system: MEAL_PHOTO_SYSTEM,
    user: mealUserPrompt("Analyse cette photo.", context),
    images: [image],
    schemaName: "meal_items",
    schema: mealItemsSchema,
    maxOutputTokens: MEAL_OUTPUT_TOKENS,
  });
  return result.data.items;
}

/** Aliments et quantités d'une description dictée ou écrite (modèle texte). */
export async function parseMealText(userId: string, text: string, context: PromptContext): Promise<MealItem[]> {
  const result = await callLlm({
    userId,
    feature: "meal_text",
    kind: "text",
    system: MEAL_TEXT_SYSTEM,
    user: mealUserPrompt(text, context),
    schemaName: "meal_items",
    schema: mealItemsSchema,
    maxOutputTokens: MEAL_OUTPUT_TOKENS,
  });
  return result.data.items;
}

/**
 * Valeurs pour 100 g des aliments absents de la base, en un seul appel. C'est le seul cas où
 * l'IA fournit des valeurs nutritionnelles ; elles sont alors marquées « estimé ».
 */
export async function estimateFoods(userId: string, names: readonly string[]): Promise<FoodEstimate[]> {
  const result = await callLlm({
    userId,
    feature: "estimate",
    kind: "text",
    system: FOOD_ESTIMATE_SYSTEM,
    user: names.join("\n"),
    schemaName: "food_estimates",
    schema: foodEstimatesSchema,
    maxOutputTokens: 1024,
  });
  return result.data.items;
}

/** Marge de sortie du coach : réponse courte, mais les modèles qui réfléchissent comptent cette réflexion. */
const COACH_OUTPUT_TOKENS = 2048;

/** Réponse du coach : contexte compact, derniers échanges et nouveau message dans `user`. */
export async function coachReply(userId: string, style: CoachStyle, user: string): Promise<string> {
  const result = await callLlm({
    userId,
    feature: "coach",
    kind: "text",
    system: coachSystem(style),
    user,
    schemaName: "coach_reply",
    schema: coachReplySchema,
    maxOutputTokens: COACH_OUTPUT_TOKENS,
  });
  return result.data.reply;
}

export type WeeklyReview = z.infer<typeof weeklyReviewSchema>;

/** Bilan de la semaine écoulée : un seul appel par utilisateur et par semaine. */
export async function writeWeeklyReview(userId: string, style: CoachStyle, data: string): Promise<WeeklyReview> {
  const result = await callLlm({
    userId,
    feature: "weekly_review",
    kind: "text",
    system: weeklyReviewSystem(style),
    user: data,
    schemaName: "weekly_review",
    schema: weeklyReviewSchema,
    maxOutputTokens: COACH_OUTPUT_TOKENS,
  });
  return result.data;
}

export type MenuPlan = z.infer<typeof menuPlanSchema>;

/** Menu de la semaine proposé par le coach (un seul appel, modèle texte). */
export async function proposeMenu(userId: string, user: string): Promise<MenuPlan> {
  const result = await callLlm({
    userId,
    feature: "menu_plan",
    kind: "text",
    system: MENU_PLAN_SYSTEM,
    user,
    schemaName: "menu_plan",
    schema: menuPlanSchema,
    maxOutputTokens: 4096,
  });
  return result.data;
}

export type FridgeScan = z.infer<typeof fridgeSchema>;

/** Scanner de frigo : ingrédients visibles et 3 idées de plats (modèle vision, basse résolution). */
export async function scanFridge(userId: string, image: LlmImage, user: string): Promise<FridgeScan> {
  const result = await callLlm({
    userId,
    feature: "fridge",
    kind: "vision",
    system: FRIDGE_SYSTEM,
    user,
    images: [image],
    schemaName: "fridge",
    schema: fridgeSchema,
    maxOutputTokens: 2048,
  });
  return result.data;
}

export type TrainingPlanText = z.infer<typeof trainingPlanSchema>;

/** Titres, conseils et ordre des exercices du programme de la semaine (un appel, modèle texte). */
export async function personalizeTrainingPlan(
  userId: string,
  style: CoachStyle,
  user: string,
): Promise<TrainingPlanText> {
  const result = await callLlm({
    userId,
    feature: "training_plan",
    kind: "text",
    system: trainingPlanSystem(style),
    user,
    schemaName: "training_plan",
    schema: trainingPlanSchema,
    maxOutputTokens: 2048,
  });
  return result.data;
}
