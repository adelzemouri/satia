import { describe, expect, it } from "vitest";

import { adjacentTab, tabSwipeThreshold } from "@/features/navigation/tab-order";

describe("glissement entre onglets", () => {
  it("le doigt vers la gauche amène l'onglet de droite, et inversement", () => {
    expect(adjacentTab("/", "left")).toBe("/journal");
    expect(adjacentTab("/journal", "left")).toBe("/progress");
    expect(adjacentTab("/progress", "right")).toBe("/journal");
    expect(adjacentTab("/profile", "right")).toBe("/progress");
  });

  it("s'arrête aux deux bouts", () => {
    expect(adjacentTab("/", "right")).toBeNull();
    expect(adjacentTab("/profile", "left")).toBeNull();
  });

  it("ne réagit que sur les pages racines des onglets", () => {
    expect(adjacentTab("/weight", "left")).toBeNull();
    expect(adjacentTab("/journal/edit", "left")).toBeNull();
    expect(adjacentTab("/add", "left")).toBeNull();
  });

  it("demande un quart de l'écran, 80 px au moins", () => {
    expect(tabSwipeThreshold(400)).toBe(100);
    expect(tabSwipeThreshold(200)).toBe(80);
  });
});
