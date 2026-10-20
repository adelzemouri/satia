import { describe, expect, it } from "vitest";

import { cleanPagePath, describeDevice } from "@/domain/feedback";

describe("remarques", () => {
  it("décrit l'appareil et le navigateur courants", () => {
    expect(
      describeDevice(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("iPhone, Safari");
    expect(
      describeDevice(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36",
      ),
    ).toBe("Android, Chrome");
    expect(
      describeDevice(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
      ),
    ).toBe("Mac, Safari");
    expect(
      describeDevice(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/129.0 Mobile Safari/604.1",
      ),
    ).toBe("iPhone, Chrome");
    expect(describeDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0")).toBe(
      "Windows, Firefox",
    );
    expect(describeDevice("curl/8.0")).toBeNull();
    expect(describeDevice(null)).toBeNull();
  });

  it("ne garde qu'un chemin de l'app", () => {
    expect(cleanPagePath("/journal?date=2026-10-20#dejeuner")).toBe("/journal");
    expect(cleanPagePath("/recipes/abc-123")).toBe("/recipes/abc-123");
    expect(cleanPagePath("https://exemple.fr/x")).toBeNull();
    expect(cleanPagePath("//exemple.fr")).toBeNull();
    expect(cleanPagePath("/<script>")).toBeNull();
    expect(cleanPagePath("")).toBeNull();
  });
});
