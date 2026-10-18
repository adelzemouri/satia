import "server-only";

import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { foodCorrections, MEAL_SLOTS, mealEntries } from "@/db/schema";
import { todayIso } from "@/domain/dates";
import { correctionRules, type CorrectionRule, isCorrection, resolveLocally } from "@/domain/meal-text";
import { nutrientsFor } from "@/domain/nutrition";
import { normalizeForSearch, pickForLabel } from "@/domain/search";
import { UNITS } from "@/domain/units";
import { realisticGrams } from "@/domain/condiments";
import { looksUnrelated } from "@/domain/meal-checks";
import { AI_INPUT_METHODS, type DraftItem, type MealDraft } from "@/features/ai/draft";
import type { FoodItem } from "@/features/foods/food-types";
import { analyzeMealPhoto, chooseFoods, estimateFoods, type MealItem, parseMealText } from "@/llm";
import { AiUnavailableError } from "@/llm/types";

import { DomainError } from "./errors";
import { type FoodSummary, getFoods, searchFoods } from "./foods";
import { resolveEntry } from "./journal";
import { isImage, ownsPhoto, PHOTO_MIME_TYPES, storePhoto } from "./photos";

/** Corrections relues pour en tirer les habitudes : les plus récentes suffisent. */
const CORRECTIONS_WINDOW = 300;
/** Habitudes envoyées avec une photo : quelques lignes, pour garder le prompt court. */
const MAX_HABITS_IN_PROMPT = 8;
const ALTERNATIVES = 4;
/** Résultats de recherche soumis à l'IA pour chaque aliment reconnu. */
const CHOICES = 10;

function toFoodItem(food: FoodSummary): FoodItem {
  const { ownerUserId: _owner, servings: _servings, ...item } = food;
  return item;
}

async function rulesFor(userId: string): Promise<Map<string, CorrectionRule>> {
  const rows = await db()
    .select({ aiLabel: foodCorrections.aiLabel, foodId: foodCorrections.foodId, grams: foodCorrections.grams })
    .from(foodCorrections)
    .where(eq(foodCorrections.userId, userId))
    .orderBy(desc(foodCorrections.createdAt))
    .limit(CORRECTIONS_WINDOW);
  return correctionRules(rows);
}

/** Habitudes au format compact du prompt : « riz → Riz blanc, cuit, 200 g ». */
async function habitsForPrompt(userId: string, rules: Map<string, CorrectionRule>): Promise<string[]> {
  const top = [...rules].slice(0, MAX_HABITS_IN_PROMPT);
  const names = new Map(
    (
      await getFoods(
        userId,
        top.map(([, rule]) => rule.foodId),
      )
    ).map((f) => [f.id, f.nameFr]),
  );
  return top.flatMap(([label, rule]) => {
    const name = names.get(rule.foodId);
    return name ? [`${label} → ${name}, ${rule.grams} g`] : [];
  });
}

/**
 * Résultats de recherche pour un nom reconnu par l'IA, et les premiers d'entre eux soumis à son
 * choix, celui de la recherche en tête (il reste proposé si l'IA ne tranche pas).
 */
export async function foodCandidates(userId: string, label: string) {
  const results = await searchFoods(userId, label);
  // Une recette n'est retenue que si l'IA l'a nommée : « beurre de cacahuète » ne devient pas
  // « Fromage blanc, müesli et beurre de cacahuète », qui en contient seulement.
  const found = results.filter((result) => result.source !== "recipe" || !looksUnrelated(result.nameFr, label));
  const picked = pickForLabel(label, found);
  const candidates = (picked ? [picked, ...found.filter((food) => food.id !== picked.id)] : found).slice(0, CHOICES);
  return { results, candidates };
}

/**
 * Aliment de la base retenu pour chaque nom (ingrédients d'un menu ou d'une idée de recette) : la
 * recherche propose, l'IA choisit parmi les premiers résultats en un seul appel pour toute la liste.
 * Une recette du foyer n'est prise que si l'IA l'a nommée : « beurre » ne devient pas un plat au beurre.
 * Sans IA, le choix de la recherche reste ; null quand rien ne convient.
 */
export async function matchFoodNames(userId: string, names: readonly string[]): Promise<(FoodSummary | null)[]> {
  const lines = await Promise.all(names.map((name) => foodCandidates(userId, name)));
  const toChoose = lines.flatMap((line, index) => (line.candidates.length > 0 ? [index] : []));
  let choices: (number | null)[] | null = null;
  if (toChoose.length > 0) {
    try {
      choices = await chooseFoods(
        userId,
        toChoose.map((index) => ({ label: names[index]!, candidates: lines[index]!.candidates.map((f) => f.nameFr) })),
      );
    } catch (error) {
      if (!(error instanceof AiUnavailableError)) throw error;
    }
  }
  const picked: (FoodSummary | null)[] = lines.map((line) => line.candidates[0] ?? null);
  if (choices) {
    toChoose.forEach((index, i) => {
      const choice = choices[i];
      picked[index] = choice === null || choice === undefined ? null : (lines[index]!.candidates[choice] ?? null);
    });
  }
  return picked;
}

