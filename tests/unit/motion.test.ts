import { describe, expect, it } from "vitest";

import {
  easeOutStrong,
  FLICK_MIN_DISTANCE,
  SWIPE_THRESHOLD,
  swipeAxis,
  swipeOutcome,
  swipeRelease,
  swipeThreshold,
  tween,
} from "@/ui/motion";

describe("easeOutStrong", () => {
  it("part de 0, arrive à 1 et reste dans les bornes", () => {
    expect(easeOutStrong(0)).toBe(0);
    expect(easeOutStrong(1)).toBe(1);
    expect(easeOutStrong(-1)).toBe(0);
    expect(easeOutStrong(2)).toBe(1);
  });

  it("avance vite au début puis ralentit nettement à la fin", () => {
    expect(easeOutStrong(0.5)).toBeGreaterThan(0.9);
    // Le dernier cinquième du temps ne couvre que la toute fin du trajet.
    expect(1 - easeOutStrong(0.8)).toBeLessThan(0.01);
    expect(easeOutStrong(0.9)).toBeGreaterThan(easeOutStrong(0.8));
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

describe("swipeRelease", () => {
  it("garde le seuil pour un geste lent", () => {
    expect(swipeRelease(-SWIPE_THRESHOLD, 2000)).toBe("left");
    expect(swipeRelease(-60, 1000)).toBeNull();
  });

  it("accepte un petit geste vif, dans son sens", () => {
    expect(swipeRelease(-60, 120)).toBe("left");
    expect(swipeRelease(60, 120)).toBe("right");
  });

  it("ignore un tremblement du doigt, même rapide", () => {
    expect(swipeRelease(-(FLICK_MIN_DISTANCE - 1), 5)).toBeNull();
  });
});

describe("swipeThreshold", () => {
  it("demande au moins 40 % de la largeur de la ligne", () => {
    expect(swipeThreshold(200)).toBe(SWIPE_THRESHOLD);
    expect(swipeThreshold(380)).toBe(152);
  });
});

describe("swipeAxis", () => {
  it("attend quelques pixels avant de décider", () => {
    expect(swipeAxis(3, 2)).toBeNull();
  });

  it("laisse le défilement vertical tranquille", () => {
    expect(swipeAxis(10, 30)).toBe("y");
    expect(swipeAxis(12, 11)).toBe("y");
    // Un geste en diagonale reste un défilement.
    expect(swipeAxis(30, 20)).toBe("y");
    expect(swipeAxis(30, 5)).toBe("x");
    expect(swipeAxis(-30, 5)).toBe("x");
  });
});
