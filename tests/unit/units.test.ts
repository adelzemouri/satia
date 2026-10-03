import { describe, expect, it } from "vitest";

import { availableUnits, countUnitsFromServing, stepQuantity } from "@/domain/units";

describe("countUnitsFromServing", () => {
  it("déduit le poids d'une tranche", () => {
    expect(countUnitsFromServing("2 tranches (50 g)", 50)).toEqual({ slice: 25 });
    expect(countUnitsFromServing("1 tranche", 27)).toEqual({ slice: 27 });
    expect(countUnitsFromServing("50 g (2 tranches)", 50)).toEqual({ slice: 25 });
  });

  it("déduit le poids d'une pièce", () => {
    expect(countUnitsFromServing("3 biscuits (25 g)", 25)).toEqual({ piece: 8.3 });
    expect(countUnitsFromServing("1 pot de 125 g", 125)).toEqual({ piece: 125 });
  });

  it("ne devine rien sans unité reconnue ni poids", () => {
    expect(countUnitsFromServing("30 g", 30)).toEqual({});
    expect(countUnitsFromServing("2 tranches", null)).toEqual({});
    expect(countUnitsFromServing(undefined, 30)).toEqual({});
  });

  it("propose la tranche quand son poids est connu", () => {
    expect(availableUnits({ unitWeights: { slice: 25, portion: 50 } })).toEqual(["g", "kg", "portion", "slice"]);
  });
});

describe("stepQuantity", () => {
  it("avance de 10 g en se calant sur le pas", () => {
    expect(stepQuantity(100, "g", 1)).toBe("110");
    expect(stepQuantity(95, "g", 1)).toBe("100");
    expect(stepQuantity(95, "g", -1)).toBe("90");
  });

  it("avance d'une demi-unité pour les tranches et ne descend pas sous un pas", () => {
    expect(stepQuantity(1, "slice", 1)).toBe("1.5");
    expect(stepQuantity(0.5, "slice", -1)).toBe("0.5");
    expect(stepQuantity(Number.NaN, "g", 1)).toBe("10");
  });
});
