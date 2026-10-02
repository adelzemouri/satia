import { rejectCron } from "@/server/cron";
import { purgePhotos } from "@/server/photos";

export const dynamic = "force-dynamic";

/**
 * Purge quotidienne des photos de repas, appelée par le cron de l'hébergeur (voir vercel.json).
 * Vercel envoie `Authorization: Bearer $CRON_SECRET` ; sans ce secret, la route reste fermée.
 */
export async function GET(request: Request) {
  const rejected = rejectCron(request);
  if (rejected) return rejected;
  const purged = await purgePhotos();
  return Response.json({ purged });
}
