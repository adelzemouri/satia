import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db/client";
import { coachMessages, llmCalls, mealEntries, pushSubscriptions, session, user } from "@/db/schema";
import { addDays } from "@/domain/energy";
import { acceptInvite, createAccessLink, listGuests, setupFirstAdmin } from "@/server/accounts";
import { guestActivities, guestDetails } from "@/server/beta";

import { resetDatabase } from "./helpers";

const TODAY = "2026-10-18";

function entry(userId: string, date: string) {
  return {
    userId,
    date,
    slot: "lunch" as const,
    label: "Pomme",
    quantity: 150,
    unit: "g" as const,
    grams: 150,
    kcal: 80,
    proteinG: 0.4,
    carbsG: 18,
    fatG: 0.3,
    inputMethod: "manual" as const,
  };
}

describe("suivi des invités de la bêta", () => {
  beforeEach(resetDatabase);

  it("ne lit que les jours notés de chaque invité, et sa dernière saisie même hors fenêtre", async () => {
    await setupFirstAdmin({
      setupToken: process.env.SETUP_TOKEN!,
      householdName: "Famille Test",
      name: "Adel",
      email: "admin@example.com",
      password: "un-mot-de-passe-solide",
    });
    const [owner] = await db().select().from(user).where(eq(user.email, "admin@example.com"));
    for (const name of ["Sami", "Nora"]) {
      const token = await createAccessLink({
        kind: "invite",
        householdId: owner!.householdId,
        createdBy: owner!.id,
        role: "member",
        label: name,
        separateHousehold: true,
      });
      await acceptInvite({ token, name, email: `${name.toLowerCase()}@example.com`, password: "mot-de-passe-solide" });
    }
    const guests = await listGuests(owner!.householdId);
    // Arrivés il y a 40 jours, pour que toute la fenêtre compte.
    const joined = guests.map((guest) => ({ ...guest, createdAt: new Date(`${addDays(TODAY, -40)}T12:00:00Z`) }));
    const [sami, nora] = joined;
    await db()
      .insert(mealEntries)
      .values([
        entry(sami!.id, TODAY),
        entry(sami!.id, TODAY), // deux repas le même jour : un seul jour noté
        entry(sami!.id, addDays(TODAY, -3)),
        entry(nora!.id, addDays(TODAY, -35)), // hors fenêtre
        entry(owner!.id, TODAY), // l'admin n'est pas un invité
      ]);

    const activities = await guestActivities(joined, TODAY);
    expect(activities.size).toBe(2);
    expect(activities.get(sami!.id)).toMatchObject({ logged: 2, lastLogged: TODAY, status: { kind: "active" } });
    expect(activities.get(nora!.id)).toMatchObject({
      logged: 0,
      lastLogged: addDays(TODAY, -35),
      status: { kind: "idle", days: 35 },
    });
    expect(await guestActivities([], TODAY)).toEqual(new Map());

    // La fiche : façons de noter, fonctions, appareil et rappels, sans rien du contenu des repas.
    await db()
      .insert(mealEntries)
      .values([
        { ...entry(sami!.id, addDays(TODAY, -1)), inputMethod: "photo" as const },
        { ...entry(sami!.id, addDays(TODAY, -2)), inputMethod: "voice" as const },
      ]);
    await db()
      .insert(coachMessages)
      .values([
        { userId: sami!.id, role: "user", content: "Bonjour", createdAt: new Date(`${TODAY}T08:00:00Z`) },
        { userId: sami!.id, role: "coach", content: "Salut", createdAt: new Date(`${TODAY}T08:00:01Z`) },
      ]);
    await db()
      .insert(llmCalls)
      .values({
        userId: sami!.id,
        feature: "fridge",
        provider: "mock",
        model: "mock",
        tokensIn: 10,
        tokensOut: 5,
        costUsdMicros: 100,
        latencyMs: 10,
        status: "ok",
        createdAt: new Date(`${TODAY}T09:00:00Z`),
      });
    await db()
      .insert(pushSubscriptions)
      .values({ userId: sami!.id, endpoint: "https://push.test/1", p256dh: "k", auth: "a" });
    await db()
      .insert(session)
      .values({
        token: "jeton-test",
        userId: sami!.id,
        expiresAt: new Date("2099-01-01T00:00:00Z"),
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      });

    const details = await guestDetails([sami!.id, nora!.id], TODAY);
    expect(details.get(sami!.id)).toMatchObject({
      entryCount: 5,
      features: { coach: 1, menu: 0, fridge: 1, training: 0 },
      device: "iphone",
      reminders: true,
    });
    expect(details.get(sami!.id)!.entries.map((share) => share.way)).toEqual(["search", "photo", "text"]);
    expect(details.get(sami!.id)!.lastSeen).toBeInstanceOf(Date);
    expect(details.get(nora!.id)).toMatchObject({ entryCount: 0, entries: [], reminders: false });
  });
});
