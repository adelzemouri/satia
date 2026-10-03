import { describe, expect, it } from "vitest";

import { parentPath } from "@/features/navigation/parent-path";

describe("parentPath", () => {
  it("remonte d'un niveau dans les pages imbriquées", () => {
    expect(parentPath("/training/library/squat")).toBe("/training/library");
    expect(parentPath("/foods/abc/edit")).toBe("/foods/abc");
  });

  it("ramène les pages de premier niveau à leur onglet", () => {
    expect(parentPath("/weight")).toBe("/progress");
    expect(parentPath("/scan")).toBe("/add");
    expect(parentPath("/recipes")).toBe("/profile");
  });
});
