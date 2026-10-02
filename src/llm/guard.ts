import "server-only";

import { enforceRateLimit } from "@/server/rate-limit";
import { getAiSettings } from "@/server/settings";

import type { LlmConfig } from "./config";
import { AiUnavailableError } from "./types";
import { currentMonthCostMicros } from "./usage";

/** Appels IA par utilisateur : de quoi saisir un repas confortablement, pas plus. */
const AI_RATE_LIMIT = { window: 600, max: 20 };

export type AiStatus = {
  configured: boolean;
  enabled: boolean;
  budgetUsd: number;
  spentUsdMicros: number;
};

export async function aiStatus(config: LlmConfig): Promise<AiStatus> {
  const [settings, spent] = await Promise.all([getAiSettings(), currentMonthCostMicros()]);
  return {
    configured: config.provider !== "none",
    enabled: settings.enabled,
    budgetUsd: settings.monthlyBudgetUsd ?? config.defaultMonthlyBudgetUsd,
    spentUsdMicros: spent,
  };
}

/**
 * Vérifie, avant tout appel, que l'IA est configurée, activée par l'admin, sous le plafond
 * du mois, et que l'utilisateur ne dépasse pas sa limite de débit. L'appelant a déjà
 * vérifié la session : `userId` vient toujours d'une session valide.
 */
export async function assertAiAvailable(userId: string, config: LlmConfig): Promise<void> {
  const status = await aiStatus(config);
  if (!status.configured) throw new AiUnavailableError("not_configured");
  if (!status.enabled) throw new AiUnavailableError("disabled");
  if (status.spentUsdMicros >= status.budgetUsd * 1_000_000) throw new AiUnavailableError("budget_reached");
  await enforceRateLimit(`ai:${userId}`, AI_RATE_LIMIT);
}
