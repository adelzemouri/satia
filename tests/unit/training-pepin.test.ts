import { describe, expect, it } from "vitest";

import { dayIndex, fallbackTitleIndex, homeLine, sessionHighlights, TODAY_VARIANTS } from "@/domain/training/pepin";

const week = [{ day: 0 }, { day: 2 }, { day: 4 }];

describe("homeLine", () => {
  it("rassure avant la toute première séance", () => {
    expect(homeLine({ date: "2026-11-09", today: 0, doneToday: false, everTrained: false, sessions: week })).toEqual({
      key: "first",
    });
  });

  it("annonce le jour de la première séance quand aujourd'hui est un jour de repos", () => {
    expect(homeLine({ date: "2026-11-10", today: 1, doneToday: false, everTrained: false, sessions: week })).toEqual({
      key: "firstLater",
      day: 2,
    });
  });

  it("félicite une fois la séance du jour faite", () => {
    expect(homeLine({ date: "2026-11-09", today: 0, doneToday: true, everTrained: true, sessions: week }).key).toBe(
      "done",
    );
  });

  it("donne la prochaine séance un jour de repos, ou rien en fin de semaine", () => {
    expect(homeLine({ date: "2026-11-12", today: 3, doneToday: false, everTrained: true, sessions: week })).toEqual({
      key: "rest",
      next: 4,
    });
    expect(homeLine({ date: "2026-11-15", today: 6, doneToday: false, everTrained: true, sessions: week })).toEqual({
      key: "rest",
      next: null,
    });
  });

  it("varie la phrase du jour d'une date à l'autre", () => {
    const line = homeLine({ date: "2026-11-09", today: 0, doneToday: false, everTrained: true, sessions: week });
    expect(line.key).toBe("today");
    const variants = new Set(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"].map((d) => dayIndex(d, 4)));
    expect(variants.size).toBe(TODAY_VARIANTS);
  });
});

describe("fallbackTitleIndex", () => {
  it("reste dans les titres écrits à l'avance", () => {
    expect([null, 0, 1, 2, 3, 6].map(fallbackTitleIndex)).toEqual([0, 0, 1, 2, 0, 0]);
  });
});

describe("sessionHighlights", () => {
  const set = (reps: number | null, weightKg: number | null, seconds: number | null) => ({ reps, weightKg, seconds });

  it("donne chaque exercice dans sa propre unité, premiers repères compris", () => {
    const highlights = sessionHighlights(
      [
        { exerciseId: "planche", sets: [set(null, null, 30), set(null, null, 35)] },
        { exerciseId: "pompes", sets: [set(10, null, null), set(12, null, null)] },
        { exerciseId: "squat-gobelet", sets: [set(10, 8, null)] },
      ],
      [],
    );
    expect(highlights).toEqual([
      { exerciseId: "planche", unit: "seconds", value: 35, previous: null },
      { exerciseId: "pompes", unit: "reps", value: 12, previous: null },
      { exerciseId: "squat-gobelet", unit: "kg", value: 8, previous: null },
    ]);
  });

  it("met en avant ce qui progresse et tait ce qui n'a pas bougé", () => {
    const highlights = sessionHighlights(
      [
        { exerciseId: "planche", sets: [set(null, null, 50)] },
        { exerciseId: "pompes", sets: [set(12, null, null)] },
        { exerciseId: "fentes", sets: [set(8, null, null)] },
      ],
      [
        { exerciseId: "planche", maxWeightKg: null, maxReps: null, maxSeconds: 35 },
        { exerciseId: "pompes", maxWeightKg: null, maxReps: 14, maxSeconds: null },
      ],
    );
    expect(highlights).toEqual([
      { exerciseId: "planche", unit: "seconds", value: 50, previous: 35 },
      { exerciseId: "fentes", unit: "reps", value: 8, previous: null },
    ]);
  });

  it("s'arrête à trois repères", () => {
    const logged = ["a", "b", "c", "d"].map((exerciseId) => ({ exerciseId, sets: [set(5, null, null)] }));
    expect(sessionHighlights(logged, [])).toHaveLength(3);
  });
});
