import "server-only";

import { randomUUID } from "node:crypto";

import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { bodyMeasurements, progressPhotos } from "@/db/schema";
import { MEASUREMENT_KINDS, measurementChanges, POSES, type Pose } from "@/domain/activity";

import { DomainError } from "./errors";
import { assertNotFuture } from "./journal";
import { isImage, PHOTO_MIME_TYPES } from "./photos";
import { deleteObjects, putObject, signedGetUrl } from "./storage";

const isoDate = z.iso.date();

// --- Mensurations --------------------------------------------------------------

export const measurementSchema = z.object({
  date: isoDate,
  kind: z.enum(MEASUREMENT_KINDS),
  valueCm: z.number().min(10, "measurement_range").max(250, "measurement_range"),
});

export async function setMeasurement(userId: string, input: z.input<typeof measurementSchema>): Promise<void> {
  const data = measurementSchema.parse(input);
  assertNotFuture(data.date);
  const valueCm = Math.round(data.valueCm * 10) / 10;
  await db()
    .insert(bodyMeasurements)
    .values({ userId, ...data, valueCm })
    .onConflictDoUpdate({
      target: [bodyMeasurements.userId, bodyMeasurements.date, bodyMeasurements.kind],
      set: { valueCm },
    });
}

export async function deleteMeasurement(userId: string, date: string, kind: string): Promise<void> {
  await db()
    .delete(bodyMeasurements)
    .where(
      and(
        eq(bodyMeasurements.userId, userId),
        eq(bodyMeasurements.date, isoDate.parse(date)),
        eq(bodyMeasurements.kind, z.enum(MEASUREMENT_KINDS).parse(kind)),
      ),
    );
}

export async function measurementOverview(userId: string) {
  const rows = await db()
    .select({ date: bodyMeasurements.date, kind: bodyMeasurements.kind, valueCm: bodyMeasurements.valueCm })
    .from(bodyMeasurements)
    .where(eq(bodyMeasurements.userId, userId))
    .orderBy(asc(bodyMeasurements.date));
  return { changes: measurementChanges(rows), history: rows.slice(-12).reverse() };
}

// --- Photos de progression -----------------------------------------------------

/** Photo réduite côté client (côté long ≤ 1080 px) : quelques centaines de Ko au plus. */
const PROGRESS_PHOTO_MAX_BYTES = 1_500_000;

export const progressPhotoSchema = z.object({
  date: isoDate,
  pose: z.enum(POSES),
  imageBase64: z
    .string()
    .min(1)
    .max(Math.ceil((PROGRESS_PHOTO_MAX_BYTES * 4) / 3) + 4),
  mime: z.enum(PHOTO_MIME_TYPES),
});

export async function addProgressPhoto(userId: string, input: z.input<typeof progressPhotoSchema>): Promise<string> {
  const data = progressPhotoSchema.parse(input);
  assertNotFuture(data.date);
  const bytes = Uint8Array.from(Buffer.from(data.imageBase64, "base64"));
  if (bytes.length > PROGRESS_PHOTO_MAX_BYTES || !isImage(bytes, data.mime)) throw new DomainError("invalid_photo");
  const objectKey = `progress/${userId}/${randomUUID()}.${data.mime === "image/webp" ? "webp" : "jpg"}`;
  await putObject(objectKey, bytes, data.mime);
  const [row] = await db()
    .insert(progressPhotos)
    .values({ userId, date: data.date, pose: data.pose, objectKey })
    .returning({ id: progressPhotos.id });
  return row!.id;
}

/** Retire le fichier puis la ligne, pour ne jamais laisser d'objet orphelin. */
export async function deleteProgressPhoto(userId: string, id: string): Promise<void> {
  const [row] = await db()
    .select({ objectKey: progressPhotos.objectKey })
    .from(progressPhotos)
    .where(and(eq(progressPhotos.id, z.uuid().parse(id)), eq(progressPhotos.userId, userId)));
  if (!row) throw new DomainError("not_found");
  await deleteObjects([row.objectKey]);
  await db().delete(progressPhotos).where(eq(progressPhotos.id, id));
}

export type ProgressPhoto = { id: string; date: string; pose: Pose; url: string };

/** Photos récentes et comparaison « première / dernière » par pose, avec URL signées courtes. */
export async function progressPhotoOverview(userId: string): Promise<{
  recent: ProgressPhoto[];
  compare: { pose: Pose; first: ProgressPhoto; latest: ProgressPhoto }[];
}> {
  const rows = await db()
    .select({
      id: progressPhotos.id,
      date: progressPhotos.date,
      pose: progressPhotos.pose,
      objectKey: progressPhotos.objectKey,
    })
    .from(progressPhotos)
    .where(eq(progressPhotos.userId, userId))
    .orderBy(asc(progressPhotos.date), asc(progressPhotos.createdAt));
  const urls = new Map<string, string>();
  const withUrl = async (row: (typeof rows)[number]): Promise<ProgressPhoto> => {
    if (!urls.has(row.id)) urls.set(row.id, await signedGetUrl(row.objectKey));
    return { id: row.id, date: row.date, pose: row.pose, url: urls.get(row.id)! };
  };
  const compare = [];
  for (const pose of POSES) {
    const ofPose = rows.filter((row) => row.pose === pose);
    if (ofPose.length >= 2)
      compare.push({ pose, first: await withUrl(ofPose[0]!), latest: await withUrl(ofPose.at(-1)!) });
  }
  const recent = await Promise.all(rows.slice(-9).reverse().map(withUrl));
  return { recent, compare };
}

/** Données exportées : mensurations et métadonnées des photos (sans les images). */
export async function bodyExport(userId: string) {
  const [measurements, photos] = await Promise.all([
    db().select().from(bodyMeasurements).where(eq(bodyMeasurements.userId, userId)).orderBy(asc(bodyMeasurements.date)),
    db()
      .select({
        id: progressPhotos.id,
        date: progressPhotos.date,
        pose: progressPhotos.pose,
        createdAt: progressPhotos.createdAt,
      })
      .from(progressPhotos)
      .where(eq(progressPhotos.userId, userId))
      .orderBy(desc(progressPhotos.date)),
  ]);
  return { measurements, photos };
}
