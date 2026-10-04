/**
 * Prompt des photos d'illustration des recettes du foyer : court (facturé à chaque image),
 * en anglais car les modèles d'images le suivent mieux. Style proche des photos du catalogue.
 */
export function recipeImagePrompt(name: string, ingredients: readonly string[]): string {
  return [
    `Appetizing home-cooked dish: "${name}"`,
    ingredients.length > 0 && `(main ingredients: ${ingredients.slice(0, 6).join(", ")})`,
    "served on a simple plate on a light wooden table, natural daylight, three-quarter view,",
    "realistic food photography, no text, no people, no hands, no logo.",
  ]
    .filter(Boolean)
    .join(" ");
}
