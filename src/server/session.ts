import "server-only";

import { headers } from "next/headers";
import { cache } from "react";

import type { Role } from "@/db/schema";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

import { auth } from "./auth";

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
