import { describe, expect, it } from "vitest";

import { glassesFromMl, isWaterFood } from "@/domain/water";

describe("eau des repas", () => {
  it("reconnaît les eaux Ciqual et les eaux sans énergie", () => {
    expect(isWaterFood({ groupFr: "eaux", kcal: 0, searchName: "eau du robinet" })).toBe(true);
    expect(isWaterFood({ groupFr: null, kcal: 0, searchName: "eau minerale gazeuse" })).toBe(true);
    expect(isWaterFood({ groupFr: "boissons sans alcool", kcal: 15.2, searchName: "eau de coco" })).toBe(false);
    expect(isWaterFood({ groupFr: "boisson alcoolisees", kcal: 229, searchName: "eau de vie" })).toBe(false);
    expect(isWaterFood({ groupFr: null, kcal: 0, searchName: "eautre" })).toBe(false);
  });

  it("arrondit au verre de 250 ml le plus proche", () => {
    expect(glassesFromMl(0)).toBe(0);
    expect(glassesFromMl(200)).toBe(1);
    expect(glassesFromMl(330)).toBe(1);
    expect(glassesFromMl(500)).toBe(2);
    expect(glassesFromMl(1500)).toBe(6);
  });
});
