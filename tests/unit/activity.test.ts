import { describe, expect, it } from "vitest";

import {
  ACTIVITY_METS,
  ACTIVITY_TYPES,
  activityKcal,
  INTENSITIES,
  measurementChanges,
  STEP_BASELINES,
  stepsKcal,
} from "@/domain/activity";
import {
  IMPORT_MAX_ROWS,
  mapActivityType,
  parseActivityCsv,
  parseDuration,
  parseImportDate,
  splitCsvLine,
} from "@/domain/activity-import";
import { trainingDayGoal } from "@/domain/training/program";

const TODAY = "2026-10-02";

describe("calories des activités", () => {
  it("applique MET × poids × durée", () => {
    // Marche modérée 3,5 MET, 70 kg, 60 min → 245 kcal.
    expect(activityKcal("walking", "moderate", 70, 60)).toBe(245);
    expect(activityKcal("running", "vigorous", 60, 30)).toBe(345);
  });

  it("a des MET croissants avec l'intensité pour chaque activité", () => {
    for (const type of ACTIVITY_TYPES) {
      const mets = INTENSITIES.map((intensity) => ACTIVITY_METS[type][intensity]);
      expect(mets[0]).toBeLessThan(mets[1]!);
      expect(mets[1]).toBeLessThan(mets[2]!);
      expect(mets[0]).toBeGreaterThan(1);
    }
  });
});

describe("calories des pas", () => {
  it("ne compte que les pas au-delà du seuil du niveau d'activité", () => {
    expect(stepsKcal(4000, 70, 2)).toBe(0);
    expect(stepsKcal(STEP_BASELINES[2], 70, 2)).toBe(0);
    // 5 000 pas de plus × 0,0005 × 70 kg = 175 kcal.
    expect(stepsKcal(10_000, 70, 2)).toBe(175);
    expect(stepsKcal(10_000, 70, 4)).toBe(0);
  });

  it("augmente l'objectif du jour et les macros, sans relever les protéines hors entraînement", () => {
    const goal = trainingDayGoal({ kcal: 1800, proteinG: 100, carbsG: 200, fatG: 60 }, 175, false);
    expect(goal.kcal).toBe(1975);
    expect(goal.proteinG).toBe(100);
    expect(goal.carbsG).toBeGreaterThan(200);
    expect(goal.fatG).toBeGreaterThan(60);
  });
});

describe("mensurations", () => {
  it("donne la première, la dernière valeur et l'évolution par tour", () => {
    const changes = measurementChanges([
      { date: "2026-09-20", kind: "waist", valueCm: 90 },
      { date: "2026-09-01", kind: "waist", valueCm: 92.5 },
      { date: "2026-09-10", kind: "hips", valueCm: 100 },
    ]);
    expect(changes).toEqual([
      { kind: "waist", first: 92.5, latest: 90, latestDate: "2026-09-20", change: -2.5 },
      { kind: "hips", first: 100, latest: 100, latestDate: "2026-09-10", change: 0 },
    ]);
  });
});

describe("import CSV", () => {
  it("lit les formats de date courants et refuse les dates impossibles", () => {
    expect(parseImportDate("2026-09-30")).toBe("2026-09-30");
    expect(parseImportDate("2026-09-30T07:15:00+02:00")).toBe("2026-09-30");
    expect(parseImportDate("2026/9/3 08:00")).toBe("2026-09-03");
    expect(parseImportDate("30/09/2026")).toBe("2026-09-30");
    expect(parseImportDate("3.9.2026")).toBe("2026-09-03");
    expect(parseImportDate("31/02/2026")).toBeNull();
    expect(parseImportDate("hier")).toBeNull();
  });

  it("lit les durées en minutes, secondes ou h:mm:ss", () => {
    expect(parseDuration("45", "min")).toBe(45);
    expect(parseDuration("2700", "s")).toBe(45);
    expect(parseDuration("2700000", "ms")).toBe(45);
    expect(parseDuration("0,5", "h")).toBe(30);
    expect(parseDuration("01:15:00", "min")).toBe(75);
    expect(parseDuration("32:30", "min")).toBe(32.5);
    expect(parseDuration("", "min")).toBeNull();
  });

  it("découpe les lignes en respectant les guillemets", () => {
    expect(splitCsvLine('2026-09-30,"Course, fractionné",30', ",")).toEqual(["2026-09-30", "Course, fractionné", "30"]);
    expect(splitCsvLine('a;"dit ""bonjour""";c', ";")).toEqual(["a", 'dit "bonjour"', "c"]);
  });

  it("reconnaît les types d'activité en français et en anglais", () => {
    expect(mapActivityType("Course à pied")).toBe("running");
    expect(mapActivityType("Footing")).toBe("running");
    expect(mapActivityType("Walking")).toBe("walking");
    expect(mapActivityType("Randonnée")).toBe("hiking");
    expect(mapActivityType("Vélo")).toBe("cycling");
    expect(mapActivityType("Natation")).toBe("swimming");
    expect(mapActivityType("Tennis")).toBe("racket_sport");
    expect(mapActivityType("Musculation")).toBe("strength");
    expect(mapActivityType("Kitesurf")).toBe("other");
  });

  it("additionne les pas par jour (export point-virgule, en-têtes français)", () => {
    const csv = "﻿Date;Nombre de pas\n30/09/2026;4 200\n30/09/2026;3 800\n01/10/2026;9500\n";
    const parsed = parseActivityCsv(csv, TODAY);
    expect([...parsed.steps]).toEqual([
      ["2026-09-30", 8000],
      ["2026-10-01", 9500],
    ]);
    expect(parsed.activities).toEqual([]);
    expect(parsed.skipped).toBe(0);
  });

  it("lit les activités avec une durée en secondes et ignore les lignes inutilisables", () => {
    const csv = [
      "Start date,Activity type,Duration (s)",
      "2026-09-29T18:00:00Z,Running,1800",
      "2026-09-30 07:00,Yoga,2700",
      "pas une date,Running,1800",
      "2026-09-30,Cycling,",
      "2030-01-01,Running,1800",
    ].join("\r\n");
    const parsed = parseActivityCsv(csv, TODAY);
    expect(parsed.activities).toEqual([
      { date: "2026-09-29", type: "running", durationMin: 30 },
      { date: "2026-09-30", type: "yoga", durationMin: 45 },
    ]);
    expect(parsed.skipped).toBe(3);
  });

  it("n'interprète pas les « move minutes » comme des séances", () => {
    const parsed = parseActivityCsv("Date,Move Minutes count,Step count\n2026-09-30,52,8123\n", TODAY);
    expect(parsed.activities).toEqual([]);
    expect(parsed.steps.get("2026-09-30")).toBe(8123);
  });

  it("refuse un fichier sans colonne exploitable ou trop long", () => {
    expect(() => parseActivityCsv("Nom,Poids\nA,70\n", TODAY)).toThrow("import_invalid");
    expect(() => parseActivityCsv("Date,Steps\n", TODAY)).toThrow("import_invalid");
    const big = ["Date,Steps", ...Array.from({ length: IMPORT_MAX_ROWS + 1 }, () => "2026-09-30,10")].join("\n");
    expect(() => parseActivityCsv(big, TODAY)).toThrow("import_too_large");
  });
});
