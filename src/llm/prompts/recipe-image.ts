/**
 * Prompt des photos d'illustration des recettes du foyer : court (facturé à chaque image),
 * en anglais car les modèles d'images le suivent mieux. Style proche des photos du catalogue.
 */
export function recipeImagePrompt(name: string, ingredients: readonly string[]): string {
  return [
    `Appetizing photo of exactly this dish: "${name}" (French name).`,
    ingredients.length > 0 &&
      `Show only these ingredients, clearly recognizable: ${ingredients.slice(0, 8).join(", ")}.`,
    "Served the way it is usually served (bowl, glass or plate), on a light wooden table, natural daylight, three-quarter view,",
    "realistic food photography, no text, no people, no hands, no logo.",
  ]
    .filter(Boolean)
    .join(" ");
}
