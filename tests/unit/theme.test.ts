import { describe, expect, it } from "vitest";

import { parseTheme } from "@/features/preferences/theme";

describe("parseTheme", () => {
  it.each(["light", "dark", "system"] as const)("accepte %s", (value) => {
    expect(parseTheme(value)).toBe(value);
  });

  it.each([undefined, "", "blue"])("retombe sur system pour %s", (value) => {
    expect(parseTheme(value)).toBe("system");
  });
});
