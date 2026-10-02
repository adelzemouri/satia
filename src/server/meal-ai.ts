import "server-only";

import { randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { type ContainerKind, containers, foodCorrections, MEAL_SLOTS, mealEntries } from "@/db/schema";
import { todayIso } from "@/domain/dates";
import { correctionRules, type CorrectionRule, isCorrection, resolveLocally } from "@/domain/meal-text";
import { nutrientsFor } from "@/domain/nutrition";
import { normalizeForSearch } from "@/domain/search";
import { UNITS } from "@/domain/units";
import { AI_INPUT_METHODS, type DraftItem, type MealDraft } from "@/features/ai/draft";
import type { FoodItem } from "@/features/foods/food-types";
import { analyzeMealPhoto, estimateFoods, type MealItem, parseMealText } from "@/llm";
import { AiUnavailableError } from "@/llm/types";

import { DomainError } from "./errors";
import { type FoodSummary, getFoods, searchFoods } from "./foods";
import { resolveEntry } from "./journal";
import { listContainers, listExpressions } from "./personal";
import { ownsPhoto, PHOTO_MIME_TYPES, storePhoto } from "./photos";

/** Corrections relues pour en tirer les habitudes : les plus récentes suffisent. */
const CORRECTIONS_WINDOW = 300;
/** Habitudes envoyées avec une photo : quelques lignes, pour garder le prompt court. */
const MAX_HABITS_IN_PROMPT = 8;
const ALTERNATIVES = 4;

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

const KIND_NAMES: Record<ContainerKind, string> = { bowl: "bol", plate: "assiette", glass: "verre", mug: "mug" };

function describeContainer(container: {
  name: string;
  kind: ContainerKind;
  volumeMl: number | null;
  diameterCm: number | null;
}): string {
  const size = [container.volumeMl && `${container.volumeMl} ml`, container.diameterCm && `${container.diameterCm} cm`];
  return `${container.name} (${[KIND_NAMES[container.kind], ...size].filter(Boolean).join(", ")})`;
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
  const drafts = await Promise.all(
    items.map(async (item): Promise<DraftItem> => {
      const aiLabel = normalizeForSearch(item.name);
      const results = await searchFoods(userId, item.name);
      const rule = rules.get(aiLabel);
      const food = (rule && ruledById.get(rule.foodId)) ?? results[0] ?? null;
      const grams = Math.round(item.grams);
      return {
        key: randomUUID(),
        label: item.name,
        aiLabel,
        proposal: { foodId: food?.id ?? null, grams },
        food: food && toFoodItem(food),
        estimate: null,
        quantity: grams,
        unit: "g",
        alternatives: results
          .filter((result) => result.id !== food?.id)
          .slice(0, ALTERNATIVES)
          .map(toFoodItem),
      };
    }),
  );
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
  containerId: z.uuid().nullable().optional(),
});

/** Vérifie la signature du fichier : JPEG (FF D8 FF) ou WebP (RIFF....WEBP). */
export function isImage(bytes: Uint8Array, mime: (typeof PHOTO_MIME_TYPES)[number]): boolean {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
}

/** Saisie par photo : analyse par le modèle vision, puis photo rangée pour le journal. */
export async function analyzePhoto(userId: string, input: z.input<typeof photoInputSchema>): Promise<MealDraft> {
  const data = photoInputSchema.parse(input);
  const bytes = Uint8Array.from(Buffer.from(data.imageBase64, "base64"));
  if (!isImage(bytes, data.mime)) throw new DomainError("invalid_photo");
  const [rules, container] = await Promise.all([
    rulesFor(userId),
    data.containerId
      ? db()
          .select()
          .from(containers)
          .where(and(eq(containers.id, data.containerId), eq(containers.userId, userId)))
          .then((rows) => rows[0])
      : undefined,
  ]);
  const items = await analyzeMealPhoto(
    userId,
    { mime: data.mime, base64: data.imageBase64 },
    {
      note: data.note,
      containers: container ? [describeContainer(container)] : [],
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
 * Saisie dictée ou écrite : dictionnaire personnel et habitudes d'abord (sans appel), puis
 * le modèle texte si un morceau reste inconnu.
 */
export async function analyzeText(userId: string, input: z.input<typeof textInputSchema>): Promise<MealDraft> {
  const data = textInputSchema.parse(input);
  const [expressions, rules] = await Promise.all([listExpressions(userId), rulesFor(userId)]);
  const local = resolveLocally(data.text, expressions, rules);
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
          proposal: item.ruleLabel ? { foodId: food.id, grams: item.quantity } : null,
          food: toFoodItem(food),
          estimate: null,
          quantity: item.quantity,
          unit: item.unit,
          alternatives: [],
        },
      ];
    });
    if (items.length === local.length) return { method: data.method, photoId: null, items, usedAi: false };
  }
  // Seuls les contenants cités dans le texte sont envoyés, pour garder le prompt court.
  const text = normalizeForSearch(data.text);
  const cited = (await listContainers(userId)).filter((container) => text.includes(normalizeForSearch(container.name)));
  const items = await parseMealText(userId, data.text, { containers: cited.map(describeContainer) });
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
      const base = { userId, date: data.date, slot: data.slot, inputMethod: data.method, photoId: data.photoId };
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
