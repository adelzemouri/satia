import { describe, expect, it } from "vitest";

import { adaptGoal, measureExpenditure, weightDirection } from "@/domain/adaptive";
import { addDays } from "@/domain/energy";
import { weeklyBudget } from "@/domain/weekly-budget";

const today = "2026-10-29"; // un jeudi

/** Historique régulier : `days` jours saisis à `kcal`, poids qui évolue de `kgPerWeek`. */
function history(days: number, kcal: number, startKg: number, kgPerWeek: number, weighEvery = 2) {
  const intakes = new Map<string, number>();
  const weighIns: { date: string; weightKg: number }[] = [];
  for (let index = days; index >= 1; index -= 1) {
    const date = addDays(today, -index);
    intakes.set(date, kcal);
    const elapsed = days - index;
    if (elapsed % weighEvery === 0) weighIns.push({ date, weightKg: startKg + (kgPerWeek * elapsed) / 7 });
  }
  return { intakes, weighIns, firstDay: addDays(today, -days) };
}

describe("dépense mesurée", () => {
  it("se déduit des apports et de la tendance de poids", () => {
    // 1 800 kcal par jour et 0,5 kg perdu par semaine ≈ 1 800 + 550 = 2 350 kcal.
    // La tendance lissée réagit avec retard : on vérifie l'ordre de grandeur.
    const result = measureExpenditure({ today, ...history(60, 1800, 80, -0.5) });
    expect(result.status).toBe("measured");
    if (result.status !== "measured") return;
    expect(result.tdee).toBeGreaterThan(2250);
    expect(result.tdee).toBeLessThan(2400);
    expect(result.averageIntake).toBe(1800);
    expect(result.to).toBe(addDays(today, -1));
    expect(result.from).toBe(addDays(today, -28));
  });

  it("à poids stable, la dépense égale les apports", () => {
    const result = measureExpenditure({ today, ...history(30, 2100, 70, 0) });
    expect(result).toMatchObject({ status: "measured", tdee: 2100, weeklyChangeKg: 0 });
  });

  it("attend 14 jours, 3 pesées et 80 % de jours saisis, et dit ce qui manque", () => {
    expect(measureExpenditure({ today, ...history(10, 2000, 70, 0) })).toEqual({
      status: "insufficient",
      missing: { days: 4, weighIns: 0, loggedDays: 2 },
    });
    expect(measureExpenditure({ today, ...history(20, 2000, 70, 0, 10) })).toMatchObject({
      status: "insufficient",
      missing: { days: 0, weighIns: 1, loggedDays: 0 },
    });
    const sparse = history(28, 2000, 70, 0);
    for (const date of [...sparse.intakes.keys()].slice(0, 8)) sparse.intakes.delete(date);
    expect(measureExpenditure({ today, ...sparse })).toMatchObject({
      status: "insufficient",
      missing: { loggedDays: 3 },
    });
  });

  it("signale des données incohérentes plutôt que d'ajuster", () => {
    expect(measureExpenditure({ today, ...history(28, 300, 70, 0) })).toMatchObject({ status: "inconsistent" });
  });
});

describe("ajustement de l'objectif", () => {
  const person = { goal: "lose_weight" as const, pace: "moderate" as const, sex: "female" as const, weightKg: 80 };

  it("reste limité à ±150 kcal par semaine", () => {
    // Dépense mesurée 2 600 : objectif idéal 2 600 − 550 = 2 050, on part de 1 700.
    expect(adaptGoal({ ...person, currentKcal: 1700, measuredTdee: 2600 })).toEqual({
      kcal: 1850,
      idealKcal: 2050,
      stepCapped: true,
    });
    expect(adaptGoal({ ...person, currentKcal: 2200, measuredTdee: 2600 })).toMatchObject({ kcal: 2050 });
  });

  it("ne descend jamais sous le plancher", () => {
    expect(adaptGoal({ ...person, currentKcal: 1250, measuredTdee: 1500 })).toMatchObject({ kcal: 1200 });
    expect(
      adaptGoal({ ...person, currentKcal: 1600, measuredTdee: 1500, floors: { female: 1500, male: 1700 } }),
    ).toMatchObject({ kcal: 1500 });
  });

  it("en maintien, vise la dépense mesurée", () => {
    expect(adaptGoal({ ...person, goal: "maintain", currentKcal: 2000, measuredTdee: 2080 })).toMatchObject({
      kcal: 2080,
      stepCapped: false,
    });
  });
});

