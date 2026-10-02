import { createHash, timingSafeEqual } from "node:crypto";

import { env } from "@/server/env";
import { purgePhotos } from "@/server/photos";

export const dynamic = "force-dynamic";

/** Compare deux secrets en temps constant (empreintes de même longueur). */
function sameSecret(a: string, b: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

/**
 * Purge quotidienne des photos de repas, appelée par le cron de l'hébergeur (voir vercel.json).
 * Vercel envoie `Authorization: Bearer $CRON_SECRET` ; sans ce secret, la route reste fermée.
 */
export async function GET(request: Request) {
  const secret = env().CRON_SECRET;
  if (!secret) return Response.json({ error: "cron_not_configured" }, { status: 503 });
  if (!sameSecret(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const purged = await purgePhotos();
  return Response.json({ purged });
}
