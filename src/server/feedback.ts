import "server-only";

import { randomUUID } from "node:crypto";

import { and, count, desc, eq, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { feedbackMessages, households, profiles, user } from "@/db/schema";
import {
  cleanPagePath,
  FEEDBACK_KINDS,
  FEEDBACK_MAX_LENGTH,
  FEEDBACK_SCREENSHOT_RETENTION_DAYS,
} from "@/domain/feedback";

import { DomainError } from "./errors";
import { notifyFeedback } from "./notifications";
import { isImage, PHOTO_MIME_TYPES } from "./photos";
import { enforceRateLimit } from "./rate-limit";
import { deleteObjects, putObject, signedGetUrl } from "./storage";
import { currentVersion } from "./version";

/** Capture réduite côté client (côté long ≤ 1280 px) : quelques centaines de Ko au plus. */
const SCREENSHOT_MAX_BYTES = 1_500_000;
/** De quoi signaler plusieurs soucis dans la journée, pas de quoi remplir la base. */
const FEEDBACK_RATE_LIMIT = { window: 86_400, max: 20 };

export const feedbackSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  message: z.string().trim().min(1).max(FEEDBACK_MAX_LENGTH),
  page: z.string().max(400).nullish(),
  errorDetail: z.string().max(1000).nullish(),
  screenshot: z
    .object({
      base64: z
        .string()
        .min(1)
        .max(Math.ceil((SCREENSHOT_MAX_BYTES * 4) / 3) + 4),
      mime: z.enum(PHOTO_MIME_TYPES),
    })
    .nullish(),
});
export type FeedbackInput = z.input<typeof feedbackSchema>;

/** Version déployée telle qu'affichée en bas de Moi, suivie du commit court (« 1.196 · e3aaeb9 »). */
export function appVersion(): string | null {
  const { label, sha } = currentVersion();
  if (label && sha && label !== sha) return `${label} · ${sha}`;
  return label ?? sha;
}

/** Foyer qui reçoit les messages de la personne : le sien, ou celui qui gère son foyer à part. */
async function recipientHousehold(userId: string): Promise<{ householdId: string; senderName: string }> {
  const [row] = await db()
    .select({
      householdId: user.householdId,
      managedBy: households.managedBy,
      name: user.name,
      firstName: profiles.firstName,
    })
    .from(user)
    .innerJoin(households, eq(households.id, user.householdId))
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(eq(user.id, userId));
  if (!row) throw new DomainError("not_found");
  return { householdId: row.managedBy ?? row.householdId, senderName: row.firstName ?? row.name };
}

/** Admin qui lira le message (« Écris directement à Adel »), ou null. */
export async function feedbackRecipient(userId: string): Promise<{ id: string; name: string } | null> {
  const { householdId } = await recipientHousehold(userId);
  const [admin] = await db()
    .select({ id: user.id, name: user.name, firstName: profiles.firstName })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(and(eq(user.householdId, householdId), eq(user.role, "admin")))
    .orderBy(user.createdAt)
    .limit(1);
  return admin ? { id: admin.id, name: admin.firstName ?? admin.name } : null;
}

export async function sendFeedback(
  userId: string,
  input: FeedbackInput,
  context: { userAgent: string | null; origin: string },
): Promise<string> {
  const data = feedbackSchema.parse(input);
  await enforceRateLimit(`feedback:${userId}`, FEEDBACK_RATE_LIMIT);
  const { householdId, senderName } = await recipientHousehold(userId);
  let screenshotKey: string | null = null;
  if (data.screenshot) {
    const bytes = Uint8Array.from(Buffer.from(data.screenshot.base64, "base64"));
    if (bytes.length > SCREENSHOT_MAX_BYTES || !isImage(bytes, data.screenshot.mime))
      throw new DomainError("invalid_photo");
    screenshotKey = `feedback/${userId}/${randomUUID()}.${data.screenshot.mime === "image/webp" ? "webp" : "jpg"}`;
    await putObject(screenshotKey, bytes, data.screenshot.mime);
  }
  const [row] = await db()
    .insert(feedbackMessages)
    .values({
      userId,
      householdId,
      kind: data.kind,
      message: data.message,
      page: cleanPagePath(data.page),
      appVersion: appVersion(),
      userAgent: context.userAgent?.slice(0, 400) ?? null,
      errorDetail: data.errorDetail?.trim() || null,
      screenshotKey,
    })
    .returning({ id: feedbackMessages.id });
  // Une notification qui échoue ne doit pas faire croire que le message est perdu.
  await notifyFeedback(householdId, { kind: data.kind, senderName, message: data.message }, context.origin).catch(
    (error: unknown) => console.error("Notification de remarque échouée", error),
  );
  return row!.id;
}

