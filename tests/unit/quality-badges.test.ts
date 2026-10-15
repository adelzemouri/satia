import { describe, expect, it } from "vitest";

import { fiberLevel, novaFourMarkers, novaMarkerKey, qualityVerdict, saltLevel, sugarsLevel } from "@/domain/quality";

describe("badges Nutri-Score et NOVA", () => {
  it("garde les marqueurs du groupe 4, sans doublon", () => {
    const markers = {
      "3": [["ingredients", "en:salt"]],
      "4": [
        ["ingredients", "en:flavouring"],
        ["ingredients", "en:gluten"],
        ["additives", "en:e282"],
        ["ingredients", "en:flavouring"],
      ],
    };
    expect(novaFourMarkers(markers)).toEqual(["en:flavouring", "en:gluten", "en:e282"]);
    expect(novaFourMarkers({ "3": [["ingredients", "en:salt"]] })).toEqual([]);
    expect(novaFourMarkers(undefined)).toEqual([]);
  });

  it("reconnaît les additifs et les autres marqueurs", () => {
    expect(novaMarkerKey("en:e282")).toEqual({ additive: "E282" });
    expect(novaMarkerKey("en:e150d")).toEqual({ additive: "E150d" });
    expect(novaMarkerKey("en:natural-flavouring")).toEqual({ key: "natural-flavouring" });
  });

  it("résume les badges seulement quand ils se contredisent", () => {
    expect(qualityVerdict("a", 4)).toBe("goodButProcessed");
    expect(qualityVerdict("b", 4)).toBe("goodButProcessed");
    expect(qualityVerdict("e", 2)).toBe("simpleButRich");
    expect(qualityVerdict("d", 1)).toBe("simpleButRich");
    expect(qualityVerdict("c", 4)).toBeNull();
    expect(qualityVerdict("a", 1)).toBeNull();
    expect(qualityVerdict(null, 4)).toBeNull();
    expect(qualityVerdict("a", null)).toBeNull();
  });

  it("classe fibres, sucres et sel pour 100 g", () => {
    expect([fiberLevel(7.2), fiberLevel(3), fiberLevel(2.9)]).toEqual(["rich", "source", "low"]);
    expect([sugarsLevel(4.2), sugarsLevel(10), sugarsLevel(30)]).toEqual(["low", "medium", "high"]);
    expect([saltLevel(0.3), saltLevel(0.96), saltLevel(1.6)]).toEqual(["low", "medium", "high"]);
  });
});
