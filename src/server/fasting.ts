import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { APP_TIMEZONE } from "@/config/app";
import { db } from "@/db/client";
import { fastingPlans, fasts } from "@/db/schema";
import { todayIso } from "@/domain/dates";
import {
  activeWindow,
  CUSTOM_MAX_HOURS,
  CUSTOM_MIN_HOURS,
  DEFAULT_FASTING_PLAN,
  FASTING_PROTOCOLS,
  type FastingPlan,
  fastingStats,
  nextWindow,
  overlaps,
  protocolHours,
  settledEnd,
  weekdayIndex,
} from "@/domain/fasting";
import { isMinor } from "@/domain/profile";

import { DomainError } from "./errors";
import { getProfile } from "./profile";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "invalid_time");

export const fastingPlanSchema = z.object({
  enabled: z.boolean(),
  autoStart: z.boolean(),
  customHours: z.number().int().min(CUSTOM_MIN_HOURS, "fasting_hours").max(CUSTOM_MAX_HOURS, "fasting_hours"),
  days: z.array(z.object({ protocol: z.enum(FASTING_PROTOCOLS), start: time }).nullable()).length(7),
});

/** Le jeûne intermittent n'est pas proposé avant 18 ans. */
async function assertAdult(userId: string): Promise<void> {
  const profile = await getProfile(userId);
  if (!profile || isMinor(profile.birthDate, todayIso())) throw new DomainError("fasting_minor");
}

export async function fastingAllowed(userId: string): Promise<boolean> {
  const profile = await getProfile(userId);
  return Boolean(profile && !isMinor(profile.birthDate, todayIso()));
}

export async function getFastingPlan(userId: string): Promise<FastingPlan> {
  const [row] = await db()
    .select({ plan: fastingPlans.plan })
    .from(fastingPlans)
    .where(eq(fastingPlans.userId, userId));
  return row?.plan ?? DEFAULT_FASTING_PLAN;
}

export async function saveFastingPlan(userId: string, input: z.input<typeof fastingPlanSchema>): Promise<void> {
  await assertAdult(userId);
  const plan = fastingPlanSchema.parse(input);
  await db()
    .insert(fastingPlans)
    .values({ userId, plan })
    .onConflictDoUpdate({ target: fastingPlans.userId, set: { plan, updatedAt: new Date() } });
}

type FastRow = typeof fasts.$inferSelect;

/**
 * Remet les jeûnes à jour à la lecture : referme ceux qui doivent l'être (fin automatique,
 * oubli) puis, en démarrage automatique, ouvre la fenêtre du planning en cours si rien ne la couvre.
 */
async function settle(userId: string, plan: FastingPlan, now: Date): Promise<void> {
  const open = await db()
    .select()
    .from(fasts)
    .where(and(eq(fasts.userId, userId), isNull(fasts.endedAt)));
  for (const fast of open) {
    const end = settledEnd(fast, now);
    if (end) await db().update(fasts).set({ endedAt: end }).where(eq(fasts.id, fast.id));
  }
  if (!plan.enabled || !plan.autoStart) return;
  const window = activeWindow(plan, now, todayIso(now), APP_TIMEZONE);
  if (!window) return;
  const recent = await db()
    .select({ startedAt: fasts.startedAt, endedAt: fasts.endedAt })
    .from(fasts)
    .where(eq(fasts.userId, userId))
    .orderBy(desc(fasts.startedAt))
    .limit(5);
  if (recent.some((fast) => overlaps({ start: fast.startedAt, end: fast.endedAt }, window))) return;
  await db()
    .insert(fasts)
    .values({
      userId,
      startedAt: window.start,
      targetMinutes: window.hours * 60,
      protocol: window.protocol,
      source: "auto",
    });
}

async function openFast(userId: string): Promise<FastRow | null> {
  const [row] = await db()
    .select()
    .from(fasts)
    .where(and(eq(fasts.userId, userId), isNull(fasts.endedAt)))
    .orderBy(desc(fasts.startedAt))
    .limit(1);
  return row ?? null;
}

/** Démarre un jeûne maintenant, avec le protocole du jour (ou 16:8 si le planning n'en prévoit pas). */
export async function startFast(userId: string, now: Date = new Date()): Promise<void> {
  await assertAdult(userId);
  if (await openFast(userId)) throw new DomainError("fast_running");
  const plan = await getFastingPlan(userId);
  const day = plan.days[weekdayIndex(todayIso(now))];
  const protocol = day?.protocol ?? "16:8";
  await db()
    .insert(fasts)
    .values({ userId, startedAt: now, targetMinutes: protocolHours(protocol, plan.customHours) * 60, protocol });
}

export async function endFast(userId: string, now: Date = new Date()): Promise<void> {
  const fast = await openFast(userId);
  if (!fast) throw new DomainError("not_found");
  await db().update(fasts).set({ endedAt: now }).where(eq(fasts.id, fast.id));
}

export async function deleteFast(userId: string, id: string): Promise<void> {
  await db()
    .delete(fasts)
    .where(and(eq(fasts.id, z.uuid().parse(id)), eq(fasts.userId, userId)));
}

export type FastingOverview = {
  allowed: boolean;
  plan: FastingPlan;
  current: {
    startedAt: string;
    targetMinutes: number;
    protocol: FastRow["protocol"];
    source: FastRow["source"];
  } | null;
  next: { start: string; hours: number } | null;
  history: { id: string; startedAt: string; endedAt: string; targetMinutes: number }[];
  stats: ReturnType<typeof fastingStats>;
};

export async function fastingOverview(userId: string, now: Date = new Date()): Promise<FastingOverview> {
  const [allowed, plan] = await Promise.all([fastingAllowed(userId), getFastingPlan(userId)]);
  if (allowed) await settle(userId, plan, now);
  const rows = await db().select().from(fasts).where(eq(fasts.userId, userId)).orderBy(desc(fasts.startedAt)).limit(30);
  const current = rows.find((row) => row.endedAt === null) ?? null;
  const upcoming = allowed ? nextWindow(plan, now, todayIso(now), APP_TIMEZONE) : null;
  return {
    allowed,
    plan,
    current: current
      ? {
          startedAt: current.startedAt.toISOString(),
          targetMinutes: current.targetMinutes,
          protocol: current.protocol,
          source: current.source,
        }
      : null,
    next: upcoming ? { start: upcoming.start.toISOString(), hours: upcoming.hours } : null,
    history: rows
      .filter((row): row is FastRow & { endedAt: Date } => row.endedAt !== null)
      .map((row) => ({
        id: row.id,
        startedAt: row.startedAt.toISOString(),
        endedAt: row.endedAt.toISOString(),
        targetMinutes: row.targetMinutes,
      })),
    stats: fastingStats(rows, now),
  };
}

/** Jeûne en cours, pour la carte de l'accueil (fenêtre automatique ouverte si besoin). */
export async function currentFast(
  userId: string,
  now: Date = new Date(),
): Promise<{ startedAt: string; targetMinutes: number } | null> {
  const plan = await getFastingPlan(userId);
  if (plan.enabled && (await fastingAllowed(userId))) await settle(userId, plan, now);
  const fast = await openFast(userId);
  return fast ? { startedAt: fast.startedAt.toISOString(), targetMinutes: fast.targetMinutes } : null;
}

export async function fastingExport(userId: string) {
  const [plan, rows] = await Promise.all([
    db().select().from(fastingPlans).where(eq(fastingPlans.userId, userId)),
    db().select().from(fasts).where(eq(fasts.userId, userId)).orderBy(asc(fasts.startedAt)),
  ]);
  return { plan: plan[0] ?? null, fasts: rows };
}
