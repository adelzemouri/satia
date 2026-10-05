import type { Nutrients } from "@/domain/nutrition";
import type { Unit } from "@/domain/units";
import type { FoodItem } from "@/features/foods/food-types";

export const AI_INPUT_METHODS = ["photo", "voice", "text"] as const;
export type AiInputMethod = (typeof AI_INPUT_METHODS)[number];

/** Aliment absent de la base : valeurs pour 100 g estimées par l'IA, marquées « estimé ». */
export type FoodEstimateValues = Nutrients & { name: string };

/** Une ligne proposée sur l'écran de confirmation, avant ajout au journal. */
export type DraftItem = {
  key: string;
  /** Ce que l'IA (ou le texte) a reconnu, affiché pour comprendre la proposition. */
  label: string;
  /** Plat reconnu par l'IA (« Pâtes au saumon »), pour regrouper ses composants. */
  dish?: string | null;
  /** Nom proposé par l'IA, normalisé ; null pour une expression du dictionnaire personnel. */
  aiLabel: string | null;
  /** Proposition initiale, pour repérer une correction de l'utilisateur. */
  proposal: { foodId: string | null; grams: number } | null;
  food: FoodItem | null;
  estimate: FoodEstimateValues | null;
  quantity: number;
  unit: Unit;
  /** Nombre de pièces vues par l'IA, pour expliquer un poids proposé en grammes. */
  count?: number | null;
  /** Aliment tiré d'une habitude apprise ou du dictionnaire personnel : déjà validé par l'utilisateur. */
  fromHabit?: boolean;
  /** Autres aliments proches dans la base, pour corriger en un tap. */
  alternatives: FoodItem[];
};

export type MealDraft = {
  method: AiInputMethod;
  photoId: string | null;
  items: DraftItem[];
  /** false quand tout a été reconnu par le dictionnaire ou les habitudes, sans appel à l'IA. */
  usedAi: boolean;
};
