import { describe, expect, it } from "vitest";

import { ciqualHints, parseCsvLine, toCsvLine } from "../../scripts/ciqual/format";

describe("CSV Ciqual", () => {
  it("relit ce qu'il écrit, guillemets et virgules compris", () => {
    const values = ['Pomme, "golden", crue', 52.456, ""];
    expect(parseCsvLine(toCsvLine(values))).toEqual(['Pomme, "golden", crue', "52.46", ""]);
  });
});

describe("ciqualHints", () => {
  it("propose des unités usuelles", () => {
    expect(ciqualHints("Œuf, cru", "01")).toEqual({ unitWeights: { piece: 55 } });
    expect(ciqualHints("Lait demi-écrémé, UHT", "07")).toEqual({ densityGPerMl: 1.03 });
  });

  it("mesure toujours les boissons en volume", () => {
    expect(ciqualHints("Smoothie mangue", "06")).toEqual({ densityGPerMl: 1 });
  });

  it("ne garde pas le poids d'une pièce fraîche pour un produit transformé", () => {
    expect(ciqualHints("Pomme, pulpe et peau, crue", "02")).toEqual({ unitWeights: { piece: 150 } });
    expect(ciqualHints("Pomme, sèche", "02")).toEqual({});
    expect(ciqualHints("Pomme de terre noisette, surgelée, crue", "02")).toEqual({});
  });
});
