import { describe, expect, it } from "vitest";

import { DAY_MOMENT_SCRIPT, dayMoment } from "@/domain/day-moment";

describe("dayMoment", () => {
  it.each([
    [5, "matin"],
    [10, "matin"],
    [11, "midi"],
    [16, "midi"],
    [17, "soir"],
    [23, "soir"],
    [0, "soir"],
    [4, "soir"],
  ] as const)("%i h → %s", (hour, moment) => {
    expect(dayMoment(hour)).toBe(moment);
  });

  it("le script en ligne donne le même moment que dayMoment", () => {
    for (let hour = 0; hour < 24; hour++) {
      const attrs: Record<string, string> = {};
      const fakeDocument = {
        documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) },
        addEventListener: () => {},
        visibilityState: "visible",
      };
      class FakeDate {
        getHours() {
          return hour;
        }
      }
      new Function("document", "Date", DAY_MOMENT_SCRIPT)(fakeDocument, FakeDate);
      expect(attrs["data-moment"]).toBe(dayMoment(hour));
    }
  });
});
