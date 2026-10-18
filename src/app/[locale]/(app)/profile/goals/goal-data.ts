import "server-only";

import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { latestWeight } from "@/server/journal";
import { getGoalOn, getProfile } from "@/server/profile";
import { requireUser } from "@/server/session";

/** Profil, objectif en vigueur et dernier poids de l'utilisateur connecté (Moi si pas encore inscrit). */
export async function goalData(locale: Locale) {
  const user = await requireUser(locale);
  const [profile, goal, weight] = await Promise.all([getProfile(user.id), getGoalOn(user.id), latestWeight(user.id)]);
  if (!profile || !goal) return redirect({ href: "/onboarding", locale });
  return { user, profile, goal, currentKg: weight ?? profile.startWeightKg };
}
