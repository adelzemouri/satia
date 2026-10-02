import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, inArray, lt, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { mealEntries, photos } from "@/db/schema";

import { getPhotoSettings } from "./settings";
import { deleteObjects, putObject, signedGetUrl } from "./storage";

/** Une photo analysée mais jamais ajoutée au journal ne sert plus à rien après un jour. */
const UNUSED_PHOTO_HOURS = 24;

export const PHOTO_MIME_TYPES = ["image/webp", "image/jpeg"] as const;
export type PhotoMime = (typeof PHOTO_MIME_TYPES)[number];

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
