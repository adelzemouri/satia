import { describe, expect, it } from "vitest";

import { detectPlatform } from "@/features/install/platform";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const IPAD_AS_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

describe("detectPlatform", () => {
  it("reconnaît l'iPhone", () => expect(detectPlatform(IPHONE, 5)).toBe("ios"));
  it("reconnaît l'iPad qui se présente comme un Mac, grâce à l'écran tactile", () =>
    expect(detectPlatform(IPAD_AS_MAC, 5)).toBe("ios"));
  it("laisse un vrai Mac sur ordinateur", () => expect(detectPlatform(IPAD_AS_MAC, 0)).toBe("desktop"));
  it("reconnaît Android", () => expect(detectPlatform(ANDROID, 5)).toBe("android"));
  it("met le reste sur ordinateur", () => expect(detectPlatform(WINDOWS, 0)).toBe("desktop"));
});
