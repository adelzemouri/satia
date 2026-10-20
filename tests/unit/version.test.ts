import { describe, expect, it } from "vitest";

import { parseBuildNumber, versionLabel } from "@/domain/version";

describe("versionLabel", () => {
  it("assemble le premier chiffre et le nombre de modifications", () => {
    expect(versionLabel(1, 196, "e3aaeb9c0ffee")).toBe("1.196");
  });

  it("retombe sur le code court du commit sans nombre de modifications", () => {
    expect(versionLabel(1, null, "e3aaeb9c0ffee")).toBe("e3aaeb9");
  });

  it("ne renvoie rien sans aucune information", () => {
    expect(versionLabel(1, null, null)).toBeNull();
  });
});

describe("parseBuildNumber", () => {
  it("lit un entier positif", () => {
    expect(parseBuildNumber("196")).toBe(196);
  });

  it("ignore une valeur vide, nulle ou invalide", () => {
    for (const raw of [undefined, "", "0", "-3", "1.5", "abc"]) expect(parseBuildNumber(raw)).toBeNull();
  });
});
