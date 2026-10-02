/** Jeûne intermittent (calcul pur) : protocoles, planning par jour, fenêtres et suivi. */

import { addDays } from "./energy";

export const FASTING_PROTOCOLS = ["12:12", "14:10", "16:8", "18:6", "custom"] as const;
export type FastingProtocol = (typeof FASTING_PROTOCOLS)[number];

/** Durée de jeûne des protocoles standards, en heures. */
const PROTOCOL_HOURS: Record<Exclude<FastingProtocol, "custom">, number> = {
  "12:12": 12,
  "14:10": 14,
  "16:8": 16,
  "18:6": 18,
};

/** Bornes du protocole personnalisé : au-delà de 20 h, on sort du jeûne intermittent du quotidien. */
export const CUSTOM_MIN_HOURS = 12;
export const CUSTOM_MAX_HOURS = 20;

/** Jour du planning : protocole et heure de début du jeûne (« HH:MM »), ou rien ce jour-là. */
export type FastingDay = { protocol: FastingProtocol; start: string } | null;

export type FastingPlan = {
  enabled: boolean;
  /** La fenêtre de jeûne démarre seule à l'heure prévue, et se termine seule à la fin prévue. */
  autoStart: boolean;
  customHours: number;
  /** Sept jours, 0 = lundi. */
  days: FastingDay[];
};

export const DEFAULT_FASTING_PLAN: FastingPlan = {
  enabled: false,
  autoStart: true,
  customHours: 15,
  days: Array.from({ length: 7 }, () => ({ protocol: "14:10", start: "20:00" })),
};

/** Au-delà de ce temps, un jeûne resté ouvert est considéré comme oublié et refermé à son objectif. */
export const FORGOTTEN_FAST_HOURS = 48;

export function protocolHours(protocol: FastingProtocol, customHours: number): number {
  return protocol === "custom" ? customHours : PROTOCOL_HOURS[protocol];
}

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours! * 60 + minutes!;
}

function timeOf(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

/** Jour de la semaine d'une date ISO, 0 = lundi. */
export function weekdayIndex(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/** Décalage (ms) entre l'heure locale d'un fuseau et l'UTC à un instant donné. */
function zoneOffset(instant: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(instant))
      .map((part) => [part.type, part.value]),
  );
  const local = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return local - Math.floor(instant / 1000) * 1000;
}

/** Instant correspondant à une date et une heure locales dans un fuseau (heure d'été comprise). */
export function zonedInstant(date: string, time: string, timeZone: string): Date {
  const wall = Date.parse(`${date}T${time}:00Z`);
  let instant = wall - zoneOffset(wall, timeZone);
  instant = wall - zoneOffset(instant, timeZone);
  return new Date(instant);
}

export type FastingWindow = { start: Date; end: Date; hours: number; protocol: FastingProtocol; startDate: string };

/** Fenêtre de jeûne qui commence le jour donné, d'après le planning. */
export function windowStarting(plan: FastingPlan, date: string, timeZone: string): FastingWindow | null {
  const day = plan.days[weekdayIndex(date)];
  if (!plan.enabled || !day) return null;
  const hours = protocolHours(day.protocol, plan.customHours);
  const start = zonedInstant(date, day.start, timeZone);
  return { start, end: new Date(start.getTime() + hours * 3_600_000), hours, protocol: day.protocol, startDate: date };
}

/** Fenêtre de jeûne en cours à cet instant (commencée aujourd'hui ou la veille), sinon null. */
export function activeWindow(plan: FastingPlan, now: Date, today: string, timeZone: string): FastingWindow | null {
  for (const date of [today, addDays(today, -1)]) {
    const window = windowStarting(plan, date, timeZone);
    if (window && window.start <= now && now < window.end) return window;
  }
  return null;
}

/** Prochaine fenêtre à venir (dans les 8 jours), pour l'afficher quand aucun jeûne n'est en cours. */
export function nextWindow(plan: FastingPlan, now: Date, today: string, timeZone: string): FastingWindow | null {
  for (let offset = 0; offset < 8; offset++) {
    const window = windowStarting(plan, addDays(today, offset), timeZone);
    if (window && window.start > now) return window;
  }
  return null;
}

