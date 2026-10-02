import "server-only";

import type { AiAvailability } from "@/features/ai/ai-entry";
import { llmConfig } from "@/llm/config";
import { aiStatus } from "@/llm/guard";

/** Saisie IA proposée si elle est configurée ; sinon null, ou la raison (pause, plafond atteint). */
export async function aiAvailability(): Promise<AiAvailability | null> {
  const status = await aiStatus(llmConfig());
  if (!status.configured) return null;
  if (!status.enabled) return { available: false, reason: "ai_disabled" };
  if (status.spentUsdMicros >= status.budgetUsd * 1_000_000) return { available: false, reason: "ai_budget_reached" };
  return { available: true };
}
