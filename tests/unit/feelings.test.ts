import { describe, expect, it } from "vitest";

import { feelingAverage, feelingDays } from "@/domain/feelings";

describe("historique du ressenti", () => {
  const days = feelingDays(
    ["2026-10-01", "2026-10-02", "2026-10-03"],
    [
      { date: "2026-10-01", hunger: 2, energy: 4, mood: null },
      { date: "2026-10-03", hunger: 3, energy: 5, mood: 4 },
    ],
    [{ date: "2026-10-02", kcal: 1834.6 }],
  );

  it("garde une ligne par jour, même sans donnée", () => {
    expect(days).toEqual([
      { date: "2026-10-01", hunger: 2, energy: 4, mood: null, kcal: null },
      { date: "2026-10-02", hunger: null, energy: null, mood: null, kcal: 1835 },
      { date: "2026-10-03", hunger: 3, energy: 5, mood: 4, kcal: null },
    ]);
  });

  it("fait la moyenne des seuls jours notés", () => {
    expect(feelingAverage(days, "hunger")).toBe(2.5);
    expect(feelingAverage(days, "mood")).toBe(4);
    expect(feelingAverage(days.slice(1, 2), "energy")).toBeNull();
  });
});