export type FeedbackItem = {
  id: string;
  kind: (typeof FEEDBACK_KINDS)[number];
  message: string;
  senderName: string;
  page: string | null;
  appVersion: string | null;
  userAgent: string | null;
  errorDetail: string | null;
  screenshotUrl: string | null;
  handled: boolean;
  createdAt: Date;
};

/** Boîte de réception de l'admin : non traités d'abord, puis les plus récents. */
export async function listFeedback(householdId: string, limit = 30): Promise<FeedbackItem[]> {
  const rows = await db()
    .select({
      id: feedbackMessages.id,
      kind: feedbackMessages.kind,
      message: feedbackMessages.message,
      page: feedbackMessages.page,
      appVersion: feedbackMessages.appVersion,
      userAgent: feedbackMessages.userAgent,
      errorDetail: feedbackMessages.errorDetail,
      screenshotKey: feedbackMessages.screenshotKey,
      handledAt: feedbackMessages.handledAt,
      createdAt: feedbackMessages.createdAt,
      name: user.name,
      firstName: profiles.firstName,
    })
    .from(feedbackMessages)
    .innerJoin(user, eq(user.id, feedbackMessages.userId))
    .leftJoin(profiles, eq(profiles.userId, feedbackMessages.userId))
    .where(eq(feedbackMessages.householdId, householdId))
    .orderBy(isNotNull(feedbackMessages.handledAt), desc(feedbackMessages.createdAt))
    .limit(limit);
  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      kind: row.kind,
      message: row.message,
      senderName: row.firstName ?? row.name,
      page: row.page,
      appVersion: row.appVersion,
      userAgent: row.userAgent,
      errorDetail: row.errorDetail,
      screenshotUrl: row.screenshotKey ? await signedGetUrl(row.screenshotKey) : null,
      handled: row.handledAt !== null,
      createdAt: row.createdAt,
    })),
  );
}

export async function unreadFeedbackCount(householdId: string): Promise<number> {
  const [row] = await db()
    .select({ n: count() })
    .from(feedbackMessages)
    .where(and(eq(feedbackMessages.householdId, householdId), isNull(feedbackMessages.handledAt)));
  return row?.n ?? 0;
}

/** Marque comme traité (ou rouvre) un message reçu par ce foyer. */
export async function setFeedbackHandled(householdId: string, id: string, handled: boolean): Promise<void> {
  const rows = await db()
    .update(feedbackMessages)
    .set({ handledAt: handled ? new Date() : null })
    .where(and(eq(feedbackMessages.id, z.uuid().parse(id)), eq(feedbackMessages.householdId, householdId)))
    .returning({ id: feedbackMessages.id });
  if (rows.length === 0) throw new DomainError("not_found");
}

/** Purge quotidienne des captures : le texte du message reste. */
export async function purgeFeedbackScreenshots(now: Date = new Date()): Promise<number> {
  const expired = new Date(now.getTime() - FEEDBACK_SCREENSHOT_RETENTION_DAYS * 86_400_000);
  const rows = await db()
    .select({ id: feedbackMessages.id, key: feedbackMessages.screenshotKey })
    .from(feedbackMessages)
    .where(and(isNotNull(feedbackMessages.screenshotKey), lt(feedbackMessages.createdAt, expired)));
  if (rows.length === 0) return 0;
  await deleteObjects(rows.flatMap((row) => row.key ?? []));
  await db()
    .update(feedbackMessages)
    .set({ screenshotKey: null })
    .where(
      inArray(
        feedbackMessages.id,
        rows.map((row) => row.id),
      ),
    );
  return rows.length;
}

/** Pour l'export personnel : les messages envoyés (sans les captures). */
export async function feedbackExport(userId: string) {
  return db()
    .select({
      kind: feedbackMessages.kind,
      message: feedbackMessages.message,
      page: feedbackMessages.page,
      createdAt: feedbackMessages.createdAt,
      handledAt: feedbackMessages.handledAt,
    })
    .from(feedbackMessages)
    .where(eq(feedbackMessages.userId, userId))
    .orderBy(feedbackMessages.createdAt);
}
