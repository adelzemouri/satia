import { describe, expect, it } from "vitest";

import en from "@/i18n/messages/en.json";
import fr from "@/i18n/messages/fr.json";

function keys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key));
}

describe("messages i18n", () => {
  it("l'anglais a exactement les mêmes clés que le français", () => {
    expect(keys(en).sort()).toEqual(keys(fr).sort());
  });

  it("aucun texte n'emploie un vocabulaire culpabilisant", () => {
    const text = JSON.stringify(fr).toLowerCase();
    for (const word of ["craquage", "triche", "écart"]) expect(text).not.toContain(word);
  });
});
