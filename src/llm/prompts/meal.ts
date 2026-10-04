/**
 * Prompts de la saisie IA : courts (ils sont facturés à chaque appel) et en français, car les
 * noms renvoyés sont ensuite cherchés dans la table Ciqual. Les valeurs nutritionnelles
 * viennent de la base locale, jamais de ces deux premiers prompts.
 */

const ITEMS_JSON = '{"items":[{"name":string,"grams":number,"count":number|null,"confidence":number}]}';
const COUNT_RULE =
  "count : nombre de pièces si l'aliment se compte (2 croque-monsieur, 3 œufs), sinon null ; grams reste le poids total.";

export const MEAL_PHOTO_SYSTEM = [
  `Tu identifies les aliments d'une photo de repas. Réponds en JSON : ${ITEMS_JSON}.`,
  "name : nom générique français, comme dans la table Ciqual, avec la cuisson (ex. « riz blanc cuit »).",
  "Sépare les composants d'un plat (pâtes, sauce, fromage râpé). grams : poids comestible visible estimé.",
  COUNT_RULE,
  "confidence : de 0 à 1. Aucune valeur nutritionnelle. Pas d'aliment : items vide.",
].join("\n");

export const MEAL_TEXT_SYSTEM = [
  `Tu convertis la description d'un repas en aliments. Réponds en JSON : ${ITEMS_JSON}.`,
  "name : nom générique français, comme dans la table Ciqual, avec la cuisson (ex. « œuf brouillé »).",
  "grams : poids comestible, celui indiqué sinon une portion habituelle. confidence : de 0 à 1.",
  COUNT_RULE,
  "Aucune valeur nutritionnelle. Pas d'aliment : items vide.",
].join("\n");

export const FOOD_ESTIMATE_SYSTEM = [
  "Donne les valeurs nutritionnelles moyennes pour 100 g de chaque aliment, dans le même ordre.",
  'Réponds en JSON : {"items":[{"name":string,"kcal":number,"proteinG":number,"carbsG":number,"fatG":number}]}.',
].join("\n");

export type PromptContext = {
  /** Précision de l'utilisateur (« sauce à part », « demi-portion »). */
  note?: string | undefined;
  /** Contenants utiles : « grand bol (bol, 500 ml) ». */
  containers?: readonly string[];
  /** Habitudes apprises des corrections : « riz → Riz blanc, cuit, 200 g ». */
  habits?: readonly string[];
};

/** Message utilisateur de la saisie photo ou texte, avec le contexte en lignes courtes. */
export function mealUserPrompt(main: string, context: PromptContext = {}): string {
  return [
    main,
    context.note && `Précision : ${context.note}`,
    context.containers?.length && `Contenants : ${context.containers.join(" ; ")}`,
    context.habits?.length && `Habitudes : ${context.habits.join(" ; ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}
