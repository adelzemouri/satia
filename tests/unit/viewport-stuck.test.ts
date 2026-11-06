import { describe, expect, it } from "vitest";

import { viewportLooksStuck } from "@/ui/viewport-stuck";

const normal = { offsetTop: 0, height: 844, innerHeight: 844, scale: 1, typing: false };

describe("viewportLooksStuck", () => {
  it("laisse tranquille une page normale", () => {
    expect(viewportLooksStuck(normal)).toBe(false);
    expect(viewportLooksStuck({ ...normal, height: 843.5 })).toBe(false);
  });

  it("repère la hauteur du clavier restée après sa fermeture", () => {
    expect(viewportLooksStuck({ ...normal, height: 544 })).toBe(true);
    expect(viewportLooksStuck({ ...normal, offsetTop: 24 })).toBe(true);
  });

  it("ne touche à rien pendant la saisie ou un zoom", () => {
    expect(viewportLooksStuck({ ...normal, height: 544, typing: true })).toBe(false);
    expect(viewportLooksStuck({ ...normal, offsetTop: 120, scale: 2 })).toBe(false);
  });
});
