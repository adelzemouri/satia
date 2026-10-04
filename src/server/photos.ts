import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, inArray, lt, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { appSettings, mealEntries, photos } from "@/db/schema";

import { getPhotoSettings } from "./settings";
import { deleteObjects, putObject, signedGetUrl } from "./storage";

/** Une photo analysée mais jamais ajoutée au journal ne sert plus à rien après un jour. */
const UNUSED_PHOTO_HOURS = 24;

export const PHOTO_MIME_TYPES = ["image/webp", "image/jpeg"] as const;
export type PhotoMime = (typeof PHOTO_MIME_TYPES)[number];

/** Type d'une image d'après sa signature (JPEG, WebP ou PNG), sinon null. */
export function imageMime(bytes: Uint8Array): "image/jpeg" | "image/webp" | "image/png" | null {
  if (isImage(bytes, "image/jpeg")) return "image/jpeg";
  if (bytes.length >= 12 && isImage(bytes, "image/webp")) return "image/webp";
  const png = [0x89, 0x50, 0x4e, 0x47];
  return png.every((byte, index) => bytes[index] === byte) ? "image/png" : null;
}

/** Vérifie la signature du fichier : JPEG (FF D8 FF) ou WebP (RIFF....WEBP). */
export function isImage(bytes: Uint8Array, mime: PhotoMime): boolean {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
}

/** Range la photo (déjà réduite côté client) dans le stockage privé. */
export async function storePhoto(userId: string, bytes: Uint8Array, mime: PhotoMime): Promise<string> {
  const objectKey = `meals/${userId}/${randomUUID()}.${mime === "image/webp" ? "webp" : "jpg"}`;
  await putObject(objectKey, bytes, mime);
  const [row] = await db().insert(photos).values({ userId, objectKey }).returning({ id: photos.id });
  return row!.id;
}

/** Vérifie qu'une photo appartient bien à l'utilisateur. */
export async function ownsPhoto(userId: string, photoId: string): Promise<boolean> {
  const [row] = await db()
    .select({ id: photos.id })
    .from(photos)
    .where(and(eq(photos.id, photoId), eq(photos.userId, userId)));
  return Boolean(row);
}

/** URL signées (courtes) des photos d'un utilisateur, par identifiant. */
export async function photoUrls(userId: string, photoIds: readonly string[]): Promise<Map<string, string>> {
  if (photoIds.length === 0) return new Map();
  const rows = await db()
    .select({ id: photos.id, objectKey: photos.objectKey })
    .from(photos)
    .where(and(eq(photos.userId, userId), inArray(photos.id, [...new Set(photoIds)])));
  return new Map(await Promise.all(rows.map(async (row) => [row.id, await signedGetUrl(row.objectKey)] as const)));
}

/**
 * Purge quotidienne : photos plus anciennes que la durée de conservation, et photos jamais
 * utilisées dans le journal depuis plus d'un jour. Les objets partent avant les lignes, pour
 * qu'une panne du stockage ne laisse pas de fichier orphelin. Renvoie le nombre de photos purgées.
 */
export async function purgePhotos(now: Date = new Date()): Promise<number> {
  const { retentionDays } = await getPhotoSettings();
  const expired = new Date(now.getTime() - retentionDays * 86_400_000);
  const unusedSince = new Date(now.getTime() - UNUSED_PHOTO_HOURS * 3_600_000);
  const unused = sql`not exists (select 1 from ${mealEntries} where ${mealEntries.photoId} = ${photos.id})`;
  const rows = await db()
    .select({ id: photos.id, objectKey: photos.objectKey })
    .from(photos)
    .where(or(lt(photos.createdAt, expired), and(lt(photos.createdAt, unusedSince), unused)));
  return removePhotos(rows);
}

async function removePhotos(rows: readonly { id: string; objectKey: string }[]): Promise<number> {
  if (rows.length === 0) return 0;
  await deleteObjects(rows.map((row) => row.objectKey));
  await db()
    .delete(photos)
    .where(
      inArray(
        photos.id,
        rows.map((row) => row.id),
      ),
    );
  return rows.length;
}

const PURGE_KEY = "photo_purge";
/** Une purge par jour suffit ; un peu moins de 24 h pour ne pas glisser d'un jour à l'autre. */
const PURGE_INTERVAL_HOURS = 20;

export type PurgeRun = { lastRunAt: string; purged: number };

/** Purge immédiate (cron ou bouton de l'admin), en gardant trace du dernier passage. */
export async function runPhotoPurge(now: Date = new Date()): Promise<number> {
  const purged = await purgePhotos(now);
  await recordPurge({ lastRunAt: now.toISOString(), purged });
  return purged;
}

/**
 * Filet de sécurité sans cron : lancée après l'affichage d'une page, la purge ne part que si la
 * dernière date de plus de 20 h. La réservation est atomique, donc deux visites simultanées
 * ne la lancent qu'une fois.
 */
export async function purgePhotosIfDue(now: Date = new Date()): Promise<number | null> {
  const value = { lastRunAt: now.toISOString(), purged: 0 };
  const dueBefore = new Date(now.getTime() - PURGE_INTERVAL_HOURS * 3_600_000).toISOString();
  const claimed = await db()
    .insert(appSettings)
    .values({ key: PURGE_KEY, value, updatedAt: now })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: now },
      setWhere: sql`${appSettings.updatedAt} < ${dueBefore}`,
    })
    .returning({ key: appSettings.key });
  if (claimed.length === 0) return null;
  const purged = await purgePhotos(now);
  if (purged > 0) await recordPurge({ ...value, purged });
  return purged;
}

export async function lastPhotoPurge(): Promise<PurgeRun | null> {
  const [row] = await db().select().from(appSettings).where(eq(appSettings.key, PURGE_KEY));
  const value = row?.value as Partial<PurgeRun> | undefined;
  return typeof value?.lastRunAt === "string" && typeof value.purged === "number"
    ? { lastRunAt: value.lastRunAt, purged: value.purged }
    : null;
}

async function recordPurge(value: PurgeRun): Promise<void> {
  const updatedAt = new Date(value.lastRunAt);
  await db()
    .insert(appSettings)
    .values({ key: PURGE_KEY, value, updatedAt })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt } });
}
