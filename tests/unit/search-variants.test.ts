import { describe, expect, it } from "vitest";

import { normalizeForSearch, searchVariants } from "@/domain/search";

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
