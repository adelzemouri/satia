import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db/client";
import { mealEntries, user } from "@/db/schema";
import { addDays } from "@/domain/energy";
import { acceptInvite, createAccessLink, listGuests, setupFirstAdmin } from "@/server/accounts";
import { guestActivities } from "@/server/beta";

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
  });
});
