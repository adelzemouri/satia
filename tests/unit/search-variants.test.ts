import { describe, expect, it } from "vitest";

import { normalizeForSearch, pickForLabel, searchVariants } from "@/domain/search";

describe("formulations Ciqual d'une recherche", () => {
  const variants = (text: string) => searchVariants(normalizeForSearch(text));

  it("traduit les noms courants de la crème", () => {
    expect(variants("Crème liquide")).toEqual(["creme fluide"]);
    expect(variants("crème fraîche")).toEqual(["creme epaisse"]);
    expect(variants("crème fraîche liquide")).toEqual(["creme fluide"]);
    expect(variants("crème fraîche épaisse")).toEqual(["creme epaisse epaisse"]);
  });

  it("ne change rien aux autres recherches", () => {
    expect(variants("pomme crue")).toEqual([]);
    expect(variants("crème brûlée")).toEqual([]);
  });
});

describe("aliment proposé pour un nom reconnu par l'IA", () => {
  const dry = { nameFr: "Linguine (De Cecco)" };
  const raw = { nameFr: "Pâtes sèches standard, crues" };
  const cooked = { nameFr: "Pâtes sèches standard, cuites, non salées" };

  it("cherche les formes de pâtes sous leur nom Ciqual", () => {
    expect(searchVariants(normalizeForSearch("Linguine cuites"))).toEqual(["pates seches cuites"]);
    expect(searchVariants("spaghettis")).toEqual(["pates seches"]);
  });

  it("préfère des pâtes cuites à un paquet sec", () => {
    expect(pickForLabel("linguine", [dry, raw, cooked])).toBe(cooked);
    // Un poisson au nom proche n'est pas des pâtes cuites.
    expect(pickForLabel("linguine", [dry, { nameFr: "Julienne ou Lingue, cuite" }, cooked])).toBe(cooked);
    expect(pickForLabel("riz blanc", [{ nameFr: "Riz blanc, cru" }, { nameFr: "Riz blanc, cuit, non salé" }])).toEqual({
      nameFr: "Riz blanc, cuit, non salé",
    });
    expect(pickForLabel("saumon cuit", [{ nameFr: "Saumon, cru" }, { nameFr: "Saumon, cuit à la vapeur" }])).toEqual({
      nameFr: "Saumon, cuit à la vapeur",
    });
  });

  it("garde le premier résultat sinon", () => {
    expect(pickForLabel("pâtes crues", [raw, cooked])).toBe(raw);
    expect(pickForLabel("pomme", [{ nameFr: "Pomme, crue" }, { nameFr: "Pomme, cuite" }])).toEqual({
      nameFr: "Pomme, crue",
    });
    expect(pickForLabel("linguine", [dry])).toBe(dry);
    expect(pickForLabel("linguine", [])).toBeNull();
  });
});

describe("eau sans précision", () => {
  const results = [
    { nameFr: "Eau de vie" },
    { nameFr: "Eau de coco" },
    { nameFr: "Eau minérale (aliment moyen)" },
    { nameFr: "Eau du robinet" },
  ];

  it("propose de l'eau du robinet, pas de l'eau-de-vie", () => {
    expect(pickForLabel("eau", results)).toEqual({ nameFr: "Eau du robinet" });
    expect(pickForLabel("Verre d'eau", results)).toEqual({ nameFr: "Eau du robinet" });
  });

  const variants = (text: string) => searchVariants(normalizeForSearch(text));

  it("cherche un verre seul comme de l'eau", () => {
    expect(variants("verre")).toEqual(["eau du robinet"]);
    expect(variants("grand verre")).toEqual(["eau du robinet"]);
    expect(variants("verre de vin rouge")).toEqual([]);
    expect(pickForLabel("verre", results)).toEqual({ nameFr: "Eau du robinet" });
  });

  it("garde l'eau-de-vie quand elle est nommée", () => {
    expect(pickForLabel("eau de vie", results)).toEqual({ nameFr: "Eau de vie" });
    expect(pickForLabel("eau gazeuse", [{ nameFr: "Eau minérale, gazeuse (aliment moyen)" }, ...results])).toEqual({
      nameFr: "Eau minérale, gazeuse (aliment moyen)",
    });
  });
});
