import { describe, expect, it } from "vitest";

import { markKind, progressMarks, suiviLine } from "@/domain/training/progress";

const set = (reps: number | null, weightKg: number | null, seconds: number | null) => ({ reps, weightKg, seconds });

describe("progressMarks", () => {
  const sessions = [
    // Ordre quelconque : le calcul remet les séances dans l'ordre chronologique.
    {
      date: "2026-11-05",
      items: [
        { exerciseId: "planche", sets: [set(null, null, 50)] },
        { exerciseId: "squat-gobelet", sets: [set(10, 8, null)] },
      ],
    },
    {
      date: "2026-11-01",
      items: [
        { exerciseId: "planche", sets: [set(null, null, 30), set(null, null, 35)] },
        { exerciseId: "squat-gobelet", sets: [set(12, 6, null)] },
        { exerciseId: "pompes", sets: [set(12, null, null)] },
      ],
    },
  ];

  it("suit chaque exercice dans sa propre unité, la charge d'abord", () => {
    const marks = progressMarks(sessions);
    const byId = Object.fromEntries(marks.map((mark) => [mark.exerciseId, mark]));
    expect(byId.planche).toMatchObject({ unit: "seconds", points: [35, 50], first: 35, best: 50 });
    expect(byId["squat-gobelet"]).toMatchObject({ unit: "kg", points: [6, 8], first: 6, best: 8 });
    expect(byId.pompes).toMatchObject({ unit: "reps", points: [12], first: 12, best: 12 });
  });

  it("met en tête ce qui a le plus progressé", () => {
    expect(progressMarks(sessions).map((mark) => mark.exerciseId)).toEqual(["planche", "squat-gobelet", "pompes"]);
  });

  it("peut écarter des exercices (échauffement, retour au calme)", () => {
    expect(progressMarks(sessions, (id) => id !== "planche").map((mark) => mark.exerciseId)).not.toContain("planche");
  });
});

describe("suiviLine", () => {
  it("parle de progrès quand il y en a, sinon de régularité", () => {
    expect(suiviLine(0, [])).toEqual({ key: "none" });
    const flat = {
      exerciseId: "pompes",
      unit: "reps" as const,
      points: [12],
      first: 12,
      best: 12,
      lastDate: "2026-11-01",
    };
    expect(suiviLine(1, [flat])).toEqual({ key: "steady", sessions: 1 });
    const up = { ...flat, points: [12, 14], best: 14 };
    expect(suiviLine(2, [up])).toEqual({ key: "progress", mark: up });
  });
});

describe("markKind", () => {
  it("range chaque groupe dans une famille", () => {
    expect(markKind("core")).toBe("core");
    expect(markKind("legs")).toBe("strength");
    expect(markKind("cardio")).toBe("cardio");
    expect(markKind("mobility")).toBe("mobility");
  });
});
