import "server-only";

import { timingSafeEqual } from "node:crypto";

import { and, count, eq, gt, isNull, sql } from "drizzle-orm";

import { INVITE_TTL_DAYS, PASSWORD_RESET_TTL_HOURS } from "@/config/app";
import { db } from "@/db/client";
import { type AccessLinkKind, accessLinks, account, households, photos, type Role, session, user } from "@/db/schema";

import { env } from "./env";
import { DomainError } from "./errors";
import { hashPassword } from "./password";
import { deleteObjects } from "./storage";
import { generateToken, hashToken } from "./tokens";

type Tx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function hasAnyUser(): Promise<boolean> {
  const [row] = await db().select({ n: count() }).from(user);
  return (row?.n ?? 0) > 0;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function insertUserWithPassword(
  tx: Tx,
  input: { householdId: string; role: Role; name: string; email: string; password: string },
): Promise<string> {
  const email = normalizeEmail(input.email);
  const [existing] = await tx.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (existing) throw new DomainError("email_taken");

  const userId = crypto.randomUUID();
  await tx.insert(user).values({
    id: userId,
    name: input.name.trim(),
    email,
    householdId: input.householdId,
    role: input.role,
  });
  await tx.insert(account).values({
    id: crypto.randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: await hashPassword(input.password),
  });
  return userId;
}

/** Première installation : crée le foyer et le compte admin. Possible une seule fois. */
export async function setupFirstAdmin(input: {
  setupToken: string;
  householdName: string;
  name: string;
  email: string;
  password: string;
}): Promise<void> {
  const expected = env().SETUP_TOKEN;
  if (!expected || !safeEqual(input.setupToken, expected)) throw new DomainError("invalid_setup_token");

  await db().transaction(async (tx) => {
    // Verrou transactionnel : deux installations simultanées ne peuvent pas créer deux admins.
    await tx.execute(sql`select pg_advisory_xact_lock(724519)`);
    const [row] = await tx.select({ n: count() }).from(user);
    if ((row?.n ?? 0) > 0) throw new DomainError("already_installed");
    const [household] = await tx
      .insert(households)
      .values({ name: input.householdName.trim() })
      .returning({ id: households.id });
    await insertUserWithPassword(tx, { ...input, householdId: household!.id, role: "admin" });
  });
}

type LinkInput =
  | { kind: "invite"; householdId: string; createdBy: string; role: Role; label: string }
  | { kind: "password_reset"; householdId: string; createdBy: string; userId: string };

/** Crée un lien à usage unique et renvoie le jeton en clair (jamais stocké). */
export async function createAccessLink(input: LinkInput): Promise<string> {
  const token = generateToken();
  const ttlMs = input.kind === "invite" ? INVITE_TTL_DAYS * 24 * 3600_000 : PASSWORD_RESET_TTL_HOURS * 3600_000;
  await db()
    .insert(accessLinks)
    .values({
      kind: input.kind,
      tokenHash: hashToken(token),
      householdId: input.householdId,
      createdBy: input.createdBy,
      role: input.kind === "invite" ? input.role : null,
      label: input.kind === "invite" ? input.label.trim() : null,
      userId: input.kind === "password_reset" ? input.userId : null,
      expiresAt: new Date(Date.now() + ttlMs),
    });
  return token;
}

/** Lien valide (non utilisé, non expiré) correspondant au jeton, ou `null`. */
export async function findValidLink(token: string, kind: AccessLinkKind) {
  const [link] = await db()
    .select()
    .from(accessLinks)
    .where(
      and(
        eq(accessLinks.tokenHash, hashToken(token)),
        eq(accessLinks.kind, kind),
        isNull(accessLinks.usedAt),
        gt(accessLinks.expiresAt, new Date()),
      ),
    );
  return link ?? null;
}

/** Marque le lien comme utilisé ; échoue si un autre onglet l'a déjà consommé. */
async function consumeLink(tx: Tx, token: string, kind: AccessLinkKind) {
  const [link] = await tx
    .update(accessLinks)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(accessLinks.tokenHash, hashToken(token)),
        eq(accessLinks.kind, kind),
        isNull(accessLinks.usedAt),
        gt(accessLinks.expiresAt, new Date()),
      ),
    )
    .returning();
  if (!link) throw new DomainError("link_invalid");
  return link;
}

export async function acceptInvite(input: { token: string; name: string; email: string; password: string }) {
  await db().transaction(async (tx) => {
    const link = await consumeLink(tx, input.token, "invite");
    await insertUserWithPassword(tx, { ...input, householdId: link.householdId, role: link.role ?? "member" });
  });
}

export async function resetPassword(input: { token: string; password: string }) {
  await db().transaction(async (tx) => {
    const link = await consumeLink(tx, input.token, "password_reset");
    if (!link.userId) throw new DomainError("link_invalid");
    await tx
      .update(account)
      .set({ password: await hashPassword(input.password), updatedAt: new Date() })
      .where(and(eq(account.userId, link.userId), eq(account.providerId, "credential")));
    // Toutes les sessions existantes sont révoquées.
    await tx.delete(session).where(eq(session.userId, link.userId));
  });
}

export async function listMembers(householdId: string) {
  return db()
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.householdId, householdId))
    .orderBy(user.createdAt);
}

export async function listPendingInvites(householdId: string) {
  return db()
    .select({ id: accessLinks.id, label: accessLinks.label, role: accessLinks.role, expiresAt: accessLinks.expiresAt })
    .from(accessLinks)
    .where(
      and(
        eq(accessLinks.householdId, householdId),
        eq(accessLinks.kind, "invite"),
        isNull(accessLinks.usedAt),
        gt(accessLinks.expiresAt, new Date()),
      ),
    )
    .orderBy(accessLinks.createdAt);
}

export async function revokeInvite(householdId: string, linkId: string) {
  await db()
    .delete(accessLinks)
    .where(and(eq(accessLinks.id, linkId), eq(accessLinks.householdId, householdId), isNull(accessLinks.usedAt)));
}

/**
 * Supprime un compte et toutes ses données (cascade). Le dernier admin du foyer
 * ne peut pas être supprimé, pour que le foyer reste administrable.
 */
export async function deleteUser(userId: string): Promise<void> {
  const photoKeys = await db().transaction(async (tx) => {
    const [target] = await tx
      .select({ householdId: user.householdId, role: user.role })
      .from(user)
      .where(eq(user.id, userId));
    if (!target) return [];
    if (target.role === "admin") {
      const [row] = await tx
        .select({ n: count() })
        .from(user)
        .where(and(eq(user.householdId, target.householdId), eq(user.role, "admin")));
      if ((row?.n ?? 0) <= 1) throw new DomainError("last_admin");
    }
    const keys = await tx.select({ key: photos.objectKey }).from(photos).where(eq(photos.userId, userId));
    await tx.delete(user).where(eq(user.id, userId));
    return keys.map((row) => row.key);
  });
  // Les lignes `photos` partent en cascade ; on retire ensuite les fichiers du stockage.
  await deleteObjects(photoKeys).catch((error: unknown) => console.error("Suppression des photos échouée", error));
}

/** Garde-fou : un admin n'agit que sur les membres de son propre foyer. */
export async function assertSameHousehold(householdId: string, userId: string): Promise<void> {
  const [target] = await db().select({ householdId: user.householdId }).from(user).where(eq(user.id, userId));
  if (!target || target.householdId !== householdId) throw new DomainError("not_found");
}
