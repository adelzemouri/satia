/**
 * Prompts de la saisie IA : courts (ils sont facturés à chaque appel) et en français, car les
 * noms renvoyés sont ensuite cherchés dans la table Ciqual. Les valeurs nutritionnelles
 * viennent de la base locale, jamais de ces deux premiers prompts.
 */

const ITEMS_JSON =
  '{"items":[{"name":string,"dish":string|null,"grams":number,"count":number|null,"confidence":number}]}';
const COUNT_RULE =
  "count : nombre de pièces si l'aliment se compte (2 croque-monsieur, 3 œufs), sinon null ; grams reste le poids total.";
const DISH_RULE =
  "dish : nom court du plat dont l'aliment fait partie, identique pour tous ses composants (« Pâtes au saumon », « Salade verte ») ; null pour un aliment seul (pomme, café). Garde les composants d'un même plat à la suite.";
const PORTION_RULE =
  "grams réaliste pour chaque composant, jamais 100 par défaut : assaisonnement et sauce en petite quantité (huile 5-10, vinaigre ou balsamique 5-15, vinaigrette 15-25, mayonnaise 15-20, fromage râpé 10-20, beurre 5-10). Paquet, pot ou bouteille : la portion consommée (1 dose de whey 30, 1 yaourt 125), jamais le poids net imprimé.";

export const MEAL_PHOTO_SYSTEM = [
  `Tu identifies les aliments d'une photo de repas. Réponds en JSON : ${ITEMS_JSON}.`,
  "name : nom générique français, comme dans la table Ciqual, avec la cuisson (ex. « riz blanc cuit »).",
  "Sépare les composants d'un plat (pâtes, sauce, fromage râpé). grams : poids comestible visible estimé.",
  DISH_RULE,
  PORTION_RULE,
  COUNT_RULE,
  "confidence : de 0 à 1. Aucune valeur nutritionnelle. Pas d'aliment : items vide.",
].join("\n");

export const MEAL_TEXT_SYSTEM = [
  `Tu convertis la description d'un repas en aliments. Réponds en JSON : ${ITEMS_JSON}.`,
  "name : nom générique français, comme dans la table Ciqual, avec la cuisson (ex. « œuf brouillé »).",
  "Sépare les composants d'un plat cité (« pâtes au saumon » : pâtes cuites, saumon, crème).",
  "grams : poids comestible, celui indiqué sinon une portion habituelle. confidence : de 0 à 1.",
  "« Un verre » sans boisson nommée : eau, 250 g.",
  "Le texte peut venir d'une dictée : un mot déformé qui sonne comme un aliment ou un plat connu se lit comme ce plat (« m'semen » : msemen).",
  DISH_RULE,
  PORTION_RULE,
  COUNT_RULE,
  "Aucune valeur nutritionnelle. Pas d'aliment : items vide.",
].join("\n");

export const FOOD_MATCH_SYSTEM = [
  "Pour chaque aliment reconnu dans un repas, choisis dans sa liste l'aliment de la table Ciqual qui correspond à ce qui est mangé.",
  "Sans précision, prends la forme courante : fruit ou légume frais (pas sec, pas en purée), thé ou café infusé, viande ou plat nature plutôt qu'un plat composé, jamais un aliment d'une autre nature.",
  'Réponds en JSON : {"choices":[number]}, un numéro par aliment, dans le même ordre ; 0 si aucun ne convient.',
].join("\n");

/** Aliment reconnu et aliments de la base qui pourraient lui correspondre, du plus probable au moins probable. */
export type FoodChoiceRequest = { label: string; candidates: readonly string[] };

/** Une ligne par aliment reconnu : « 1. pomme : 1 Pomme, sèche | 2 Pomme, pulpe, crue ». */
export function foodMatchPrompt(requests: readonly FoodChoiceRequest[]): string {
  return requests
    .map(
      (request, index) =>
        `${index + 1}. ${request.label} : ${request.candidates.map((name, i) => `${i + 1} ${name}`).join(" | ")}`,
    )
    .join("\n");
}

/**
 * Indices retenus dans chaque liste (null : aucun ne convient, ou numéro hors liste). Une réponse
 * qui n'a pas un choix par aliment ne vaut rien : null.
 */
export function chosenIndexes(
  choices: readonly number[],
  requests: readonly FoodChoiceRequest[],
): (number | null)[] | null {
  if (choices.length !== requests.length) return null;
  return choices.map((choice, index) =>
    choice >= 1 && choice <= requests[index]!.candidates.length ? choice - 1 : null,
  );
}

export const FOOD_ESTIMATE_SYSTEM = [
  "Donne les valeurs nutritionnelles moyennes pour 100 g de chaque aliment, dans le même ordre.",
  'Réponds en JSON : {"items":[{"name":string,"kcal":number,"proteinG":number,"carbsG":number,"fatG":number}]}.',
].join("\n");

export type PromptContext = {
  /** Précision de l'utilisateur (« sauce à part », « demi-portion »). */
  note?: string | undefined;
  /** Habitudes apprises des corrections : « riz → Riz blanc, cuit, 200 g ». */
  habits?: readonly string[];
};

/** Message utilisateur de la saisie photo ou texte, avec le contexte en lignes courtes. */
export function mealUserPrompt(main: string, context: PromptContext = {}): string {
  return [
    main,
    context.note && `Précision : ${context.note}`,
    context.habits?.length && `Habitudes : ${context.habits.join(" ; ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}
