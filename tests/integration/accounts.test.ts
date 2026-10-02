import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db/client";
import { account, accessLinks, user } from "@/db/schema";
import {
  acceptInvite,
  createAccessLink,
  deleteUser,
  findValidLink,
  hasAnyUser,
  listMembers,
  resetPassword,
  setupFirstAdmin,
} from "@/server/accounts";
import { verifyPassword } from "@/server/password";

import { resetDatabase } from "./helpers";

const admin = {
  setupToken: process.env.SETUP_TOKEN!,
  householdName: "Famille Test",
  name: "Adel",
  email: "Admin@Example.com",
  password: "un-mot-de-passe-solide",
};

async function adminUser() {
  const [row] = await db().select().from(user).where(eq(user.email, "admin@example.com"));
  return row!;
}

describe("comptes", () => {
  beforeEach(resetDatabase);

  it("installe le foyer et l'admin une seule fois, avec un mot de passe argon2", async () => {
    expect(await hasAnyUser()).toBe(false);
    await setupFirstAdmin(admin);
    const created = await adminUser();
    expect(created.role).toBe("admin");
    const [credentials] = await db().select().from(account).where(eq(account.userId, created.id));
    expect(credentials!.password).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword({ hash: credentials!.password!, password: admin.password })).toBe(true);
    await expect(setupFirstAdmin({ ...admin, email: "autre@example.com" })).rejects.toThrow("already_installed");
  });

  it("refuse un jeton d'installation incorrect", async () => {
    await expect(setupFirstAdmin({ ...admin, setupToken: "mauvais" })).rejects.toThrow("invalid_setup_token");
    expect(await hasAnyUser()).toBe(false);
  });

  it("une invitation crée un membre dans le foyer et ne sert qu'une fois", async () => {
    await setupFirstAdmin(admin);
    const owner = await adminUser();
    const token = await createAccessLink({
      kind: "invite",
      householdId: owner.householdId,
      createdBy: owner.id,
      role: "member",
      label: "Léo",
    });
    const [stored] = await db().select().from(accessLinks);
    expect(stored!.tokenHash).not.toContain(token);

    await acceptInvite({ token, name: "Léo", email: "leo@example.com", password: "mot-de-passe-de-leo" });
    const members = await listMembers(owner.householdId);
    expect(members.map((m) => [m.name, m.role])).toEqual([
      ["Adel", "admin"],
      ["Léo", "member"],
    ]);
    await expect(
      acceptInvite({ token, name: "Intrus", email: "intrus@example.com", password: "mot-de-passe-intrus" }),
    ).rejects.toThrow("link_invalid");
  });

  it("refuse une invitation expirée et une adresse déjà utilisée", async () => {
    await setupFirstAdmin(admin);
    const owner = await adminUser();
    const base = {
      kind: "invite" as const,
      householdId: owner.householdId,
      createdBy: owner.id,
      role: "member" as const,
      label: "x",
    };
    const expired = await createAccessLink(base);
    await db()
      .update(accessLinks)
      .set({ expiresAt: new Date(Date.now() - 1000) });
    expect(await findValidLink(expired, "invite")).toBeNull();

    const fresh = await createAccessLink(base);
    await expect(
      acceptInvite({ token: fresh, name: "Doublon", email: "ADMIN@example.com", password: "mot-de-passe-doublon" }),
    ).rejects.toThrow("email_taken");
    // L'échec annule toute la transaction : le lien reste utilisable.
    expect(await findValidLink(fresh, "invite")).not.toBeNull();
  });

  it("un lien de réinitialisation change le mot de passe et ferme les sessions", async () => {
    await setupFirstAdmin(admin);
    const owner = await adminUser();
    const token = await createAccessLink({
      kind: "password_reset",
      householdId: owner.householdId,
      createdBy: owner.id,
      userId: owner.id,
    });
    expect(await findValidLink(token, "invite")).toBeNull();
    await resetPassword({ token, password: "nouveau-mot-de-passe" });
    const [credentials] = await db().select().from(account).where(eq(account.userId, owner.id));
    expect(await verifyPassword({ hash: credentials!.password!, password: "nouveau-mot-de-passe" })).toBe(true);
    await expect(resetPassword({ token, password: "encore-un-autre" })).rejects.toThrow("link_invalid");
  });

  it("le dernier admin ne peut pas être supprimé, un membre si", async () => {
    await setupFirstAdmin(admin);
    const owner = await adminUser();
    await expect(deleteUser(owner.id)).rejects.toThrow("last_admin");

    const token = await createAccessLink({
      kind: "invite",
      householdId: owner.householdId,
      createdBy: owner.id,
      role: "member",
      label: "x",
    });
    await acceptInvite({ token, name: "Léo", email: "leo@example.com", password: "mot-de-passe-de-leo" });
    const [leo] = await db().select().from(user).where(eq(user.email, "leo@example.com"));
    await deleteUser(leo!.id);
    expect(await db().select().from(account).where(eq(account.userId, leo!.id))).toEqual([]);
  });
});
