"use server";

import { and, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { getLocale } from "next-intl/server";
import QRCode from "qrcode";

import { db } from "@/db/client";
import { account } from "@/db/schema";
import { redirect } from "@/i18n/navigation";
import { deleteUser } from "@/server/accounts";
import { type ActionState, toActionState } from "@/server/action-result";
import { auth } from "@/server/auth";
import { DomainError } from "@/server/errors";
import { verifyPassword } from "@/server/password";
import { enforceRateLimit } from "@/server/rate-limit";
import { getCurrentUser } from "@/server/session";

export type EnableTwoFactorState = (ActionState & { qrSvg?: string; secret?: string; backupCodes?: string[] }) | null;

async function checkPassword(userId: string, password: string): Promise<void> {
  await enforceRateLimit(`password-check:${userId}`, { window: 60, max: 5 });
  const [row] = await db()
    .select({ password: account.password })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
  if (!row?.password || !(await verifyPassword({ hash: row.password, password }))) {
    throw new DomainError("wrong_password");
  }
}

export async function enableTwoFactorAction(
  _prev: EnableTwoFactorState,
  formData: FormData,
): Promise<EnableTwoFactorState> {
  const user = await getCurrentUser();
  if (!user) return { error: "generic" };
  try {
    const password = String(formData.get("password") ?? "");
    await checkPassword(user.id, password);
    const result = await auth().api.enableTwoFactor({ body: { password }, headers: await headers() });
    if (result.method !== "totp") throw new DomainError("generic");
    const secret = new URL(result.totpURI).searchParams.get("secret") ?? undefined;
    const qrSvg = await QRCode.toString(result.totpURI, { type: "svg", margin: 1, width: 220 });
    return { qrSvg, secret, backupCodes: result.backupCodes };
  } catch (error) {
    return toActionState(error);
  }
}

export async function confirmTwoFactorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user) return { error: "generic" };
    await enforceRateLimit(`2fa-confirm:${user.id}`, { window: 60, max: 5 });
    await auth().api.verifyTOTP({
      body: { code: String(formData.get("code") ?? "").trim() },
      headers: await headers(),
    });
  } catch (error) {
    const state = toActionState(error);
    return state?.error === "invalid_credentials" ? { error: "invalid_code" } : state;
  }
  return redirect({ href: "/profile", locale: await getLocale() });
}

export async function disableTwoFactorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user) return { error: "generic" };
    const password = String(formData.get("password") ?? "");
    await checkPassword(user.id, password);
    await auth().api.disableTwoFactor({ body: { password }, headers: await headers() });
  } catch (error) {
    return toActionState(error);
  }
  return redirect({ href: "/profile", locale: await getLocale() });
}

export async function deleteAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user) return { error: "generic" };
    await checkPassword(user.id, String(formData.get("password") ?? ""));
    await deleteUser(user.id);
    const jar = await cookies();
    for (const cookie of jar.getAll()) {
      if (cookie.name.startsWith("pommelia.") || cookie.name.startsWith("__Secure-pommelia.")) jar.delete(cookie.name);
    }
  } catch (error) {
    return toActionState(error);
  }
  return redirect({ href: "/login", locale: await getLocale() });
}