/** Débuts et fins de jeûne prévus dans la journée locale (pour les rappels), à l'heure locale. */
export function fastEventsOn(
  plan: FastingPlan,
  date: string,
): { kind: "fast_start" | "fast_end"; time: string; key: string }[] {
  if (!plan.enabled) return [];
  const events: { kind: "fast_start" | "fast_end"; time: string; key: string }[] = [];
  const yesterday = addDays(date, -1);
  for (const [startDate, dayOffset] of [
    [yesterday, -1],
    [date, 0],
  ] as const) {
    const day = plan.days[weekdayIndex(startDate)];
    if (!day) continue;
    const startMinutes = minutesOf(day.start);
    if (dayOffset === 0) events.push({ kind: "fast_start", time: day.start, key: `${startDate}:start` });
    const endMinutes = startMinutes + protocolHours(day.protocol, plan.customHours) * 60;
    // La fin tombe aujourd'hui si elle dépasse minuit pour une fenêtre d'hier, ou non pour une d'aujourd'hui.
    if (Math.floor(endMinutes / 1440) + dayOffset === 0) {
      events.push({ kind: "fast_end", time: timeOf(endMinutes), key: `${startDate}:end` });
    }
  }
  return events.sort((a, b) => a.time.localeCompare(b.time));
}

export type FastProgress = {
  elapsedMinutes: number;
  targetMinutes: number;
  remainingMinutes: number;
  /** Part de l'objectif atteinte, bornée à 1. */
  ratio: number;
  reached: boolean;
};

export function fastProgress(startedAt: Date, endedAt: Date | null, targetMinutes: number, now: Date): FastProgress {
  const end = endedAt ?? now;
  const elapsedMinutes = Math.max(0, Math.floor((end.getTime() - startedAt.getTime()) / 60_000));
  return {
    elapsedMinutes,
    targetMinutes,
    remainingMinutes: Math.max(0, targetMinutes - elapsedMinutes),
    ratio: targetMinutes > 0 ? Math.min(1, elapsedMinutes / targetMinutes) : 0,
    reached: elapsedMinutes >= targetMinutes,
  };
}

/**
 * Fin à enregistrer pour un jeûne resté ouvert : un jeûne automatique s'arrête à la fin prévue ;
 * un jeûne manuel oublié plus de 48 h est refermé à son objectif. Sinon, il continue (null).
 */
export function settledEnd(
  fast: { startedAt: Date; targetMinutes: number; source: "manual" | "auto" },
  now: Date,
): Date | null {
  const plannedEnd = new Date(fast.startedAt.getTime() + fast.targetMinutes * 60_000);
  if (fast.source === "auto" && now >= plannedEnd) return plannedEnd;
  if (now.getTime() - fast.startedAt.getTime() > FORGOTTEN_FAST_HOURS * 3_600_000) return plannedEnd;
  return null;
}

/** Deux intervalles [début, fin[ se chevauchent-ils ? (fin null = toujours en cours). */
export function overlaps(a: { start: Date; end: Date | null }, b: { start: Date; end: Date }): boolean {
  return a.start < b.end && (a.end === null || a.end > b.start);
}

export type FastingStats = { completedLast7: number; averageMinutes: number | null; longestMinutes: number | null };

/** Bilan des jeûnes terminés : objectifs atteints sur 7 jours, durée moyenne et record (30 derniers). */
export function fastingStats(
  fasts: readonly { startedAt: Date; endedAt: Date | null; targetMinutes: number }[],
  now: Date,
): FastingStats {
  const done = fasts.filter((fast): fast is typeof fast & { endedAt: Date } => fast.endedAt !== null);
  const durations = done.map((fast) => Math.floor((fast.endedAt.getTime() - fast.startedAt.getTime()) / 60_000));
  const weekAgo = now.getTime() - 7 * 86_400_000;
  return {
    completedLast7: done.filter(
      (fast, index) => fast.endedAt.getTime() >= weekAgo && durations[index]! >= fast.targetMinutes,
    ).length,
    averageMinutes: durations.length ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length) : null,
    longestMinutes: durations.length ? Math.max(...durations) : null,
  };
}
