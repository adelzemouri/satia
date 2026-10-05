import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const LLM_FEATURES = [
  "connection_test",
  "meal_photo",
  "meal_text",
  "estimate",
  "coach",
  "weekly_review",
  "menu_plan",
  "fridge",
  "training_plan",
  "recipe_image",
  "recipe_steps",
] as const;
export type LlmFeature = (typeof LLM_FEATURES)[number];

export const LLM_CALL_STATUSES = ["ok", "invalid_output", "error", "timeout"] as const;
export type LlmCallStatus = (typeof LLM_CALL_STATUSES)[number];

/**
 * Journal de chaque appel au LLM, réussi ou non : alimente la page admin des coûts et le
 * plafond mensuel. L'utilisateur supprimé devient null pour que le coût du mois reste juste.
 */
export const llmCalls = pgTable(
  "llm_calls",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid().references(() => user.id, { onDelete: "set null" }),
    feature: text({ enum: LLM_FEATURES }).notNull(),
    provider: text().notNull(),
    model: text().notNull(),
    tokensIn: integer().notNull(),
    tokensOut: integer().notNull(),
    /** Coût estimé en millionièmes de dollar, d'après les tarifs configurés. */
    costUsdMicros: integer().notNull(),
    latencyMs: integer().notNull(),
    status: text({ enum: LLM_CALL_STATUSES }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.createdAt), index().on(t.userId, t.createdAt)],
);
