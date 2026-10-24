import "server-only";

import { inArray, lt, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { serverErrors } from "@/db/schema";

/** Assez pour un message de requête et sa cause, pas pour remplir la base. */
const MESSAGE_MAX_LENGTH = 2000;
export const SERVER_ERROR_RETENTION_DAYS = 30;

/** Message lisible d'une erreur, cause comprise (la vraie raison d'un « Failed query » est dedans). */
export function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < 3; depth++) {
    if (current instanceof Error) {
      const code = (current as { code?: unknown }).code;
      parts.push(`${current.name}: ${current.message}${typeof code === "string" ? ` [${code}]` : ""}`);
      current = current.cause;
    } else {
      parts.push(String(current));
      break;
    }
  }
  return parts.join("\ncause: ").slice(0, MESSAGE_MAX_LENGTH);
}

/** Note une erreur du serveur (appelé par `onRequestError`) ; ne lève jamais. */
export async function recordServerError(error: unknown, path: string | null): Promise<void> {
  const digest = (error as { digest?: unknown } | null)?.digest;
  if (typeof digest !== "string" || !digest) return;
  const message = describeError(error);
  const cleanPath = path?.split("?")[0]?.slice(0, 200) ?? null;
  await db()
    .insert(serverErrors)
    .values({ digest, message, path: cleanPath })
    .onConflictDoUpdate({
      target: serverErrors.digest,
      set: { message, path: cleanPath, count: sql`${serverErrors.count} + 1`, lastAt: new Date() },
    });
}

/** Les messages connus pour ces digests. */
export async function serverErrorMessages(digests: string[]): Promise<Map<string, string>> {
  if (digests.length === 0) return new Map();
  const rows = await db()
    .select({ digest: serverErrors.digest, message: serverErrors.message })
    .from(serverErrors)
    .where(inArray(serverErrors.digest, digests));
  return new Map(rows.map((row) => [row.digest, row.message]));
}

export async function purgeServerErrors(now: Date = new Date()): Promise<number> {
  const before = new Date(now.getTime() - SERVER_ERROR_RETENTION_DAYS * 86_400_000);
  const rows = await db()
    .delete(serverErrors)
    .where(lt(serverErrors.lastAt, before))
    .returning({ digest: serverErrors.digest });
  return rows.length;
}
