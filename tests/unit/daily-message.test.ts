import { describe, expect, it } from "vitest";

import { type DailyContext, dailyMessage, TIP_COUNT } from "@/domain/daily-message";

const base: DailyContext = {
  hour: 9,
  mainMealsLogged: 0,
  loggedToday: false,
  remainingKcal: 1800,
  waterGlasses: 0,
  waterGoal: 8,
  streakDays: 0,
  seed: "u:2026-10-03",
};

describe("dailyMessage", () => {
  it("salue le matin tant que rien n'est noté", () => {
    expect(dailyMessage(base)).toEqual({ key: "morning" });
  });

  it("fête un palier de série seulement une fois la journée commencée", () => {
    expect(dailyMessage({ ...base, streakDays: 7 })).toEqual({ key: "morning" });
    expect(dailyMessage({ ...base, streakDays: 7, loggedToday: true, mainMealsLogged: 1 })).toEqual({
      key: "streak",
      days: 7,
    });
  });

  it("félicite une journée complète", () => {
    expect(dailyMessage({ ...base, hour: 21, loggedToday: true, mainMealsLogged: 3 })).toEqual({ key: "dayComplete" });
  });

  it("le soir, parle de ce qui reste sans jamais reprocher un dépassement", () => {
    const evening = { ...base, hour: 19, loggedToday: true, mainMealsLogged: 2 };
    expect(dailyMessage({ ...evening, remainingKcal: 612 })).toEqual({ key: "eveningRoom", kcal: 610 });
    expect(dailyMessage({ ...evening, remainingKcal: -150 })).toEqual({ key: "eveningFull" });
  });

  it("donne un conseil stable sur la journée", () => {
    const tip = dailyMessage({ ...base, hour: 10, loggedToday: true, mainMealsLogged: 1 });
    expect(tip.key).toBe("tip");
    if (tip.key === "tip") expect(tip.index).toBeLessThan(TIP_COUNT);
    expect(dailyMessage({ ...base, hour: 10, loggedToday: true, mainMealsLogged: 1 })).toEqual(tip);
  });
});
