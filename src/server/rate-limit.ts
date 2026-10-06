import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db/client";

export type RateLimitRule = { window: number; max: number };
export type RateLimitResult = { allowed: boolean; retryAfter: number | null };

/**
 * Compte une requête pour `key` dans une fenêtre fixe de `window` secondes, de façon atomique
 * (un seul upsert), puis indique si elle est autorisée. Partagé par toutes les instances serverless.
 */
export async function consumeRateLimit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const rows = await db().execute<{ count: number; window_start: Date }>(sql`
    insert into rate_limits as r (key, count, window_start)
    values (${key}, 1, now())
    on conflict (key) do update set
      count = case when r.window_start < now() - make_interval(secs => ${rule.window}) then 1 else r.count + 1 end,
      window_start = case when r.window_start < now() - make_interval(secs => ${rule.window}) then now() else r.window_start end
    returning count, window_start
  `);
  const row = rows[0]!;
  if (row.count <= rule.max) return { allowed: true, retryAfter: null };
  const elapsed = (Date.now() - new Date(row.window_start).getTime()) / 1000;
  return { allowed: false, retryAfter: Math.max(1, Math.ceil(rule.window - elapsed)) };
}

export class RateLimitedError extends Error {
  constructor(public readonly retryAfter: number) {
    super("rate_limited");
  }
}

/** Lève `RateLimitedError` si la limite est atteinte. */
export async function enforceRateLimit(key: string, rule: RateLimitRule): Promise<void> {
  const result = await consumeRateLimit(key, rule);
  if (!result.allowed) throw new RateLimitedError(result.retryAfter ?? rule.window);
}

/** Vérifie la limite sans compter de requête (pour ne compter que les échecs, par exemple). */
export async function assertBelowLimit(key: string, rule: RateLimitRule): Promise<void> {
  const rows = await db().execute<{ count: number; window_start: Date }>(sql`
    select count, window_start from rate_limits
    where key = ${key} and window_start >= now() - make_interval(secs => ${rule.window})
  `);
  const row = rows[0];
  if (row && row.count >= rule.max) {
    const elapsed = (Date.now() - new Date(row.window_start).getTime()) / 1000;
    throw new RateLimitedError(Math.max(1, Math.ceil(rule.window - elapsed)));
  }
}

/** Supprime les compteurs expirés (IP et e-mails de connexion ne sont pas gardés au-delà d'un jour). */
export async function purgeRateLimits(): Promise<number> {
  const rows = await db().execute(
    sql`delete from rate_limits where window_start < now() - interval '1 day' returning key`,
  );
  return rows.length;
}
