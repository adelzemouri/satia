import { describe, expect, it } from "vitest";

import { workoutRequest } from "@/domain/coach";
import { EXERCISES, exerciseById } from "@/domain/training/exercises";
import {
  allowedExercises,
  burnedKcal,
  buildSession,
  expressSession,
  nextProgression,
  personalRecords,
  sessionMet,
  sessionSeconds,
  trainingDayGoal,
  trainingStreak,
  volumeByMuscle,
  weeklyProgram,
  weeklySplit,
} from "@/domain/training/program";
import { EQUIPMENT, MUSCLES, type TrainingProfile, ZONES } from "@/domain/training/types";

const profile: TrainingProfile = {
  level: "beginner",
  goal: "strength",
  place: "home_none",
  equipment: [],
  days: [0, 2, 4],
  minutes: 30,
  avoidZones: [],
  excluded: [],
};

describe("bibliothèque d'exercices", () => {
  it("compte 80 à 120 exercices complets et cohérents", () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(80);
    expect(EXERCISES.length).toBeLessThanOrEqual(120);
    expect(new Set(EXERCISES.map((exercise) => exercise.id)).size).toBe(EXERCISES.length);
    for (const exercise of EXERCISES) {
      expect(exercise.id).toMatch(/^[a-z0-9-]+$/);
      expect(exercise.steps.length, exercise.id).toBeGreaterThanOrEqual(3);
      expect(exercise.steps.length, exercise.id).toBeLessThanOrEqual(5);
      expect(exercise.mistakes.length, exercise.id).toBeGreaterThanOrEqual(1);
      expect(exercise.easier.length, exercise.id).toBeGreaterThan(5);
      expect(exercise.met).toBeGreaterThan(1);
      expect(MUSCLES).toContain(exercise.muscle);
      for (const item of exercise.equipment) expect(EQUIPMENT).toContain(item);
      for (const zone of exercise.stress) expect(ZONES).toContain(zone);
    }
  });

  it("n'emploie jamais de vocabulaire culpabilisant", () => {
    const text = JSON.stringify(EXERCISES).toLowerCase();
    // « écart » comme nom (pas le verbe « écarter »).
    for (const word of ["craquage", "triche", "écarts?", "punition"]) {
      expect(text).not.toMatch(new RegExp(`(^|[^a-zà-ÿ])${word}([^a-zà-ÿ]|$)`));
    }
  });
});

describe("exercices permis", () => {
  it("respecte le matériel, le niveau, les zones à ménager et les exercices signalés", () => {
    const allowed = allowedExercises({ ...profile, avoidZones: ["knees"], excluded: ["pont-fessier"] });
    expect(allowed.length).toBeGreaterThan(20);
    for (const exercise of allowed) {
      expect(exercise.equipment).toEqual([]);
      expect(exercise.level).toBe(1);
      expect(exercise.stress).not.toContain("knees");
    }
    expect(allowed.map((exercise) => exercise.id)).not.toContain("pont-fessier");

    const gym = allowedExercises({ ...profile, level: "advanced", place: "gym" });
    expect(gym.some((exercise) => exercise.equipment.includes("machines"))).toBe(true);
    const home = allowedExercises({ ...profile, place: "home_equipped", equipment: ["dumbbells"] });
    expect(home.some((exercise) => exercise.equipment.includes("dumbbells"))).toBe(true);
    expect(home.some((exercise) => exercise.equipment.includes("bands"))).toBe(false);
  });
});

