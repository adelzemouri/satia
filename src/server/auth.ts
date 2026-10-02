import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";

import { APP_NAME } from "@/config/app";
import { db } from "@/db/client";
import * as schema from "@/db/schema";

import { env } from "./env";
import { hashPassword, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, verifyPassword } from "./password";
import { consumeRateLimit } from "./rate-limit";

function createAuth() {
  const config = env();
  return betterAuth({
    appName: APP_NAME,
    secret: config.BETTER_AUTH_SECRET,
    baseURL: {
      // Production, previews Vercel et local : l'hôte de la requête fait foi s'il est autorisé.
      allowedHosts: ["localhost:*", "127.0.0.1:*", "*.vercel.app", ...(config.APP_HOSTS ?? [])],
      protocol: config.NODE_ENV === "production" ? "https" : "auto",
    },
    database: drizzleAdapter(db(), {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        twoFactor: schema.twoFactor,
      },
    }),
    advanced: {
      database: { generateId: "uuid" },
      useSecureCookies: config.NODE_ENV === "production",
      cookiePrefix: "satia",
    },
    emailAndPassword: {
      enabled: true,
      // Pas d'inscription publique : les comptes sont créés par invitation (src/server/accounts.ts).
      disableSignUp: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      password: { hash: hashPassword, verify: verifyPassword },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    user: {
      additionalFields: {
        householdId: { type: "string", required: true, input: false },
        role: { type: "string", required: true, input: false, defaultValue: "member" },
        locale: { type: "string", required: false, input: false, defaultValue: "fr" },
        energyUnit: { type: "string", required: false, input: false, defaultValue: "kcal" },
      },
    },
    rateLimit: {
      enabled: config.NODE_ENV !== "development",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/two-factor/verify-totp": { window: 60, max: 5 },
        "/two-factor/verify-backup-code": { window: 60, max: 5 },
        "/change-password": { window: 60, max: 5 },
      },
      customStorage: { consume: (key, rule) => consumeRateLimit(`auth:${key}`, rule) },
    },
    plugins: [twoFactor({ issuer: APP_NAME }), nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"];

let instance: Auth | undefined;

export function auth(): Auth {
  instance ??= createAuth();
  return instance;
}
