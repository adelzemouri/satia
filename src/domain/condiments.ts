/**
 * Garde-fou sur les quantités proposées par l'IA pour les assaisonnements et les doses : un
 * modèle bon marché renvoie parfois 100 g de balsamique, ou les 899 g d'un pot de whey. Au-delà de trois fois la portion
 * habituelle, on la remplace par cette portion (calcul pur).
 */
import { normalizeForSearch } from "./search";

/** Portion habituelle en grammes, du motif le plus précis au plus général. */
const CONDIMENTS: readonly [RegExp, number][] = [
  // Une dose de protéines en poudre, et non le pot entier dont le poids net se lit sur la photo.
  [/\b(?:whey|lactoserum|poudre de proteines?|proteines? en poudre)\b/, 30],
  [/\bvinaigrette\b/, 20],
  [/\bcreme (?:de vinaigre )?balsamique\b/, 10],
  [/\b(?:vinaigre|balsamique)\b/, 10],
  [/\bhuile\b/, 10],
  [/\bmayonnaise\b/, 15],
  [/\b(?:ketchup|sauce tomate ketchup)\b/, 15],
  [/\bmoutarde\b/, 8],
  [/\bsauce soja\b/, 10],
  [/\bbeurre\b/, 8],
  [/\b(?:sel|poivre)\b/, 1],
];

export function typicalCondimentGrams(name: string): number | null {
  const normalized = normalizeForSearch(name);
  return CONDIMENTS.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}

/** Poids proposé, ramené à la portion habituelle s'il est démesuré pour un assaisonnement. */
export function realisticGrams(name: string, grams: number): number {
  const typical = typicalCondimentGrams(name);
  return typical !== null && grams > typical * 3 ? typical : grams;
}