describe("budget hebdomadaire", () => {
  const base = { dailyKcal: 2000, floor: 1200, largerDays: new Set<string>() };

  it("répartit ce qui reste sur les jours restants", () => {
    // Lundi → mercredi : 1 800 par jour, il reste 14 000 − 5 400 = 8 600 sur 4 jours.
    const consumed = new Map([
      ["2026-10-26", 1800],
      ["2026-10-27", 1800],
      ["2026-10-28", 1800],
    ]);
    const week = weeklyBudget({ ...base, today, consumed });
    expect(week.weekStart).toBe("2026-10-26");
    expect(week.total).toBe(14000);
    expect(week.todayKcal).toBe(2150);
    expect(week.consumed).toBe(5400);
    expect(week.overspent).toBe(false);
  });

  it("donne plus aux jours plus larges, un peu moins aux autres", () => {
    const week = weeklyBudget({
      ...base,
      today: "2026-10-26",
      consumed: new Map(),
      largerDays: new Set(["2026-11-01"]),
    });
    const sunday = week.days.at(-1)!;
    expect(sunday.larger).toBe(true);
    expect(sunday.kcal).toBeGreaterThan(2400);
    expect(week.todayKcal).toBeLessThan(2000);
    expect(week.todayKcal).toBeGreaterThanOrEqual(1600);
  });

  it("ne descend pas sous 80 % de l'objectif ni sous le plancher, sans report de l'excédent", () => {
    const consumed = new Map([
      ["2026-10-26", 4000],
      ["2026-10-27", 4000],
      ["2026-10-28", 4000],
    ]);
    const week = weeklyBudget({ ...base, today, consumed });
    expect(week.overspent).toBe(true);
    expect(week.todayKcal).toBe(1600);
    const lowFloor = weeklyBudget({ ...base, floor: 1700, today, consumed });
    expect(lowFloor.todayKcal).toBe(1700);
  });

  it("plafonne un jour normal à +20 % même si le début de semaine était léger", () => {
    const consumed = new Map([
      ["2026-10-26", 1000],
      ["2026-10-27", 1000],
      ["2026-10-28", 1000],
    ]);
    expect(weeklyBudget({ ...base, today, consumed }).todayKcal).toBe(2400);
  });
});

describe("budget hebdomadaire : jours sans saisie", () => {
  it("un jour passé sans saisie compte comme un jour à l'objectif", () => {
    const week = weeklyBudget({
      today,
      dailyKcal: 2000,
      floor: 1200,
      consumed: new Map([["2026-10-27", 2000]]),
      largerDays: new Set(),
    });
    expect(week.todayKcal).toBe(2000);
    expect(week.days[0]).toMatchObject({ consumed: null, past: true });
    expect(week.consumed).toBe(2000);
  });
});

describe("sens de la tendance de poids", () => {
  it("dit « stable » sous 0,1 kg par semaine, dans les deux sens", () => {
    expect(weightDirection(-0.03)).toBe("stable");
    expect(weightDirection(0.09)).toBe("stable");
    expect(weightDirection(0)).toBe("stable");
  });

  it("distingue la baisse de la hausse au-delà", () => {
    expect(weightDirection(-0.3)).toBe("down");
    expect(weightDirection(-0.1)).toBe("down");
    expect(weightDirection(0.25)).toBe("up");
  });
});
