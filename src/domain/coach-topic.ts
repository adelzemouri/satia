import { z } from "zod";

import { MEAL_SLOTS, type MealSlot } from "./meals";

/**
 * Sujet d'une question posée à Pépin depuis une page (un aliment ou une recette, un repas du
 * journal, une journée). Seuls des identifiants circulent : le serveur relit les données de
 * l'utilisateur pour écrire la ligne envoyée au LLM.
 */
export const coachTopicSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("food"), id: z.uuid() }),
  z.object({ kind: z.literal("meal"), date: z.iso.date(), slot: z.enum(MEAL_SLOTS) }),
  z.object({ kind: z.literal("day"), date: z.iso.date() }),
]);
export type CoachTopic = z.infer<typeof coachTopicSchema>;

/** Questions toutes prêtes selon le sujet ; le texte vit dans `coach.topicQuestions.<clé>`. */
export const TOPIC_QUESTIONS = {
  food: ["goodChoice", "lighter", "pairWith"],
  meal: ["mealBalanced", "whatNext", "mealProtein"],
  day: ["dayReview", "whatNext", "dayMissing"],
} as const satisfies Record<CoachTopic["kind"], readonly string[]>;

export type TopicQuestion = (typeof TOPIC_QUESTIONS)[CoachTopic["kind"]][number];

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "petit-déjeuner",
  lunch: "déjeuner",
  snack: "collation",
  dinner: "dîner",
};

const r = Math.round;
/** Les noms viennent de la base (parfois saisis par la famille) : une seule ligne, longueur bornée. */
const clean = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 80);

export type TopicFood = {
  name: string;
  recipe: boolean;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  portionG: number | null;
};

export function foodTopicLine(food: TopicFood): string {
  const kind = food.recipe ? "la recette" : "l'aliment";
  const per100 = `${r(food.kcal)} kcal, protéines ${r(food.proteinG)} g, glucides ${r(food.carbsG)} g, lipides ${r(food.fatG)} g pour 100 g`;
  const portion = food.portionG ? `, portion ${r(food.portionG)} g (${r((food.kcal * food.portionG) / 100)} kcal)` : "";
  return `Sujet de la question : ${kind} « ${clean(food.name)} » (${per100}${portion}).`;
}

export type TopicEntry = { slot: MealSlot; label: string; grams: number; kcal: number; proteinG: number };

function items(entries: readonly TopicEntry[]): string {
  return entries.map((entry) => `${clean(entry.label)} ${r(entry.grams)} g`).join(", ");
}

function total(entries: readonly TopicEntry[]): string {
  const kcal = entries.reduce((sum, entry) => sum + entry.kcal, 0);
  const protein = entries.reduce((sum, entry) => sum + entry.proteinG, 0);
  return `${r(kcal)} kcal, ${r(protein)} g de protéines`;
}

export function mealTopicLine(date: string, slot: MealSlot, entries: readonly TopicEntry[]): string {
  const meal = entries.filter((entry) => entry.slot === slot);
  const head = `Sujet de la question : son ${SLOT_LABELS[slot]} du ${date}`;
  return meal.length > 0 ? `${head} : ${items(meal)} (${total(meal)}).` : `${head}, rien de saisi.`;
}

export function dayTopicLine(date: string, goalKcal: number | null, entries: readonly TopicEntry[]): string {
  const head = `Sujet de la question : sa journée du ${date}`;
  if (entries.length === 0) return `${head}, rien de saisi.`;
  const meals = MEAL_SLOTS.flatMap((slot) => {
    const meal = entries.filter((entry) => entry.slot === slot);
    return meal.length > 0 ? [`${SLOT_LABELS[slot]} : ${items(meal)}`] : [];
  });
  const goal = goalKcal !== null ? ` sur ${goalKcal}` : "";
  return `${head} : ${meals.join(" ; ")}. Total ${total(entries).replace(" kcal", ` kcal${goal}`)}.`;
}
