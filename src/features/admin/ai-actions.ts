"use server";

import { revalidatePath } from "next/cache";

import { testConnection } from "@/llm";
import { type ActionState, toActionState } from "@/server/action-result";
import { DomainError } from "@/server/errors";
import { runPhotoPurge } from "@/server/photos";
import { getCurrentUser } from "@/server/session";
import { aiSettingsSchema, photoSettingsSchema, setAiSettings, setPhotoSettings } from "@/server/settings";

async function requireAdminId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") throw new DomainError("not_found");
  return user.id;
}

export async function saveAiSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdminId();
    const budget = String(formData.get("budget") ?? "")
      .replace(",", ".")
      .trim();
    await setAiSettings(
      aiSettingsSchema.parse({
        enabled: formData.get("enabled") === "on",
        monthlyBudgetUsd: budget === "" ? null : Number(budget),
      }),
    );
    revalidatePath("/[locale]/admin/ai", "page");
    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}

export async function savePhotoSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdminId();
    await setPhotoSettings(photoSettingsSchema.parse({ retentionDays: Number(formData.get("retentionDays")) }));
    revalidatePath("/[locale]/admin/ai", "page");
    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}

export type PurgeState = { error: string } | { purged: number } | null;

/** Purge immédiate des photos expirées, depuis la page d'administration. */
export async function purgePhotosNowAction(): Promise<PurgeState> {
  try {
    await requireAdminId();
    const purged = await runPhotoPurge();
    revalidatePath("/[locale]/admin/ai", "page");
    return { purged };
  } catch (error) {
    return { error: toActionState(error)?.error ?? "generic" };
  }
}

export type ConnectionTestState =
  | { error: string }
  | { results: { kind: "text" | "vision"; model: string; latencyMs: number; tokens: number; costUsdMicros: number }[] }
  | null;

export async function testConnectionAction(): Promise<ConnectionTestState> {
  try {
    const { text, vision } = await testConnection(await requireAdminId());
    revalidatePath("/[locale]/admin/ai", "page");
    const view = (kind: "text" | "vision", call: typeof text) => ({
      kind,
      model: call.model,
      latencyMs: call.latencyMs,
      tokens: call.usage.inputTokens + call.usage.outputTokens,
      costUsdMicros: call.costUsdMicros,
    });
    return { results: vision === text ? [view("text", text)] : [view("text", text), view("vision", vision)] };
  } catch (error) {
    return { error: toActionState(error)?.error ?? "generic" };
  }
}
