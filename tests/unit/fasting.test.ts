import { describe, expect, it } from "vitest";

import {
  activeWindow,
  DEFAULT_FASTING_PLAN,
  fastEventsOn,
  type FastingPlan,
  fastingStats,
  fastProgress,
  nextWindow,
  overlaps,
  protocolHours,
  settledEnd,
  windowStarting,
  zonedInstant,
} from "@/domain/fasting";
import { DEFAULT_NOTIFICATION_PREFS, dueReminders, withDefaultPrefs } from "@/domain/notifications";

const TZ = "Europe/Paris";

/** Planning : 16:8 à 20 h tous les jours, sauf le dimanche (rien) et le samedi (perso 13 h à 22 h). */
const plan: FastingPlan = {
  ...DEFAULT_FASTING_PLAN,
  enabled: true,
  customHours: 13,
  days: [
    { protocol: "16:8", start: "20:00" },
    { protocol: "16:8", start: "20:00" },
    { protocol: "16:8", start: "20:00" },
    { protocol: "16:8", start: "20:00" },
    { protocol: "16:8", start: "20:00" },
    { protocol: "custom", start: "22:00" },
    null,
  ],
};

describe("protocoles et fuseau", () => {
  it("donne la durée de jeûne de chaque protocole", () => {
    expect(protocolHours("12:12", 15)).toBe(12);
    expect(protocolHours("18:6", 15)).toBe(18);
    expect(protocolHours("custom", 15)).toBe(15);
  });

  it("convertit une heure locale de Paris en instant, heure d'hiver comme d'été", () => {
    expect(zonedInstant("2026-01-15", "20:00", TZ).toISOString()).toBe("2026-01-15T19:00:00.000Z");
    expect(zonedInstant("2026-07-15", "20:00", TZ).toISOString()).toBe("2026-07-15T18:00:00.000Z");
    // Nuit du passage à l'heure d'hiver (25 octobre 2026).
    expect(zonedInstant("2026-10-25", "12:00", TZ).toISOString()).toBe("2026-10-25T11:00:00.000Z");
  });
});

describe("fenêtres du planning", () => {
  it("place la fenêtre du jour, et rien les jours sans jeûne", () => {
    // 2026-10-01 est un jeudi.
    const window = windowStarting(plan, "2026-10-01", TZ)!;
    expect(window.start.toISOString()).toBe("2026-10-01T18:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-10-02T10:00:00.000Z");
    expect(windowStarting(plan, "2026-10-04", TZ)).toBeNull();
    expect(windowStarting({ ...plan, enabled: false }, "2026-10-01", TZ)).toBeNull();
  });

  it("trouve la fenêtre en cours, même commencée la veille", () => {
    const morning = new Date("2026-10-02T07:00:00Z");
    expect(activeWindow(plan, morning, "2026-10-02", TZ)?.startDate).toBe("2026-10-01");
    expect(activeWindow(plan, new Date("2026-10-02T12:00:00Z"), "2026-10-02", TZ)).toBeNull();
    expect(nextWindow(plan, new Date("2026-10-02T12:00:00Z"), "2026-10-02", TZ)?.startDate).toBe("2026-10-02");
  });

  it("liste les débuts et fins de la journée pour les rappels", () => {
    // Vendredi : fin du jeûne de jeudi à 12 h, début à 20 h.
    expect(fastEventsOn(plan, "2026-10-02")).toEqual([
      { kind: "fast_end", time: "12:00", key: "2026-10-01:end" },
      { kind: "fast_start", time: "20:00", key: "2026-10-02:start" },
    ]);
    // Dimanche : seule la fin du jeûne perso de samedi (22 h + 13 h = 11 h).
    expect(fastEventsOn(plan, "2026-10-04")).toEqual([{ kind: "fast_end", time: "11:00", key: "2026-10-03:end" }]);
    // Une fenêtre qui finit le jour même (8 h → 20 h).
    const sameDay: FastingPlan = { ...plan, days: plan.days.map(() => ({ protocol: "12:12", start: "08:00" })) };
    expect(fastEventsOn(sameDay, "2026-10-02").map((event) => [event.kind, event.time])).toEqual([
      ["fast_start", "08:00"],
      ["fast_end", "20:00"],
    ]);
  });
});

