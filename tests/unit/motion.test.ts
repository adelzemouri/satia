import { describe, expect, it } from "vitest";

import {
  countUp,
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

describe("countUp", () => {
  it("file vite puis égrène les dix dernières unités, de plus en plus lentement", () => {
    const { duration, valueAt } = countUp(0, 2080, 700);
    expect(valueAt(0)).toBe(0);
    expect(valueAt(699)).toBeLessThanOrEqual(2070);
    expect(valueAt(700)).toBe(2070);
    expect(valueAt(duration)).toBe(2080);
    // Chaque unité reste affichée plus longtemps que la précédente.
    const ticks: number[] = [];
    for (let t = 701; t <= Math.ceil(duration); t++) if (valueAt(t) !== valueAt(t - 1)) ticks.push(t);
    expect(ticks).toHaveLength(10);
    const gaps = ticks.slice(1).map((tick, index) => tick - ticks[index]!);
    gaps.slice(1).forEach((gap, index) => expect(gap).toBeGreaterThan(gaps[index]!));
  });

  it("descend aussi, et un petit écart ne fait que la fin au ralenti", () => {
    const down = countUp(500, 480, 450);
    expect(down.valueAt(450)).toBe(490);
    expect(down.valueAt(down.duration)).toBe(480);
    const small = countUp(100, 104, 450);
    expect(small.valueAt(0)).toBe(100);
    expect(small.valueAt(small.duration)).toBe(104);
    expect(small.duration).toBeLessThan(450);
  });

  it("ne bouge pas quand rien ne change", () => {
    expect(countUp(42, 42, 700)).toMatchObject({ duration: 0 });
    expect(countUp(42, 42, 700).valueAt(0)).toBe(42);
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
