import { rejectCron } from "@/server/cron";
import { runNotifications, vapidPublicKey } from "@/server/notifications";

export const dynamic = "force-dynamic";

/**
 * Rappels (repas, eau, bilan), appelée toutes les 15 minutes par le workflow GitHub Actions
 * « Notifications » (le cron de Vercel Hobby ne passe qu'une fois par jour).
 */
export async function GET(request: Request) {
  const rejected = rejectCron(request);
  if (rejected) return rejected;
  if (!vapidPublicKey()) return Response.json({ error: "push_not_configured" }, { status: 503 });
  return Response.json(await runNotifications(new Date(), new URL(request.url).origin));
}
