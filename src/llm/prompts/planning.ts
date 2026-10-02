/**
 * Prompts de la planification : menu de la semaine et idées à partir du frigo. Les plats
 * proposés donnent leurs ingrédients et grammages ; les calories sont calculées ensuite
 * depuis la base locale, jamais par l'IA.
 */

const DISH_JSON = '{"name":string,"ingredients":[{"name":string,"grams":number}]}';

export const MENU_PLAN_SYSTEM = [
  "Tu composes un menu familial varié, simple à cuisiner, en français.",
  `Réponds en JSON : {"meals":[{"day":number,"slot":"breakfast"|"lunch"|"dinner","recipe":number|null,"name":string,"ingredients":[{"name":string,"grams":number}]}]}.`,
  "Un repas par créneau demandé. recipe : numéro d'une recette de la liste si elle convient (name et ingredients vides), sinon null avec un nouveau plat.",
  "Pour un nouveau plat : ingrédients crus d'une portion, noms génériques comme dans la table Ciqual (ex. « lentille corail crue »).",
  "Respecte le régime et les aliments à éviter. Vise l'objectif calorique par repas indiqué. Pas de valeur nutritionnelle.",
].join("\n");

export const FRIDGE_SYSTEM = [
  "Tu identifies les ingrédients visibles d'un frigo ou d'un placard, puis proposes 3 plats simples qui les utilisent.",
  `Réponds en JSON : {"ingredients":[string],"ideas":[${DISH_JSON}]}.`,
  "Noms génériques français comme dans la table Ciqual. Ingrédients d'une portion, crus, en grammes ; tu peux ajouter des basiques (huile, sel, épices).",
  "Respecte le régime et les aliments à éviter. Vise le budget calorique indiqué pour une portion. Pas de valeur nutritionnelle.",
].join("\n");
