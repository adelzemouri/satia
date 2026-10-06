import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/auth/[...all]/route";
import { GET as health } from "@/app/api/health/route";
import { db } from "@/db/client";
import { setupFirstAdmin } from "@/server/accounts";
import { auth, pendingTwoFactorUserId } from "@/server/auth";
import { consumeRateLimit, purgeRateLimits } from "@/server/rate-limit";

import { resetDatabase } from "./helpers";

const admin = {
  setupToken: process.env.SETUP_TOKEN!,
  householdName: "Famille Test",
  name: "Adel",
  email: "admin@example.com",
  password: "un-mot-de-passe-solide",
};

/** Connexion comme le ferait l'action de l'app ; renvoie les cookies posés, prêts à renvoyer. */
async function signIn(): Promise<{ cookie: string; twoFactor: boolean }> {
  const { headers, response } = await auth().api.signInEmail({
    body: { email: admin.email, password: admin.password },
    headers: new Headers({ host: "localhost:3000" }),
    returnHeaders: true,
  });
  const cookie = headers
    .getSetCookie()
    .map((line) => line.split(";")[0]!)
    .join("; ");
  return { cookie, twoFactor: "twoFactorRedirect" in response && response.twoFactorRedirect === true };
}

/** Le secret de l'URI est en base32 ; `generateTOTP` attend le secret brut. */
function fromBase32(value: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...value.replace(/=+$/, "")].map((c) => alphabet.indexOf(c).toString(2).padStart(5, "0")).join("");
  const bytes = bits.match(/.{8}/g)!.map((byte) => parseInt(byte, 2));
  return Buffer.from(bytes).toString("utf8");
}

function cookieStore(cookie: string) {
  return {
    getAll: () =>
      cookie.split("; ").map((pair) => {
        const index = pair.indexOf("=");
        return { name: pair.slice(0, index), value: pair.slice(index + 1) };
      }),
  };
}

describe("durcissement de l'authentification", () => {
  beforeEach(resetDatabase);

  it("refuse les écritures sur les routes HTTP de Better Auth", async () => {
    const response = POST();
    expect(response.status).toBe(404);
  });

  it("retrouve le compte en attente de son code 2FA, pas un cookie inventé", async () => {
    await setupFirstAdmin(admin);
    const { cookie: sessionCookie } = await signIn();
    const enabled = await auth().api.enableTwoFactor({
      body: { password: admin.password },
      headers: new Headers({ host: "localhost:3000", cookie: sessionCookie }),
    });
    if (enabled.method !== "totp") throw new Error("TOTP attendu");
    const secret = fromBase32(new URL(enabled.totpURI).searchParams.get("secret")!);
    const { code } = await auth().api.generateTOTP({
      body: { secret },
      headers: new Headers({ host: "localhost:3000" }),
    });
    await auth().api.verifyTOTP({
      body: { code },
      headers: new Headers({ host: "localhost:3000", cookie: sessionCookie }),
    });

    const { cookie, twoFactor } = await signIn();
    expect(twoFactor).toBe(true);
    const [row] = await db().execute<{ id: string }>(sql`select id from users where email = ${admin.email}`);
    expect(await pendingTwoFactorUserId(cookieStore(cookie))).toBe(row!.id);
    expect(await pendingTwoFactorUserId(cookieStore("pommelia.two_factor=invente.signature"))).toBeNull();
    expect(await pendingTwoFactorUserId(cookieStore("autre=1"))).toBeNull();
  });

  it("ne détaille la santé qu'à l'admin connecté", async () => {
    await setupFirstAdmin(admin);
    const { cookie } = await signIn();
    const detailed = await health(
      new Request("http://localhost/api/health", { headers: { host: "localhost:3000", cookie } }),
    );
    expect(await detailed.json()).toHaveProperty("config");
  });

  it("purge les compteurs de plus d'un jour", async () => {
    await consumeRateLimit("login:ip:ancienne", { window: 60, max: 5 });
    await consumeRateLimit("login:ip:recente", { window: 60, max: 5 });
    await db().execute(
      sql`update rate_limits set window_start = now() - interval '2 days' where key = 'login:ip:ancienne'`,
    );
    expect(await purgeRateLimits()).toBe(1);
    const left = await db().execute<{ key: string }>(sql`select key from rate_limits`);
    expect(left.map((r) => r.key)).toEqual(["login:ip:recente"]);
  });
});