describe("suivi d'un jeûne", () => {
  const start = new Date("2026-10-01T18:00:00Z");

  it("calcule le temps écoulé, restant et la progression", () => {
    const progress = fastProgress(start, null, 16 * 60, new Date("2026-10-02T04:30:00Z"));
    expect(progress).toMatchObject({ elapsedMinutes: 630, remainingMinutes: 330, reached: false });
    expect(progress.ratio).toBeCloseTo(630 / 960);
    expect(fastProgress(start, null, 960, new Date("2026-10-02T11:00:00Z"))).toMatchObject({ ratio: 1, reached: true });
  });

  it("referme un jeûne automatique à la fin prévue, et un jeûne manuel seulement s'il est oublié", () => {
    const auto = { startedAt: start, targetMinutes: 960, source: "auto" as const };
    expect(settledEnd(auto, new Date("2026-10-02T09:00:00Z"))).toBeNull();
    expect(settledEnd(auto, new Date("2026-10-02T11:00:00Z"))?.toISOString()).toBe("2026-10-02T10:00:00.000Z");
    const manual = { ...auto, source: "manual" as const };
    expect(settledEnd(manual, new Date("2026-10-02T15:00:00Z"))).toBeNull();
    expect(settledEnd(manual, new Date("2026-10-04T15:00:00Z"))?.toISOString()).toBe("2026-10-02T10:00:00.000Z");
  });

  it("détecte un chevauchement avec une fenêtre", () => {
    const window = { start, end: new Date("2026-10-02T10:00:00Z") };
    expect(overlaps({ start: new Date("2026-10-01T17:30:00Z"), end: null }, window)).toBe(true);
    expect(overlaps({ start: new Date("2026-10-01T08:00:00Z"), end: new Date("2026-10-01T18:00:00Z") }, window)).toBe(
      false,
    );
  });

  it("fait le bilan des jeûnes terminés", () => {
    const now = new Date("2026-10-05T12:00:00Z");
    const stats = fastingStats(
      [
        { startedAt: start, endedAt: new Date("2026-10-02T10:00:00Z"), targetMinutes: 960 },
        { startedAt: new Date("2026-10-03T18:00:00Z"), endedAt: new Date("2026-10-04T06:00:00Z"), targetMinutes: 960 },
        { startedAt: new Date("2026-10-05T08:00:00Z"), endedAt: null, targetMinutes: 960 },
      ],
      now,
    );
    expect(stats).toEqual({ completedLast7: 1, averageMinutes: 840, longestMinutes: 960 });
    expect(fastingStats([], now)).toEqual({ completedLast7: 0, averageMinutes: null, longestMinutes: null });
  });
});

describe("rappels de jeûne et de traitement", () => {
  const base = {
    date: "2026-10-02",
    weekday: 5,
    weekStart: "2026-09-28",
    prefs: DEFAULT_NOTIFICATION_PREFS,
    mealTimes: { breakfast: "07:30", lunch: "12:30", dinner: "20:00" },
    loggedSlots: new Set(["breakfast", "lunch", "dinner"]),
    waterGlasses: 8,
    waterGoal: 8,
    reviewReady: false,
    fastEvents: fastEventsOn(plan, "2026-10-02"),
    treatments: [
      { id: "t1", name: "Injection", time: "09:00", taken: false },
      { id: "t2", name: "Comprimé", time: "09:00", taken: true },
    ],
  };

  it("envoie le début et la fin de jeûne dans l'heure qui suit", () => {
    expect(dueReminders({ ...base, time: "12:20" })).toEqual([{ kind: "fast_end", key: "2026-10-01:end" }]);
    expect(dueReminders({ ...base, time: "20:05" })).toEqual([{ kind: "fast_start", key: "2026-10-02:start" }]);
    expect(dueReminders({ ...base, time: "21:30" })).toEqual([]);
  });

  it("rappelle un traitement non noté, jamais celui déjà pris", () => {
    expect(dueReminders({ ...base, time: "09:10" })).toEqual([
      { kind: "treatment", key: "2026-10-02:t1", name: "Injection" },
    ]);
  });

  it("respecte les préférences et complète celles enregistrées avant ces rappels", () => {
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, fasting: false, treatment: false };
    expect(dueReminders({ ...base, prefs, time: "09:10" })).toEqual([]);
    expect(dueReminders({ ...base, prefs, time: "12:20" })).toEqual([]);
    const old = { meals: false, water: true, weeklyReview: true, quietStart: "22:00", quietEnd: "07:30" };
    expect(withDefaultPrefs(old)).toEqual({ ...old, fasting: true, treatment: true });
  });
});
