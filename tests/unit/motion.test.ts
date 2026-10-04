import { describe, expect, it } from "vitest";

import { easeOutCubic, SWIPE_THRESHOLD, swipeAxis, swipeOutcome, tween } from "@/ui/motion";

describe("easeOutCubic", () => {
  it("part de 0, arrive à 1 et reste dans les bornes", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
  });

  it("avance vite au début", () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});

describe("tween", () => {
  it("va de la valeur de départ à la valeur d'arrivée, à l'entier", () => {
    expect(tween(1200, 800, 0)).toBe(1200);
    expect(tween(1200, 800, 1)).toBe(800);
    const middle = tween(1200, 800, 0.5);
    expect(middle).toBeLessThan(1200);
    expect(middle).toBeGreaterThan(800);
    expect(Number.isInteger(middle)).toBe(true);
  });
});

describe("swipeOutcome", () => {
  it("déclenche une action seulement au-delà du seuil", () => {
    expect(swipeOutcome(-SWIPE_THRESHOLD)).toBe("left");
    expect(swipeOutcome(SWIPE_THRESHOLD + 10)).toBe("right");
    expect(swipeOutcome(-(SWIPE_THRESHOLD - 1))).toBeNull();
    expect(swipeOutcome(0)).toBeNull();
  });
});

describe("swipeAxis", () => {
  it("attend quelques pixels avant de décider", () => {
    expect(swipeAxis(3, 2)).toBeNull();
  });

  it("laisse le défilement vertical tranquille", () => {
    expect(swipeAxis(10, 30)).toBe("y");
    expect(swipeAxis(12, 11)).toBe("y");
    expect(swipeAxis(30, 5)).toBe("x");
    expect(swipeAxis(-30, 5)).toBe("x");
  });
});
