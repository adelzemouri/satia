import { describe, expect, it } from "vitest";

import { isTabRoot, parentPath } from "@/features/navigation/parent-path";

describe("parentPath", () => {
  it("remonte d'un niveau dans les pages imbriquées", () => {
    expect(parentPath("/training/library/squat")).toBe("/training/library");
    expect(parentPath("/foods/abc/edit")).toBe("/foods/abc");
  });

  it("ramène les pages de premier niveau à leur onglet", () => {
    expect(parentPath("/weight")).toBe("/progress");
    expect(parentPath("/scan")).toBe("/add");
    expect(parentPath("/journal")).toBe("/");
    expect(parentPath("/shopping")).toBe("/plan");
    expect(parentPath("/coach")).toBe("/profile");
  });

  it("les pages de la Cuisine sont des onglets, le journal n'en est plus un", () => {
    expect(isTabRoot("/recipes")).toBe(true);
    expect(isTabRoot("/plan")).toBe(true);
    expect(isTabRoot("/journal")).toBe(false);
  });
});
