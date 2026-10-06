import { describe, expect, it } from "vitest";

import { shortFoodName } from "@/domain/food-name";

describe("nom court des aliments", () => {
  it.each([
    ["Saumon, cuit, sans précision (aliment moyen)", "Saumon, cuit"],
    ["Yaourt au lait de brebis, nature, 3% MG environ", "Yaourt au lait de brebis, nature"],
    ["Croissant, sans précision", "Croissant"],
    ["Chou farci, préemballé", "Chou farci"],
    [
      "Abricot au sirop (sans précision sur léger ou classique), appertisé, égoutté (aliment moyen)",
      "Abricot au sirop",
    ],
    ["Poulet, aile, viande et peau, rôti/cuit au four", "Poulet, aile, viande et peau, rôti"],
    ["Ascophylle noueux ou goémon noir (Ascophyllum nodosum), séché ou déshydraté", "Ascophylle noueux ou goémon noir"],
    [
      "Eau minérale Chaudfontaine, embouteillée, non gazeuse, faiblement minéralisée (Belgique)",
      "Eau minérale Chaudfontaine",
    ],
    ["Brocoli, cru", "Brocoli, cru"],
    ["Pâtes ou nouilles asiatiques au blé, cuites, nature, non salées", "Pâtes ou nouilles asiatiques au blé, cuites"],
    ["Pâtes, sans gluten, à base de riz et maïs, cuites à l'eau, non salées", "Pâtes, sans gluten, cuites à l'eau"],
    [
      "Matière grasse végétale (type margarine) à 60% de MG, allégée, au tournesol, doux",
      "Matière grasse végétale, allégée",
    ],
  ])("%s → %s", (name, short) => {
    expect(shortFoodName(name)).toBe(short);
  });

  it("garde les noms de la famille et les marques", () => {
    expect(shortFoodName("Gâteau de mamie")).toBe("Gâteau de mamie");
    expect(shortFoodName("Skyr nature (Siggi's)")).toBe("Skyr nature (Siggi's)");
    expect(shortFoodName("Fromage blanc, müesli et beurre de cacahuète")).toBe(
      "Fromage blanc, müesli et beurre de cacahuète",
    );
  });
});
