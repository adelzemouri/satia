"use server";

import { getLocale } from "next-intl/server";

import type { Plan } from "@/domain/energy";
import { redirect } from "@/i18n/navigation";
import { type ActionState, toActionState } from "@/server/action-result";
import { previewPlan, saveOnboarding } from "@/server/profile";
import { getCurrentUser } from "@/server/session";

import type { OnboardingInput } from "./schema";

export async function previewPlanAction(input: OnboardingInput): Promise<{ plan: Plan } | ActionState> {
  if (!(await getCurrentUser())) return { error: "generic" };
  try {
    return { plan: await previewPlan(input) };
  } catch (error) {
    return toActionState(error);
  }
}

export async function saveOnboardingAction(input: OnboardingInput): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "generic" };
  try {
    await saveOnboarding(user.id, input);
  } catch (error) {
    return toActionState(error);
  }
  return redirect({ href: "/", locale: await getLocale() });
}
