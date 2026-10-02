import { describe, expect, it } from "vitest";

import { hasValidCheckDigit, normalizeBarcode } from "@/domain/barcode";
import { slotAt } from "@/domain/meals";

describe("codes-barres", () => {
  it("vérifie la clé de contrôle", () => {
    expect(hasValidCheckDigit("3017620422003")).toBe(true);
    expect(hasValidCheckDigit("3017620422004")).toBe(false);
    expect(hasValidCheckDigit("96385074")).toBe(true);
  });

  it("normalise les codes saisis ou scannés", () => {
    expect(normalizeBarcode(" 3 017620 422003 ")).toBe("3017620422003");
    expect(normalizeBarcode("96385074")).toBe("96385074");
    // UPC-A : Open Food Facts l'enregistre sur 13 chiffres.
    expect(normalizeBarcode("036000291452")).toBe("0036000291452");
  });

  it("refuse les codes invalides", () => {
    expect(normalizeBarcode("3017620422004")).toBeNull();
    expect(normalizeBarcode("12345")).toBeNull();
    expect(normalizeBarcode("abc")).toBeNull();
  });
});

describe("slotAt", () => {
  it("devine le repas selon l'heure de Paris", () => {
    expect(slotAt(new Date("2026-10-02T06:00:00Z"), "Europe/Paris")).toBe("breakfast");
    expect(slotAt(new Date("2026-10-02T11:00:00Z"), "Europe/Paris")).toBe("lunch");
    expect(slotAt(new Date("2026-10-02T14:30:00Z"), "Europe/Paris")).toBe("snack");
    expect(slotAt(new Date("2026-10-02T18:00:00Z"), "Europe/Paris")).toBe("dinner");
  });
});
