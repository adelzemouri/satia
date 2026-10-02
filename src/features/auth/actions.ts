"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { acceptInvite, resetPassword, setupFirstAdmin } from "@/server/accounts";
import { type ActionState, toActionState } from "@/server/action-result";
import { auth } from "@/server/auth";
import { assertBelowLimit, consumeRateLimit, enforceRateLimit } from "@/server/rate-limit";
import { clientIp } from "@/server/request";

import { inviteSchema, loginSchema, resetSchema, setupSchema, twoFactorSchema } from "./schemas";

const ATTEMPTS = { window: 60, max: 5 };
/** Échecs de connexion tolérés par compte avant blocage temporaire. */
const LOGIN_FAILURES = { window: 15 * 60, max: 5 };

function fields(formData: FormData) {
  return Object.fromEntries([...formData.entries()].map(([key, value]) => [key, String(value)]));
}

/** Ouvre une session ; renvoie vrai si une vérification 2FA est requise. */
async function signIn(email: string, password: string): Promise<boolean> {
  const result = await auth().api.signInEmail({ body: { email, password }, headers: await headers() });
  return "twoFactorRedirect" in result && result.twoFactorRedirect === true;
}

async function goTo(href: "/" | "/login" | "/login/two-factor"): Promise<never> {
  return redirect({ href, locale: await getLocale() });
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let needsTwoFactor: boolean;
  try {
    const input = loginSchema.parse(fields(formData));
    const ip = await clientIp();
    const failuresKey = `login:failures:${input.email}`;
    await enforceRateLimit(`login:ip:${ip}`, { window: 60, max: 30 });
    await assertBelowLimit(failuresKey, LOGIN_FAILURES);
    try {
      needsTwoFactor = await signIn(input.email, input.password);
    } catch (error) {
      await consumeRateLimit(failuresKey, LOGIN_FAILURES);
      throw error;
    }
  } catch (error) {
    return toActionState(error);
  }
  return goTo(needsTwoFactor ? "/login/two-factor" : "/");
}

export async function verifyTwoFactorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const input = twoFactorSchema.parse({
      code: formData.get("code"),
      method: formData.get("method"),
      trustDevice: formData.get("trustDevice") === "on",
    });
    const failuresKey = `2fa:failures:${await clientIp()}`;
    await assertBelowLimit(failuresKey, ATTEMPTS);
    const requestHeaders = await headers();
    const body = { code: input.code, trustDevice: input.trustDevice };
    try {
      if (input.method === "totp") await auth().api.verifyTOTP({ body, headers: requestHeaders });
      else await auth().api.verifyBackupCode({ body, headers: requestHeaders });
    } catch (error) {
      await consumeRateLimit(failuresKey, ATTEMPTS);
      throw error;
    }
  } catch (error) {
    const state = toActionState(error);
    return state?.error === "invalid_credentials" ? { error: "invalid_code" } : state;
  }
  return goTo("/");
}

export async function setupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const input = setupSchema.parse(fields(formData));
    await enforceRateLimit(`setup:ip:${await clientIp()}`, ATTEMPTS);
    await setupFirstAdmin(input);
    await signIn(input.email, input.password);
  } catch (error) {
    return toActionState(error);
  }
  return goTo("/");
}

export async function acceptInviteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const input = inviteSchema.parse(fields(formData));
    await enforceRateLimit(`invite:ip:${await clientIp()}`, ATTEMPTS);
    await acceptInvite(input);
    await signIn(input.email, input.password);
  } catch (error) {
    return toActionState(error);
  }
  return goTo("/");
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const input = resetSchema.parse(fields(formData));
    await enforceRateLimit(`reset:ip:${await clientIp()}`, ATTEMPTS);
    await resetPassword(input);
  } catch (error) {
    return toActionState(error);
  }
  return { ok: true };
}

export async function logoutAction(): Promise<void> {
  await auth().api.signOut({ headers: await headers() });
  await goTo("/login");
}
