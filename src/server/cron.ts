import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { env } from "./env";

/** Compare deux secrets en temps constant (empreintes de même longueur). */
function sameSecret(a: string, b: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

/**
 * Vérifie l'appel d'une tâche planifiée : `Authorization: Bearer $CRON_SECRET`.
 * Renvoie la réponse d'erreur à servir, ou null si l'appel est autorisé.
 */
export function rejectCron(request: Request): Response | null {
  const secret = env().CRON_SECRET;
  if (!secret) return Response.json({ error: "cron_not_configured" }, { status: 503 });
  if (!sameSecret(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