/**
 * Transforme les aliments reconnus par l'IA en lignes à confirmer : habitudes apprises
 * d'abord, puis recherche dans la base locale (Ciqual, OFF en cache, aliments perso).
 * Les valeurs nutritionnelles ne sont demandées à l'IA que pour les aliments introuvables.
 */
async function toDraftItems(
  userId: string,
  items: readonly MealItem[],
  rules: Map<string, CorrectionRule>,
): Promise<DraftItem[]> {
  const ruled = await getFoods(
    userId,
    items.flatMap((item) => rules.get(normalizeForSearch(item.name))?.foodId ?? []),
  );
  const ruledById = new Map(ruled.map((food) => [food.id, food]));
  const searched = await Promise.all(
    items.map(async (item) => {
      const aiLabel = normalizeForSearch(item.name);
      const rule = rules.get(aiLabel);
      const habit = (rule && ruledById.get(rule.foodId)) ?? null;
      return { item, aiLabel, habit, ...(await foodCandidates(userId, item.name)) };
    }),
  );
  // L'IA choisit parmi les premiers résultats : la recherche par mots trouve le bon aliment mais
  // le classe parfois mal (« pomme » → pomme séchée, « thé » → feuilles de thé).
  const toChoose = searched.filter((line) => !line.habit && line.candidates.length > 0);
  let choices: (number | null)[] | null = null;
  if (toChoose.length > 0) {
    try {
      choices = await chooseFoods(
        userId,
        toChoose.map((line) => ({ label: line.item.name, candidates: line.candidates.map((food) => food.nameFr) })),
      );
    } catch (error) {
      // Sans IA (plafond atteint, panne), le choix de la recherche reste proposé.
      if (!(error instanceof AiUnavailableError)) throw error;
    }
  }
  // Choix de l'IA par ligne : un aliment, ou null quand aucun résultat ne convient (valeurs estimées).
  const chosen = new Map<(typeof searched)[number], FoodSummary | null>();
  if (choices) {
    toChoose.forEach((line, index) => {
      const choice = choices[index];
      chosen.set(line, choice === null || choice === undefined ? null : (line.candidates[choice] ?? null));
    });
  }
  const drafts = searched.map((line): DraftItem => {
    const { item, aiLabel, results, habit, candidates } = line;
    const food = habit ?? (chosen.has(line) ? chosen.get(line)! : (candidates[0] ?? null));
    const grams = Math.round(realisticGrams(item.name, item.grams));
    const count = item.count ?? null;
    // Des pièces comptées s'affichent en pièces quand l'aliment a un poids à la pièce.
    const byPiece = count !== null && Boolean(food?.unitWeights?.piece);
    return {
      key: randomUUID(),
      label: item.name,
      dish: item.dish ?? null,
      aiLabel,
      proposal: { foodId: food?.id ?? null, grams },
      food: food && toFoodItem(food),
      estimate: null,
      quantity: byPiece ? count : grams,
      unit: byPiece ? "piece" : "g",
      count,
      fromHabit: habit !== null,
      alternatives: [...candidates, ...results]
        .filter((result, i, all) => result.id !== food?.id && all.findIndex((other) => other.id === result.id) === i)
        .slice(0, ALTERNATIVES)
        .map(toFoodItem),
    };
  });
  const missing = drafts.filter((draft) => !draft.food);
  if (missing.length > 0) {
    try {
      const estimates = await estimateFoods(
        userId,
        missing.map((draft) => draft.label),
      );
      missing.forEach((draft, index) => {
        const estimate = estimates[index];
        if (estimate) draft.estimate = { ...estimate, name: draft.label };
      });
    } catch (error) {
      // Sans estimation, l'utilisateur choisit lui-même l'aliment sur l'écran de confirmation.
      if (!(error instanceof AiUnavailableError)) throw error;
    }
  }
  return drafts;
}

const MAX_PHOTO_BYTES = 1_500_000;

export const photoInputSchema = z.object({
  imageBase64: z
    .string()
    .min(100)
    .max(Math.ceil((MAX_PHOTO_BYTES * 4) / 3)),
  mime: z.enum(PHOTO_MIME_TYPES),
  note: z.string().trim().max(200).optional(),
});

/** Saisie par photo : analyse par le modèle vision, puis photo rangée pour le journal. */
export async function analyzePhoto(userId: string, input: z.input<typeof photoInputSchema>): Promise<MealDraft> {
  const data = photoInputSchema.parse(input);
  const bytes = Uint8Array.from(Buffer.from(data.imageBase64, "base64"));
  if (!isImage(bytes, data.mime)) throw new DomainError("invalid_photo");
  const rules = await rulesFor(userId);
  const items = await analyzeMealPhoto(
    userId,
    { mime: data.mime, base64: data.imageBase64 },
    {
      note: data.note,
      habits: await habitsForPrompt(userId, rules),
    },
  );
  const [drafts, photoId] = await Promise.all([
    toDraftItems(userId, items, rules),
    // La photo sert seulement de souvenir dans le journal : son stockage ne bloque pas la saisie.
    storePhoto(userId, bytes, data.mime).catch((error: unknown) => {
      console.error("Stockage de la photo échoué", error);
      return null;
    }),
  ]);
  return { method: "photo", photoId, items: drafts, usedAi: true };
}

