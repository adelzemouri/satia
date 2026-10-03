import { rejectCron } from "@/server/cron";
import { runPhotoPurge } from "@/server/photos";

export const dynamic = "force-dynamic";

/**
 * Purge quotidienne des photos de repas, appelée par le cron de l'hébergeur (voir vercel.json).
 * Vercel envoie `Authorization: Bearer $CRON_SECRET` ; sans ce secret, la route reste fermée
 * et la purge passe par le filet de sécurité `purgePhotosIfDue` (au fil des visites).
 */
export async function GET(request: Request) {
  const rejected = rejectCron(request);
  if (rejected) return rejected;
  const purged = await runPhotoPurge();
  return Response.json({ purged });
}
