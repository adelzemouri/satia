import { describe, expect, it } from "vitest";

import { longHistoryLines, metabolismLine } from "@/domain/coach-history";

const empty = { days: [], weights: [], checkins: [], moves: [], steps: [] };

describe("historique long du coach", () => {
  it("ne dit rien sans aucune donnée", () => {
    expect(longHistoryLines({ today: "2026-10-06", ...empty })).toEqual([]);
  });

  it("résume tout l'historique : semaines récentes une par une, mois avant", () => {
    const lines = longHistoryLines({
      today: "2026-10-06",
      days: [
        { date: "2026-06-10", kcal: 2200, proteinG: 80 },
        { date: "2026-06-11", kcal: 2000, proteinG: 90 },
        { date: "2026-09-29", kcal: 1800, proteinG: 100 },
        { date: "2026-10-05", kcal: 1700, proteinG: 110 },
      ],
      weights: [
        { date: "2026-06-10", weightKg: 84 },
        { date: "2026-09-29", weightKg: 80.5 },
        { date: "2026-10-05", weightKg: 80.8 },
      ],
      checkins: [{ date: "2026-10-05", hunger: 2, energy: 4, mood: null }],
      moves: [
        { date: "2026-10-05", minutes: 30 },
        { date: "2026-10-04", minutes: 45 },
      ],
      steps: [{ date: "2026-06-10", steps: 8000 }],
    });
    expect(lines).toEqual([
      "Suivi depuis le 2026-06-10 : 4 jours de repas saisis.",
      "Poids : 84 kg le 2026-06-10, plus bas 80.5 kg le 2026-09-29, dernier 80.8 kg le 2026-10-05.",
      "Par mois (moyennes par jour saisi, pas des totaux) : Mois 2026-06 : 2 j saisis, 2100 kcal par jour, 85 g prot./j, poids 84 kg, 8000 pas/j.",
      "Par semaine (moyennes par jour saisi, pas des totaux) : Sem. du 09-28 : 1 j saisi, 1800 kcal par jour, 100 g prot./j, poids 80.5 kg, 1 activité (45 min) ; " +
        "Cette semaine : 1 j saisi, 1700 kcal par jour, 110 g prot./j, poids 80.8 kg, faim 2/5, énergie 4/5, 1 activité (30 min).",
    ]);
  });
});

describe("bilan du métabolisme pour le coach", () => {
  it("donne la moyenne de toute la période et la dépense réelle", () => {
    expect(
      metabolismLine({
        status: "measured",
        tdee: 2002,
        from: "2026-10-02",
        to: "2026-10-17",
        averageIntake: 1968,
        weeklyChangeKg: -0.03,
      }),
    ).toBe(
      "Bilan des 16 derniers jours (page Mon métabolisme) : mangé en moyenne 1968 kcal par jour, " +
        "poids stable (-0.03 kg par semaine), dépense réelle 2002 kcal par jour.",
    );
  });

  it("ne dit rien tant que la dépense n'est pas mesurée", () => {
    expect(metabolismLine({ status: "insufficient", missing: { days: 3, weighIns: 0, loggedDays: 0 } })).toBeNull();
  });
});
