import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db/client";
import { llmCalls, user } from "@/db/schema";
import { AiUnavailableError, callLlm, testConnection } from "@/llm";
import { setProviderForTests } from "@/llm/providers";
import { connectionTestSchema, mealItemsSchema } from "@/llm/schemas";
import { LlmProviderError, type LlmProvider } from "@/llm/types";
import { currentMonthCostMicros, monthlyCosts } from "@/llm/usage";
import { setupFirstAdmin } from "@/server/accounts";
import { collectUserData } from "@/server/data-export";
import { RateLimitedError } from "@/server/rate-limit";
import { setAiSettings } from "@/server/settings";

import { resetDatabase } from "./helpers";

async function setupUser() {
  await setupFirstAdmin({
    setupToken: process.env.SETUP_TOKEN!,
    householdName: "Famille",
    name: "Adel",
    email: "adel@example.com",
    password: "un-mot-de-passe-solide",
  });
  const [row] = await db().select().from(user).where(eq(user.email, "adel@example.com"));
  return row!.id;
}

const mealPhoto = (userId: string) =>
  callLlm({
    userId,
    feature: "meal_photo",
    kind: "vision",
    system: "Liste les aliments visibles.",
    user: "Photo du repas.",
    images: [{ mime: "image/webp", base64: "AAAA" }],
    schemaName: "meal_items",
    schema: mealItemsSchema,
    maxOutputTokens: 200,
  });

/** Fournisseur scripté : renvoie (ou lève) les réponses dans l'ordre. */
function scripted(...steps: (unknown | Error)[]): LlmProvider {
  return {
    name: "script",
    async complete() {
      const step = steps.shift();
      if (step instanceof Error) throw step;
      return { json: step, usage: { inputTokens: 1000, outputTokens: 100 } };
    },
  };
}

describe("couche LLM", () => {
  beforeEach(async () => {
    await resetDatabase();
    vi.stubEnv("LLM_PROVIDER", "mock");
    vi.stubEnv("LLM_PRICE_VISION_INPUT", "0.1");
    vi.stubEnv("LLM_PRICE_VISION_OUTPUT", "0.4");
    vi.stubEnv("LLM_MONTHLY_BUDGET_USD", "2");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    setProviderForTests(null);
  });

  it("valide la sortie et journalise modèle, tokens, coût et latence", async () => {
    const userId = await setupUser();
    const result = await mealPhoto(userId);
    expect(result.data.items[0]).toMatchObject({ name: "riz basmati cuit", grams: 180 });
    const [call] = await db().select().from(llmCalls);
    expect(call).toMatchObject({
      userId,
      feature: "meal_photo",
      provider: "mock",
      model: "mock-vision",
      status: "ok",
      tokensIn: result.usage.inputTokens,
      costUsdMicros: result.costUsdMicros,
    });
    expect(call!.costUsdMicros).toBeGreaterThan(0);
    expect(await currentMonthCostMicros()).toBe(call!.costUsdMicros);
  });

  it("refait une seule tentative si la sortie est invalide, et journalise les deux", async () => {
    const userId = await setupUser();
    setProviderForTests(
      scripted({ items: "pas une liste" }, { items: [{ name: "pomme", grams: 150, confidence: 1 }] }),
    );
    const result = await mealPhoto(userId);
    expect(result.data.items).toHaveLength(1);
    const calls = await db().select().from(llmCalls).orderBy(llmCalls.createdAt);
    expect(calls.map((call) => call.status).sort()).toEqual(["invalid_output", "ok"]);
    // Les deux tentatives sont facturées : 2 × (1000 × 0,1 + 100 × 0,4) millionièmes de dollar.
    expect(await currentMonthCostMicros()).toBe(280);
  });

  it("abandonne après deux sorties invalides, et ne réessaie pas une panne", async () => {
    const userId = await setupUser();
    setProviderForTests(scripted({}, {}));
    await expect(mealPhoto(userId)).rejects.toMatchObject({ reason: "provider_error" });
    setProviderForTests(scripted(new LlmProviderError("délai", "timeout")));
    await expect(mealPhoto(userId)).rejects.toBeInstanceOf(AiUnavailableError);
    const statuses = (await db().select().from(llmCalls)).map((call) => call.status).sort();
    expect(statuses).toEqual(["invalid_output", "invalid_output", "timeout"]);
  });

  it("se coupe sans configuration, sur décision de l'admin ou au-delà du plafond", async () => {
    const userId = await setupUser();
    vi.stubEnv("LLM_PROVIDER", "none");
    await expect(mealPhoto(userId)).rejects.toMatchObject({ reason: "not_configured" });

    vi.stubEnv("LLM_PROVIDER", "mock");
    await setAiSettings({ enabled: false, monthlyBudgetUsd: null });
    await expect(mealPhoto(userId)).rejects.toMatchObject({ reason: "disabled" });

    // Plafond de 0,00001 $ (10 millionièmes) : le premier appel passe, le suivant non.
    await setAiSettings({ enabled: true, monthlyBudgetUsd: 0.00001 });
    await mealPhoto(userId);
    await expect(mealPhoto(userId)).rejects.toMatchObject({ reason: "budget_reached" });
    expect(await db().select().from(llmCalls)).toHaveLength(1);
  });

  it("limite le nombre d'appels par utilisateur", async () => {
    const userId = await setupUser();
    for (let i = 0; i < 20; i++) await mealPhoto(userId);
    await expect(mealPhoto(userId)).rejects.toBeInstanceOf(RateLimitedError);
  });

  it("teste la connexion, puis résume les coûts par mois et par membre", async () => {
    const userId = await setupUser();
    const { text, vision } = await testConnection(userId);
    expect(connectionTestSchema.parse(text.data)).toEqual({ ok: true });
    expect(vision.model).toBe("mock-vision");
    await mealPhoto(userId);
    const [row] = await monthlyCosts();
    expect(row).toMatchObject({ userId, name: "Adel", calls: 3, failures: 0 });
    expect(row!.month).toMatch(/^\d{4}-\d{2}$/);
    expect((await collectUserData(userId)).aiCalls).toHaveLength(3);
  });
});
