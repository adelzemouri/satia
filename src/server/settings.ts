import "server-only";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { appSettings } from "@/db/schema";
import { type CalorieFloors, DEFAULT_CALORIE_FLOORS } from "@/domain/energy";

const FLOORS_KEY = "calorie_floors";

export const calorieFloorsSchema = z.object({
  female: z.number().int().min(1000).max(2500),
  male: z.number().int().min(1000).max(3000),
});

export async function getCalorieFloors(): Promise<CalorieFloors> {
  const [row] = await db().select().from(appSettings).where(eq(appSettings.key, FLOORS_KEY));
  const parsed = calorieFloorsSchema.safeParse(row?.value);
  return parsed.success ? parsed.data : DEFAULT_CALORIE_FLOORS;
}

export async function setCalorieFloors(floors: CalorieFloors): Promise<void> {
  const value = calorieFloorsSchema.parse(floors);
  await db()
    .insert(appSettings)
    .values({ key: FLOORS_KEY, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
}

const AI_KEY = "ai";

export const aiSettingsSchema = z.object({
  enabled: z.boolean(),
  /** Plafond de dépense du mois en dollars ; null = valeur par défaut (`LLM_MONTHLY_BUDGET_USD`). */
  monthlyBudgetUsd: z.number().min(0).max(1000).nullable(),
});
export type AiSettings = z.infer<typeof aiSettingsSchema>;

export async function getAiSettings(): Promise<AiSettings> {
  const [row] = await db().select().from(appSettings).where(eq(appSettings.key, AI_KEY));
  const parsed = aiSettingsSchema.safeParse(row?.value);
  return parsed.success ? parsed.data : { enabled: true, monthlyBudgetUsd: null };
}

export async function setAiSettings(settings: AiSettings): Promise<void> {
  const value = aiSettingsSchema.parse(settings);
  await db()
    .insert(appSettings)
    .values({ key: AI_KEY, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
}
