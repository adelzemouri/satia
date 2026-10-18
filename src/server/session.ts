import "server-only";

import { headers } from "next/headers";
import { cache } from "react";

import type { Role } from "@/db/schema";
import { DEMO_EMAIL } from "@/domain/demo";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

import { auth } from "./auth";
import { fillDemoGaps } from "./demo";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  householdId: string;
  twoFactorEnabled: boolean;
};

/** Session de la requête courante (mémorisée pour la durée du rendu). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const result = await auth().api.getSession({ headers: await headers() });
  if (!result) return null;
  const { id, name, email, role, householdId, twoFactorEnabled } = result.user;
  // Le compte démo se remplit à chaque visite : le visiteur ne tombe jamais sur des jours vides.
  if (email === DEMO_EMAIL) {
    await fillDemoGaps().catch((error: unknown) => console.error("Remplissage du compte démo impossible", error));
  }
  return { id, name, email, role: role as Role, householdId, twoFactorEnabled: !!twoFactorEnabled };
});

export async function requireUser(locale: Locale): Promise<CurrentUser> {
  const current = await getCurrentUser();
  if (!current) return redirect({ href: "/login", locale });
  return current;
}

export async function requireAdmin(locale: Locale): Promise<CurrentUser> {
  const current = await requireUser(locale);
  if (current.role !== "admin") return redirect({ href: "/", locale });
  return current;
}
