import type { Unit } from "@/domain/units";

/** Aliment tel que l'affichent les écrans d'ajout (valeurs pour 100 g). */
export type FoodItem = {
  id: string;
  source: "ciqual" | "off" | "custom" | "recipe";
  nameFr: string;
  brand: string | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  densityGPerMl: number | null;
  unitWeights: Partial<Record<"portion" | "piece" | "slice", number>> | null;
  imageUrl: string | null;
  /** Renseigné pour une recette du foyer. */
  householdId?: string | null;
  /** Nombre de portions d'une recette. */
  servings?: number | null;
};

/** Produit Open Food Facts proposé avant import (voir server/open-food-facts.ts). */
export type OffItem = {
  code: string;
  name: string;
  brand: string | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  servingGrams: number | null;
  imageUrl: string | null;
};

/** Unité proposée par défaut : la portion ou la pièce si on la connaît, sinon les grammes. */
export function defaultUnit(units: readonly Unit[]): Unit {
  return units.find((unit) => unit === "portion" || unit === "piece") ?? "g";
}
