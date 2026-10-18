import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db/client";
import { account, households, mealEntries, user, weightEntries } from "@/db/schema";
import { todayIso } from "@/domain/dates";
import { addDays } from "@/domain/energy";
import { DEMO_EMAIL } from "@/domain/demo";
import { listMembers, setupFirstAdmin } from "@/server/accounts";
import { demoAccountStatus, deleteDemoAccount, fillDemoGaps, resetDemoAccount } from "@/server/demo";
import { daySummary, weightOverview } from "@/server/journal";
import { getProfile } from "@/server/profile";
import { verifyPassword } from "@/server/password";

import { resetDatabase } from "./helpers";

async function adminHousehold() {
  await setupFirstAdmin({
    setupToken: process.env.SETUP_TOKEN!,
    householdName: "Famille",
    name: "Adel",
    email: "adel@example.com",
    password: "motdepasse-solide",
  });
  const [admin] = await db().select().from(user).where(eq(user.email, "adel@example.com"));
  return admin!;
}

describe("compte démo", () => {
  beforeEach(resetDatabase);

  it("crée un membre dans un foyer à part, avec un historique", async () => {
    const admin = await adminHousehold();
    const { email, password } = await resetDemoAccount();
    expect(email).toBe(DEMO_EMAIL);
    expect(password).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);

    const [demo] = await db().select().from(user).where(eq(user.email, DEMO_EMAIL));
    expect(demo!.role).toBe("member");
    expect(demo!.householdId).not.toBe(admin.householdId);
    expect((await listMembers(admin.householdId)).map((member) => member.email)).toEqual(["adel@example.com"]);
    const [credential] = await db().select().from(account).where(eq(account.userId, demo!.id));
    expect(await verifyPassword({ hash: credential!.password!, password })).toBe(true);

    expect((await getProfile(demo!.id))?.firstName).toBe("Camille");
    const entries = await db().select().from(mealEntries).where(eq(mealEntries.userId, demo!.id));
    expect(entries.length).toBeGreaterThan(80);
    expect(entries.every((entry) => entry.foodId !== null && entry.kcal > 0)).toBe(true);
    const today = await daySummary(demo!.id, todayIso());
    expect(today.totals.kcal).toBeGreaterThan(0);
    expect((await weightOverview(demo!.id)).entries.length).toBeGreaterThan(8);
    expect(await demoAccountStatus()).not.toBeNull();
  });

  it("se réinitialise avec un nouveau mot de passe et se supprime sans toucher la famille", async () => {
    await adminHousehold();
    const first = await resetDemoAccount();
    const second = await resetDemoAccount();
    expect(second.password).not.toBe(first.password);
    expect(await db().select().from(user)).toHaveLength(2);

    await deleteDemoAccount();
    expect(await demoAccountStatus()).toBeNull();
    expect(await db().select().from(user)).toHaveLength(1);
    expect((await db().select().from(households)).map((row) => row.name)).toEqual(["Famille"]);
  });

  it("complète les jours vides sans toucher aux jours saisis ni au mot de passe", async () => {
    await adminHousehold();
    const { password } = await resetDemoAccount("2026-09-20");
    const [demo] = await db().select().from(user).where(eq(user.email, DEMO_EMAIL));
    const before = await db().select().from(mealEntries).where(eq(mealEntries.userId, demo!.id));
    const weightsBefore = await db().select().from(weightEntries).where(eq(weightEntries.userId, demo!.id));

    const now = new Date("2026-10-01T11:00:00Z"); // 13 h à Paris
    const { days } = await fillDemoGaps(now);
    // Du 20 septembre (le petit-déjeuner y est déjà) au 1er octobre, plus les deux jours sautés.
    expect(days).toBe(11 + 2);

    const after = await db().select().from(mealEntries).where(eq(mealEntries.userId, demo!.id));
    const ids = new Set(after.map((entry) => entry.id));
    expect(before.every((entry) => ids.has(entry.id))).toBe(true);
    expect(after.filter((entry) => entry.date === "2026-09-20")).toHaveLength(
      before.filter((entry) => entry.date === "2026-09-20").length,
    );
    for (let date = "2026-08-16"; date <= "2026-10-01"; date = addDays(date, 1)) {
      expect(
        after.some((entry) => entry.date === date),
        date,
      ).toBe(true);
    }
    expect(new Set(after.filter((entry) => entry.date === "2026-10-01").map((entry) => entry.slot))).toEqual(
      new Set(["breakfast", "lunch"]),
    );
    const weightsAfter = await db().select().from(weightEntries).where(eq(weightEntries.userId, demo!.id));
    for (const row of weightsBefore) expect(weightsAfter).toContainEqual(row);
    expect(weightsAfter.length).toBeGreaterThan(weightsBefore.length);

    const [credential] = await db().select().from(account).where(eq(account.userId, demo!.id));
    expect(await verifyPassword({ hash: credential!.password!, password })).toBe(true);
    expect(await fillDemoGaps(now)).toEqual({ days: 0 });
  });
});