describe("programme de la semaine", () => {
  it("alterne les groupes selon l'objectif et le nombre de jours", () => {
    expect(weeklySplit("strength", 3)).toEqual(["upper", "lower", "full_body"]);
    expect(weeklySplit("muscle", 4)).toEqual(["upper", "lower", "upper", "lower"]);
    expect(weeklySplit("endurance", 2)).toEqual(["cardio", "full_body"]);
    expect(weeklySplit("mobility", 1)).toEqual(["mobility"]);
  });

  it("place une séance par jour disponible, avec échauffement et retour au calme, dans la durée", () => {
    const program = weeklyProgram(profile, "u:2026-10-05");
    expect(program.map((session) => session.day)).toEqual([0, 2, 4]);
    for (const session of program) {
      expect(session.warmup.length).toBe(3);
      expect(session.cooldown.length).toBe(3);
      expect(session.main.length).toBeGreaterThanOrEqual(2);
      expect(sessionSeconds(session)).toBeLessThanOrEqual(30 * 60 + 120);
      for (const item of session.warmup) expect(exerciseById(item.exerciseId)?.phase).toBe("warmup");
      for (const item of session.cooldown) expect(exerciseById(item.exerciseId)?.phase).toBe("cooldown");
    }
    // Reproductible.
    expect(weeklyProgram(profile, "u:2026-10-05")).toEqual(program);
  });

  it("adapte la séance du haut du corps et propose une autre séance pour « Remplacer »", () => {
    const upper = buildSession({ profile, focus: "upper", minutes: 45, seed: "a", day: 0 });
    for (const item of upper.main) {
      expect(["chest", "back", "shoulders", "arms", "core"]).toContain(exerciseById(item.exerciseId)?.muscle);
    }
    const replacement = buildSession({
      profile,
      focus: "upper",
      minutes: 45,
      seed: "a:1",
      day: 0,
      avoid: upper.main.map((item) => item.exerciseId),
    });
    expect(replacement.main.map((item) => item.exerciseId)).not.toEqual(upper.main.map((item) => item.exerciseId));
    expect(Math.abs(sessionSeconds(replacement) - sessionSeconds(upper))).toBeLessThan(10 * 60);
  });

  it("une séance de mobilité ne contient que des étirements et mouvements doux", () => {
    const session = buildSession({
      profile: { ...profile, goal: "mobility" },
      focus: "mobility",
      minutes: 30,
      seed: "m",
      day: 1,
    });
    for (const item of session.main) expect(exerciseById(item.exerciseId)?.muscle).toBe("mobility");
    const ids = [...session.warmup, ...session.main, ...session.cooldown].map((item) => item.exerciseId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("la séance express tient en une dizaine de minutes", () => {
    const express = expressSession(profile, "x");
    expect(express.main).toHaveLength(3);
    expect(express.warmup).toHaveLength(2);
    expect(express.cooldown).toHaveLength(2);
    expect(sessionSeconds(express)).toBeLessThanOrEqual(12 * 60);
  });

  it("la progression suit le ressenti, par petits pas et dans des bornes", () => {
    expect(nextProgression(1, "easy")).toBe(1.1);
    expect(nextProgression(1, "good")).toBe(1.03);
    expect(nextProgression(1, "hard")).toBe(0.9);
    expect(nextProgression(1.48, "easy")).toBe(1.5);
    expect(nextProgression(0.72, "hard")).toBe(0.7);
    const base = buildSession({ profile, focus: "lower", minutes: 30, seed: "p", day: 0 });
    const harder = buildSession({ profile, focus: "lower", minutes: 30, seed: "p", day: 0, progression: 1.3 });
    const first = base.main[0]!;
    const progressed = harder.main[0]!;
    expect(progressed.sets).toBe(first.sets + 1);
    expect((progressed.reps ?? progressed.seconds)!).toBeGreaterThan((first.reps ?? first.seconds)!);
  });
});

describe("dépense et nutrition", () => {
  it("estime les calories avec MET × poids × durée", () => {
    expect(burnedKcal(5, 80, 30)).toBe(200);
    const met = sessionMet(buildSession({ profile, focus: "full_body", minutes: 30, seed: "k", day: 0 }));
    expect(met).toBeGreaterThan(2);
    expect(met).toBeLessThan(6);
  });

  it("relève le budget et les protéines les jours d'entraînement", () => {
    const goal = { kcal: 2000, proteinG: 120, carbsG: 220, fatG: 70 };
    expect(trainingDayGoal(goal, 0, false)).toBe(goal);
    const day = trainingDayGoal(goal, 200, true);
    expect(day.kcal).toBe(2200);
    expect(day.proteinG).toBe(132);
    expect(Math.abs(day.proteinG * 4 + day.carbsG * 4 + day.fatG * 9 - 2200)).toBeLessThan(15);
    expect(day.carbsG / day.fatG).toBeCloseTo(220 / 70, 1);
  });
});

describe("suivi", () => {
  it("compte les semaines consécutives avec au moins une séance", () => {
    const weeks = new Set(["2026-09-14", "2026-09-21", "2026-09-28"]);
    expect(trainingStreak(weeks, "2026-09-28")).toBe(3);
    expect(trainingStreak(weeks, "2026-10-05")).toBe(3);
    expect(trainingStreak(weeks, "2026-10-12")).toBe(0);
  });

  it("calcule records et volume par groupe musculaire", () => {
    const sessions = [
      {
        items: [
          {
            exerciseId: "squat",
            sets: [
              { reps: 10, weightKg: null, seconds: null },
              { reps: 12, weightKg: null, seconds: null },
            ],
          },
          { exerciseId: "planche", sets: [{ reps: null, weightKg: null, seconds: 40 }] },
        ],
      },
      { items: [{ exerciseId: "curl-halteres", sets: [{ reps: 8, weightKg: 8, seconds: null }] }] },
    ];
    expect(personalRecords(sessions)).toEqual([
      { exerciseId: "squat", maxWeightKg: null, maxReps: 12, maxSeconds: null },
      { exerciseId: "planche", maxWeightKg: null, maxReps: null, maxSeconds: 40 },
      { exerciseId: "curl-halteres", maxWeightKg: 8, maxReps: 8, maxSeconds: null },
    ]);
    expect(volumeByMuscle(sessions)).toEqual({ legs: 2, core: 1, arms: 1 });
  });
});

describe("séance demandée au coach", () => {
  it("repère la durée et l'absence de matériel", () => {
    expect(workoutRequest("J'ai 20 minutes, pas de matériel, une séance ?")).toEqual({
      minutes: 20,
      noEquipment: true,
    });
    expect(workoutRequest("Un entraînement de 90 min")).toEqual({ minutes: 60, noEquipment: false });
    expect(workoutRequest("Une idée de séance sans matériel")).toEqual({ minutes: 20, noEquipment: true });
    expect(workoutRequest("Que manger ce soir ?")).toBeNull();
  });
});