export const textInputSchema = z.object({
  text: z.string().trim().min(2, "required").max(500),
  method: z.enum(["voice", "text"]),
});

/**
 * Saisie dictée ou écrite : habitudes apprises d'abord (sans appel), puis le modèle texte
 * si un morceau reste inconnu.
 */
export async function analyzeText(userId: string, input: z.input<typeof textInputSchema>): Promise<MealDraft> {
  const data = textInputSchema.parse(input);
  const rules = await rulesFor(userId);
  const local = resolveLocally(data.text, rules);
  if (local) {
    const foods = new Map(
      (
        await getFoods(
          userId,
          local.map((item) => item.foodId),
        )
      ).map((food) => [food.id, food]),
    );
    const items = local.flatMap((item): DraftItem[] => {
      const food = foods.get(item.foodId);
      if (!food) return [];
      return [
        {
          key: randomUUID(),
          label: item.label,
          aiLabel: item.ruleLabel,
          proposal: { foodId: food.id, grams: item.quantity },
          food: toFoodItem(food),
          estimate: null,
          quantity: item.quantity,
          unit: item.unit,
          fromHabit: true,
          alternatives: [],
        },
      ];
    });
    if (items.length === local.length) return { method: data.method, photoId: null, items, usedAi: false };
  }
  const items = await parseMealText(userId, data.text, {});
  return { method: data.method, photoId: null, items: await toDraftItems(userId, items, rules), usedAi: true };
}

const nutrient = z.number().min(0).max(1000);

export const saveMealSchema = z.object({
  date: z.iso.date(),
  slot: z.enum(MEAL_SLOTS),
  method: z.enum(AI_INPUT_METHODS),
  photoId: z.uuid().nullable(),
  items: z
    .array(
      z.object({
        foodId: z.uuid().nullable(),
        estimate: z
          .object({
            name: z.string().trim().min(1).max(80),
            kcal: nutrient,
            proteinG: nutrient,
            carbsG: nutrient,
            fatG: nutrient,
          })
          .nullable(),
        quantity: z.number().positive().max(10_000),
        unit: z.enum(UNITS),
        aiLabel: z.string().max(80).nullable(),
        dish: z.string().trim().min(1).max(60).nullish(),
        proposal: z.object({ foodId: z.uuid().nullable(), grams: z.number().positive().max(10_000) }).nullable(),
      }),
    )
    .min(1)
    .max(20),
});
export type SaveMealInput = z.input<typeof saveMealSchema>;

/**
 * Ajoute au journal les lignes confirmées (valeurs figées, comme une saisie manuelle) et
 * enregistre chaque correction d'une proposition de l'IA. Renvoie le nombre de lignes.
 */
export async function saveMeal(userId: string, input: SaveMealInput): Promise<number> {
  const data = saveMealSchema.parse(input);
  if (data.date > todayIso()) throw new DomainError("future_date");
  if (data.photoId && !(await ownsPhoto(userId, data.photoId))) throw new DomainError("not_found");
  const rows = await Promise.all(
    data.items.map(async (item) => {
      const base = {
        userId,
        date: data.date,
        slot: data.slot,
        inputMethod: data.method,
        photoId: data.photoId,
        dish: item.dish ?? null,
      };
      if (item.foodId) {
        const { food, grams, nutrients } = await resolveEntry(userId, item.foodId, item.quantity, item.unit);
        const correction =
          item.aiLabel && item.proposal && isCorrection(item.proposal, { foodId: food.id, grams })
            ? { userId, aiLabel: item.aiLabel, aiGrams: item.proposal.grams, foodId: food.id, grams }
            : null;
        const label = food.brand ? `${food.nameFr} (${food.brand})` : food.nameFr;
        const entry = {
          ...base,
          foodId: food.id,
          label,
          quantity: item.quantity,
          unit: item.unit,
          grams,
          ...nutrients,
        };
        return { entry, correction };
      }
      if (!item.estimate || item.unit !== "g") throw new DomainError("food_required");
      const entry = {
        ...base,
        foodId: null,
        label: item.estimate.name,
        quantity: item.quantity,
        unit: item.unit,
        grams: item.quantity,
        ...nutrientsFor(item.estimate, item.quantity),
        isEstimated: true,
      };
      return { entry, correction: null };
    }),
  );
  await db().transaction(async (tx) => {
    await tx.insert(mealEntries).values(rows.map((row) => row.entry));
    const corrections = rows.flatMap((row) => row.correction ?? []);
    if (corrections.length > 0) await tx.insert(foodCorrections).values(corrections);
  });
  return rows.length;
}
