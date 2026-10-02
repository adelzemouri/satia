/** Planification (calcul pur) : rayons, liste de courses tirée du menu. */

export const AISLES = ["produce", "meat_fish", "dairy", "bakery", "grocery", "drinks", "other"] as const;
export type Aisle = (typeof AISLES)[number];

const AISLE_RULES: [Aisle, RegExp][] = [
  ["produce", /^légumes|^fruits$|^herbes|pommes de terre|^salades|algues/],
  ["meat_fish", /viande|poisson|charcuterie|mollusque|crustacé|volaille|produits de la mer/],
  ["dairy", /laitier|fromage|lait|œuf|oeuf|beurre|crème|margarine/],
  ["bakery", /pain|viennoiserie|pâtisserie/],
  ["drinks", /boisson|eau/],
  [
    "grocery",
    /pâtes|riz|céréale|légumineuse|huile|épice|sauce|sucre|biscuit|chocolat|fruits à coque|condiment|confiserie|ingrédients|^sels|aides culinaires|confiture|miel/,
  ],
];

/** Rayon d'un aliment d'après son groupe Ciqual (ou « autres »). */
export function aisleOf(group: string | null): Aisle {
  if (!group) return "other";
  const name = group.toLowerCase();
  return AISLE_RULES.find(([, pattern]) => pattern.test(name))?.[0] ?? "other";
}

export type PlannedDish = {
  /** Ingrédients d'une portion de la recette, ou l'aliment lui-même. */
  ingredients: { foodId: string; name: string; group: string | null; gramsPerServing: number }[];
  servings: number;
};

export type ShoppingLine = { foodId: string; name: string; grams: number; aisle: Aisle };

/** Additionne les ingrédients des plats du menu, multipliés par leur nombre de parts. */
export function shoppingFromPlan(dishes: readonly PlannedDish[]): ShoppingLine[] {
  const lines = new Map<string, ShoppingLine>();
  for (const dish of dishes) {
    for (const ingredient of dish.ingredients) {
      const grams = ingredient.gramsPerServing * dish.servings;
      const line = lines.get(ingredient.foodId);
      if (line) line.grams += grams;
      else
        lines.set(ingredient.foodId, {
          foodId: ingredient.foodId,
          name: ingredient.name,
          grams,
          aisle: aisleOf(ingredient.group),
        });
    }
  }
  return [...lines.values()]
    .map((line) => ({ ...line, grams: roundForShopping(line.grams) }))
    .sort((a, b) => AISLES.indexOf(a.aisle) - AISLES.indexOf(b.aisle) || a.name.localeCompare(b.name, "fr"));
}

/** Arrondi lisible en magasin : 5 g sous 100 g, 10 g sous 1 kg, 50 g au-delà. */
export function roundForShopping(grams: number): number {
  const step = grams < 100 ? 5 : grams < 1000 ? 10 : 50;
  return Math.max(step, Math.round(grams / step) * step);
}
