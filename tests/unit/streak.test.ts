import { describe, expect, it } from "vitest";

import { addDays } from "@/domain/energy";
import { streakCalendar, streakStats } from "@/domain/streak";

/** Jours de `from` à `to` inclus, sauf ceux de `skip`. */
function range(from: string, to: string, skip: string[] = []): string[] {
  const out: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) if (!skip.includes(day)) out.push(day);
  return out;
}

describe("streakStats", () => {
  it("garde la meilleure série et ses étapes après une série cassée", () => {
    // 23 jours du 11/09 au 03/10, deux jours manqués (04 et 05/10), puis une série depuis le 06/10
    // avec le mardi 13 couvert par un gel.
    const logged = new Set([
      ...range("2026-09-11", "2026-10-03"),
      ...range("2026-10-06", "2026-10-18", ["2026-10-13"]),
    ]);
    const stats = streakStats(logged, "2026-10-18");
    expect(stats.current).toEqual({ days: 12, frozenDays: ["2026-10-13"] });
    expect(stats.best).toBe(23);
    expect(stats.totalDays).toBe(35);
    expect(stats.steps).toEqual([
      { days: 3, reachedOn: "2026-09-13" },
      { days: 7, reachedOn: "2026-09-17" },
      { days: 14, reachedOn: "2026-09-24" },
      { days: 21, reachedOn: "2026-10-01" },
    ]);
    expect(stats.next).toEqual({ days: 30, remaining: 18 });
    expect(stats.restDays).toEqual(["2026-10-13"]);
  });

  it("compte les étapes d'une série couverte par des gels", () => {
    // Une semaine avec un jour manqué : 6 jours saisis, la 7e étape tombe le jour suivant.
    const logged = new Set(range("2026-10-05", "2026-10-12", ["2026-10-07"]));
    const stats = streakStats(logged, "2026-10-12");
    expect(stats.current.days).toBe(7);
    expect(stats.steps.map((step) => step.reachedOn)).toEqual(["2026-10-08", "2026-10-12"]);
  });

  it("démarre sans rien quand aucun repas n'est saisi", () => {
    expect(streakStats(new Set(), "2026-10-18")).toEqual({
      current: { days: 0, frozenDays: [] },
      best: 0,
      totalDays: 0,
      steps: [],
      next: { days: 3, remaining: 3 },
      restDays: [],
    });
  });

  it("ignore les jours après aujourd'hui", () => {
    expect(streakStats(new Set(["2026-10-18", "2026-10-19"]), "2026-10-18").totalDays).toBe(1);
  });

  it("n'a plus d'étape suivante après un an", () => {
    const logged = new Set(range("2025-10-01", "2026-10-18"));
    expect(streakStats(logged, "2026-10-18").next).toBeNull();
  });
});

describe("streakCalendar", () => {
  it("affiche 5 semaines du lundi au dimanche, jusqu'à aujourd'hui", () => {
    const days = streakCalendar(new Set(["2026-10-14"]), ["2026-10-13"], "2026-10-15");
    expect(days).toHaveLength(35);
    expect(days[0]?.date).toBe("2026-09-14");
    expect(days.at(-1)?.date).toBe("2026-10-18");
    const state = (date: string) => days.find((day) => day.date === date)?.state;
    expect(state("2026-10-13")).toBe("rest");
    expect(state("2026-10-14")).toBe("logged");
    expect(state("2026-10-15")).toBe("empty");
    expect(state("2026-10-16")).toBe("future");
  });
});
