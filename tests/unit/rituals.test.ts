import { describe, expect, it } from "vitest";

import { dueReminders, DEFAULT_NOTIFICATION_PREFS } from "@/domain/notifications";
import {
  dueRituals,
  freshVictory,
  nextWeighDay,
  parseSnoozes,
  type RitualPrefs,
  ritualsToNotify,
  serializeSnoozes,
  weighPeriodStart,
  weighStatus,
} from "@/domain/rituals";

// Lundi 12 octobre 2026.
const MONDAY = "2026-10-12";
const prefs: RitualPrefs = { weighIn: true, weighDay: 1, measurements: true, progressPhoto: true };
const none = { weighDates: [], measureDates: [], photoDates: [] };
const mondays = (count: number, from = "2026-10-05") =>
  Array.from({ length: count }, (_, index) => {
    const date = new Date(`${from}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 7 * index);
    return date.toISOString().slice(0, 10);
  });

describe("semaine de pesée", () => {
  it("commence au dernier jour de pesée, aujourd'hui compris", () => {
    expect(weighPeriodStart(MONDAY, 1)).toBe(MONDAY);
    expect(weighPeriodStart("2026-10-14", 1)).toBe(MONDAY);
    expect(weighPeriodStart(MONDAY, 3)).toBe("2026-10-07");
    expect(nextWeighDay("2026-10-14", 1)).toBe("2026-10-19");
  });

  it("compte les semaines d'affilée, la semaine en cours dès qu'elle est faite", () => {
    expect(weighStatus(mondays(3), MONDAY, 1)).toMatchObject({ doneThisPeriod: false, streak: 3 });
    expect(weighStatus([MONDAY, ...mondays(3)], MONDAY, 1)).toMatchObject({ doneThisPeriod: true, streak: 4 });
    // Une semaine sans pesée arrête la série, sans rien retirer d'autre.
    expect(weighStatus(["2026-10-05", "2026-09-21"], MONDAY, 1).streak).toBe(1);
    // N'importe quel jour de la semaine compte.
    expect(weighStatus(["2026-10-09", "2026-10-01"], MONDAY, 1).streak).toBe(2);
  });

  it("donne les quatre dernières cases, la semaine en cours en dernier", () => {
    const { weeks } = weighStatus(["2026-10-05", "2026-09-21"], MONDAY, 1);
    expect(weeks).toEqual([
      { start: "2026-09-21", done: true },
      { start: "2026-09-28", done: false },
      { start: "2026-10-05", done: true },
      { start: MONDAY, done: false },
    ]);
  });
});

describe("rituels du jour", () => {
  it("propose la pesée le jour choisi et les deux jours suivants seulement", () => {
    const kinds = (today: string) =>
      dueRituals({ today, prefs: { ...prefs, measurements: false, progressPhoto: false }, ...none }).map(
        (ritual) => ritual.kind,
      );
    expect(kinds(MONDAY)).toEqual(["weigh"]);
    expect(kinds("2026-10-14")).toEqual(["weigh"]);
    expect(kinds("2026-10-15")).toEqual([]);
    expect(kinds("2026-10-11")).toEqual([]);
  });

  it("ne propose plus la pesée une fois faite dans la semaine", () => {
    const due = dueRituals({ today: "2026-10-13", prefs, ...none, weighDates: [MONDAY] });
    expect(due.map((ritual) => ritual.kind)).toEqual(["measure", "photo"]);
  });

  it("annonce la série atteinte avec la pesée du jour", () => {
    const [weigh] = dueRituals({ today: MONDAY, prefs, ...none, weighDates: mondays(3) });
    expect(weigh).toMatchObject({ kind: "weigh", nextStreak: 4 });
  });

  it("propose les rituels du mois après quatre semaines, ou la première fois", () => {
    const base = { today: MONDAY, prefs: { ...prefs, weighIn: false }, ...none };
    expect(dueRituals({ ...base, measureDates: ["2026-09-15"], photoDates: ["2026-09-14"] })).toEqual([
      { kind: "photo", last: "2026-09-14" },
    ]);
    expect(dueRituals(base)).toEqual([
      { kind: "measure", last: null },
      { kind: "photo", last: null },
    ]);
  });

  it("respecte les préférences et « Plus tard »", () => {
    expect(dueRituals({ today: MONDAY, prefs: { ...prefs, weighIn: false, progressPhoto: false }, ...none })).toEqual([
      { kind: "measure", last: null },
    ]);
    const snoozed = { weigh: "2026-10-13", measure: "2026-10-19" };
    expect(dueRituals({ today: MONDAY, prefs, ...none, snoozedUntil: snoozed }).map((r) => r.kind)).toEqual(["photo"]);
    expect(dueRituals({ today: "2026-10-13", prefs, ...none, snoozedUntil: snoozed }).map((r) => r.kind)).toEqual([
      "weigh",
      "photo",
    ]);
  });

  it("lit et écrit le cookie « Plus tard » en ignorant le reste", () => {
    expect(parseSnoozes("weigh:2026-10-13,measure:2026-10-19,bad:2026-01-01,photo:demain")).toEqual({
      weigh: "2026-10-13",
      measure: "2026-10-19",
    });
    expect(parseSnoozes(undefined)).toEqual({});
    expect(serializeSnoozes({ weigh: MONDAY, measure: "2026-10-19" }, MONDAY)).toBe("measure:2026-10-19");
  });
});

describe("victoires de régularité", () => {
  it("annonce 4 semaines de pesée d'affilée le jour où elles sont atteintes", () => {
    const weighDates = [MONDAY, ...mondays(3)];
    expect(freshVictory({ today: MONDAY, weighDay: 1, ...none, weighDates })).toEqual({
      id: `weigh:4:${MONDAY}`,
      kind: "weigh",
      count: 4,
      big: true,
    });
    // Trois jours après, plus d'annonce.
    expect(freshVictory({ today: "2026-10-15", weighDay: 1, ...none, weighDates })).toBeNull();
    expect(freshVictory({ today: MONDAY, weighDay: 1, ...none, weighDates: [MONDAY, ...mondays(2)] })).toBeNull();
  });

  it("annonce la première mensuration discrètement, puis 3 mois en grand", () => {
    expect(freshVictory({ today: MONDAY, weighDay: 1, ...none, measureDates: [MONDAY] })).toEqual({
      id: "measure:1",
      kind: "measure",
      count: 1,
      big: false,
    });
    const threeMonths = [MONDAY, "2026-09-10", "2026-08-12"];
    expect(freshVictory({ today: MONDAY, weighDay: 1, ...none, measureDates: threeMonths })).toMatchObject({
      kind: "measure",
      count: 3,
      big: true,
    });
  });

  it("préfère une grande étape à une petite", () => {
    const victory = freshVictory({
      today: MONDAY,
      weighDay: 1,
      weighDates: [MONDAY, ...mondays(7)],
      measureDates: [],
      photoDates: [MONDAY],
    });
    expect(victory).toMatchObject({ kind: "weigh", count: 8 });
  });
});

describe("notifications des rituels", () => {
  it("rappelle la pesée le matin du jour choisi si elle n'est pas faite", () => {
    expect(ritualsToNotify({ today: MONDAY, prefs, ...none })).toEqual(["weigh"]);
    expect(ritualsToNotify({ today: MONDAY, prefs, ...none, weighDates: [MONDAY] })).toEqual([]);
    expect(ritualsToNotify({ today: "2026-10-13", prefs, ...none })).toEqual([]);
  });

  it("rappelle les rituels du mois le jour où ils reviennent, jamais la première fois", () => {
    expect(ritualsToNotify({ today: MONDAY, prefs: { ...prefs, weighIn: false }, ...none })).toEqual([]);
    expect(
      ritualsToNotify({
        today: MONDAY,
        prefs: { ...prefs, weighIn: false },
        ...none,
        measureDates: ["2026-09-14"],
        photoDates: ["2026-09-01"],
      }),
    ).toEqual(["measure"]);
  });

  it("part entre 8 h 30 et 11 h 30, hors plage silencieuse", () => {
    const input = {
      date: MONDAY,
      weekday: 1,
      weekStart: MONDAY,
      prefs: { ...DEFAULT_NOTIFICATION_PREFS, meals: false, water: false, weeklyReview: false },
      mealTimes: { breakfast: "07:30", lunch: "12:30", dinner: "19:30" },
      loggedSlots: new Set<string>(),
      waterGlasses: 0,
      waterGoal: 8,
      reviewReady: false,
      rituals: ["weigh"] as const,
    };
    expect(dueReminders({ ...input, time: "08:20" })).toEqual([]);
    expect(dueReminders({ ...input, time: "09:00" })).toEqual([
      { kind: "ritual", key: `${MONDAY}:weigh`, ritual: "weigh" },
    ]);
    expect(dueReminders({ ...input, time: "11:30" })).toEqual([]);
  });
});
