import "server-only";

import { and, asc, desc, eq, gte, inArray, lte, notInArray } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";

import { db } from "@/db/client";
import {
  activities,
  coachMessages,
  coachReviews,
  dailyCheckins,
  dailySteps,
  mealEntries,
  trainingSessions,
  weightEntries,
} from "@/db/schema";
import {
  asksBelowFloor,
  coachContext,
  type DishCandidate,
  mealHistoryLines,
  mentionsMedicalTopic,
  mentionsRiskyPractice,
  promptLine,
  suggestsDailyBelowFloor,
  workoutRequest,
  suggestDish,
} from "@/domain/coach";
import { APP_TIMEZONE } from "@/config/app";
import { longHistoryLines, metabolismLine } from "@/domain/coach-history";
import { type CoachTopic, coachTopicSchema, dayTopicLine, foodTopicLine, mealTopicLine } from "@/domain/coach-topic";
import { todayIso } from "@/domain/dates";
import { addDays } from "@/domain/energy";
import { type MealSlot, skipsBreakfast, slotAt } from "@/domain/meals";
import { CATEGORY_SLOTS, catalogRecipeFor } from "@/domain/recipes/catalog";
import { weightTrend } from "@/domain/weight-trend";
import { RECIPE_PHOTOS } from "@/features/recipes/recipe-photos";
import { AiUnavailableError, coachReply } from "@/llm";

import { metabolismOverview, weekBudget } from "./adaptive";
import { dishPool, getFoodDetails } from "./foods";
import { daySummary, entriesOn } from "./journal";
import { getProfile } from "./profile";
import { checkinOn, dayQualityFor } from "./quality";
import { getCalorieFloors } from "./settings";
import { coachWorkoutLine } from "./training";

/** Derniers échanges envoyés au LLM avec le nouveau message, et nombre de messages gardés. */
const PROMPT_HISTORY = 10;
/** Profondeur de l'historique résumé pour le coach (repas, poids, ressentis, activité). */
const HISTORY_DAYS = 365;
const KEPT_MESSAGES = 100;

const GOAL_LABELS = {
  lose_weight: "perdre du poids",
  maintain: "maintenir son poids",
  gain_muscle: "prendre du muscle",
  eat_balanced: "manger plus équilibré",
} as const;
const SLOT_LABELS = { breakfast: "petit-déjeuner", lunch: "déjeuner", snack: "collation", dinner: "dîner" } as const;

export type CoachMessage = {
  id: string;
  role: "user" | "coach";
  content: string;
  notice: "floor" | "medical" | "care" | null;
  createdAt: Date;
};

export async function listCoachMessages(userId: string, limit = 40): Promise<CoachMessage[]> {
  const rows = await db()
    .select({
      id: coachMessages.id,
      role: coachMessages.role,
      content: coachMessages.content,
      notice: coachMessages.notice,
      createdAt: coachMessages.createdAt,
    })
    .from(coachMessages)
    .where(eq(coachMessages.userId, userId))
    .orderBy(desc(coachMessages.createdAt), desc(coachMessages.role))
    .limit(limit);
  return rows.reverse();
}

/** Repas, poids, ressentis et activité de l'année écoulée, pour le contexte du coach. */
async function historyFor(userId: string, today: string) {
  const since = addDays(today, -HISTORY_DAYS);
  const range = (table: { userId: AnyPgColumn; date: AnyPgColumn }) =>
    and(eq(table.userId, userId), gte(table.date, since), lte(table.date, today));
  const [meals, weighIns, checkins, sessions, freeActivities, steps] = await Promise.all([
    db()
      .select({
        date: mealEntries.date,
        slot: mealEntries.slot,
        label: mealEntries.label,
        dish: mealEntries.dish,
        grams: mealEntries.grams,
        kcal: mealEntries.kcal,
        proteinG: mealEntries.proteinG,
      })
      .from(mealEntries)
      .where(range(mealEntries))
      .orderBy(asc(mealEntries.createdAt)),
    db()
      .select({ date: weightEntries.date, weightKg: weightEntries.weightKg })
      .from(weightEntries)
      .where(range(weightEntries))
      .orderBy(asc(weightEntries.date)),
    db()
      .select({
        date: dailyCheckins.date,
        hunger: dailyCheckins.hunger,
        energy: dailyCheckins.energy,
        mood: dailyCheckins.mood,
      })
      .from(dailyCheckins)
      .where(range(dailyCheckins)),
    db()
      .select({ date: trainingSessions.date, minutes: trainingSessions.durationMin })
      .from(trainingSessions)
      .where(range(trainingSessions)),
    db().select({ date: activities.date, minutes: activities.durationMin }).from(activities).where(range(activities)),
    db().select({ date: dailySteps.date, steps: dailySteps.steps }).from(dailySteps).where(range(dailySteps)),
  ]);
  return { meals, weighIns, checkins, moves: [...sessions, ...freeActivities], steps };
}

/** Totaux par jour saisi (aujourd'hui exclu : la journée n'est pas finie). */
function dayTotals(meals: readonly { date: string; kcal: number; proteinG: number }[], today: string) {
  const days = new Map<string, { date: string; kcal: number; proteinG: number }>();
  for (const meal of meals) {
    if (meal.date === today) continue;
    const day = days.get(meal.date) ?? { date: meal.date, kcal: 0, proteinG: 0 };
    day.kcal += meal.kcal;
    day.proteinG += meal.proteinG;
    days.set(meal.date, day);
  }
  return [...days.values()];
}

/** Contexte du coach : le jour en détail, puis tout l'historique résumé (quelques dizaines de lignes). */
export async function coachContextFor(userId: string, today: string = todayIso()): Promise<string | null> {
  const profile = await getProfile(userId);
  if (!profile) return null;
  const [summary, floors, quality, feeling, week, history, metabolism] = await Promise.all([
    daySummary(userId, today),
    getCalorieFloors(),
    dayQualityFor(userId, today),
    checkinOn(userId, today),
    profile.budgetMode === "weekly" ? weekBudget(userId, today) : null,
    historyFor(userId, today),
    metabolismOverview(userId, today),
  ]);
  const metabolismSummary = metabolism && metabolismLine(metabolism.measurement);
  return coachContext({
    firstName: profile.firstName,
    goal: GOAL_LABELS[profile.goal],
    dateLabel: `Nous sommes le ${today}`,
    slot: SLOT_LABELS[slotAt(new Date(), APP_TIMEZONE)],
    goalKcal: summary.goal?.kcal ?? null,
    consumedKcal: summary.totals.kcal,
    macros: summary.totals,
    macroGoals: summary.goal,
    floorKcal: floors[profile.sex],
    trendKg: weightTrend(history.weighIns.filter((row) => row.date >= addDays(today, -60))).at(-1)?.trendKg ?? null,
    targetKg: profile.targetWeightKg,
    diet: profile.diet,
    foodsToAvoid: profile.foodsToAvoid,
    noBreakfast: skipsBreakfast(profile.mealTimes),
    fiberG: quality.fiberG,
    fruitVegPortions: quality.fruitVegPortions,
    feeling,
    weekly: week && { consumed: week.consumed, total: week.total },
    history: [
      ...mealHistoryLines(history.meals, today, (days) => addDays(today, -days)),
      ...longHistoryLines({
        today,
        days: dayTotals(history.meals, today),
        weights: history.weighIns,
        checkins: history.checkins,
        moves: history.moves,
        steps: history.steps,
      }),
      ...(metabolismSummary ? [metabolismSummary] : []),
    ],
  });
}

export const coachMessageSchema = z.string().trim().min(1).max(500);

/** Ligne qui dit au coach de quoi parle la question posée depuis une page (relue côté serveur). */
export async function coachTopicLine(userId: string, input: CoachTopic): Promise<string> {
  const topic = coachTopicSchema.parse(input);
  if (topic.kind === "food") {
    const food = await getFoodDetails(userId, topic.id);
    return foodTopicLine({
      name: food.nameFr,
      recipe: food.source === "recipe",
      kcal: food.kcal,
      proteinG: food.proteinG,
      carbsG: food.carbsG,
      fatG: food.fatG,
      portionG: food.unitWeights?.portion ?? null,
    });
  }
  if (topic.kind === "meal") return mealTopicLine(topic.date, topic.slot, await entriesOn(userId, topic.date));
  const summary = await daySummary(userId, topic.date);
  return dayTopicLine(topic.date, summary.goal?.kcal ?? null, summary.entries);
}

/**
 * Envoie un message au coach. Une demande sous le plancher, une pratique à risque ou une
 * question de dosage reçoit une réponse locale, sans appel au LLM. Le message n'est enregistré qu'avec sa réponse :
 * si l'IA est indisponible, rien n'est perdu côté formulaire et rien n'est stocké.
 */
export async function sendCoachMessage(userId: string, text: string, topic?: CoachTopic): Promise<CoachMessage> {
  const message = coachMessageSchema.parse(text);
  const profile = await getProfile(userId);
  if (!profile) throw new AiUnavailableError("not_configured");
  const floors = await getCalorieFloors();

  let reply: { content: string; notice: CoachMessage["notice"] };
  if (asksBelowFloor(message, floors[profile.sex])) {
    reply = { content: "", notice: "floor" };
  } else if (mentionsRiskyPractice(message)) {
    reply = { content: "", notice: "care" };
  } else if (mentionsMedicalTopic(message)) {
    reply = { content: "", notice: "medical" };
  } else {
    const workout = workoutRequest(message);
    const [context, history, workoutLine, topicLine] = await Promise.all([
      coachContextFor(userId),
      listCoachMessages(userId, PROMPT_HISTORY),
      workout ? coachWorkoutLine(userId, workout) : null,
      topic ? coachTopicLine(userId, topic) : null,
    ]);
    const conversation = history
      .filter((entry) => entry.notice === null)
      .map((entry) => `${entry.role === "user" ? "Moi" : "Coach"} : ${promptLine(entry.content)}`);
    const prompt = [`Contexte :\n${context}`, workoutLine, ...conversation, topicLine, `Moi : ${promptLine(message)}`]
      .filter(Boolean)
      .join("\n");
    const content = await coachReply(userId, prompt);
    // Dernier filet : une réponse qui proposerait un apport sous le plancher n'est pas montrée.
    reply = suggestsDailyBelowFloor(content, floors[profile.sex])
      ? { content: "", notice: "floor" }
      : { content, notice: null };
  }

  return db().transaction(async (tx) => {
    const now = Date.now();
    await tx.insert(coachMessages).values({ userId, role: "user", content: message, createdAt: new Date(now) });
    const [saved] = await tx
      .insert(coachMessages)
      .values({ userId, role: "coach", ...reply, createdAt: new Date(now + 1) })
      .returning();
    // On ne garde que les derniers messages.
    const kept = tx
      .select({ id: coachMessages.id })
      .from(coachMessages)
      .where(eq(coachMessages.userId, userId))
      .orderBy(desc(coachMessages.createdAt))
      .limit(KEPT_MESSAGES);
    await tx.delete(coachMessages).where(and(eq(coachMessages.userId, userId), notInArray(coachMessages.id, kept)));
    return saved!;
  });
}

export async function clearCoachMessages(userId: string): Promise<void> {
  await db().delete(coachMessages).where(eq(coachMessages.userId, userId));
}

// --- Plat suggéré ---------------------------------------------------------------------

export type SuggestedDish = DishCandidate & { imageUrl: string | null; catalogSlug: string | null };

/**
 * Plat qui convient au repas qui vient et tient dans le budget, choisi parmi les recettes
 * (perso, du foyer et du catalogue) et les favoris, sans appel au LLM.
 */
export async function suggestedDish(
  userId: string,
  { slot, goalKcal, remainingKcal }: { slot: MealSlot; goalKcal: number; remainingKcal: number },
  date: string,
): Promise<SuggestedDish | null> {
  if (remainingKcal < 80) return null;
  const [pool, profile] = await Promise.all([dishPool(userId), getProfile(userId)]);
  // Sans petit-déjeuner, le déjeuner et le dîner ont une part plus grande de l'objectif.
  const noBreakfast = profile ? skipsBreakfast(profile.mealTimes) : false;
  if (pool.length === 0) return null;
  const history = await db()
    .selectDistinct({ foodId: mealEntries.foodId, slot: mealEntries.slot })
    .from(mealEntries)
    .where(
      and(
        eq(mealEntries.userId, userId),
        inArray(
          mealEntries.foodId,
          pool.map((row) => row.id),
        ),
      ),
    );
  const candidates = pool.map((row) => {
    const noted = history.filter((entry) => entry.foodId === row.id).map((entry) => entry.slot);
    const catalog = catalogRecipeFor(row.sourceRef);
    return {
      id: row.id,
      name: row.name,
      portionKcal: Math.round((row.kcal * (row.unitWeights?.portion ?? 100)) / 100),
      imageUrl: row.imageUrl,
      catalogSlug: catalog?.slug ?? null,
      // Une recette du catalogue jamais notée est proposée aux repas de sa catégorie.
      slots: noted.length > 0 || !catalog ? noted : CATEGORY_SLOTS[catalog.category],
    };
  });
  // Seuls les plats qui ont une photo sont proposés ; ceux de la famille passent avant le catalogue.
  const pictured = candidates.filter((candidate) =>
    candidate.catalogSlug ? RECIPE_PHOTOS.has(candidate.catalogSlug) : Boolean(candidate.imageUrl),
  );
  const day = { slot, goalKcal, remainingKcal, noBreakfast };
  const seed = `${userId}:${date}`;
  const dish =
    suggestDish(
      pictured.filter((candidate) => !candidate.catalogSlug),
      day,
      seed,
    ) ??
    suggestDish(
      pictured.filter((candidate) => candidate.catalogSlug),
      day,
      seed,
    );
  return dish ? (candidates.find((candidate) => candidate.id === dish.id) ?? null) : null;
}

/** Pour l'export : conversation et bilans du coach. */
export async function coachExport(userId: string) {
  const [messages, reviews] = await Promise.all([
    db().select().from(coachMessages).where(eq(coachMessages.userId, userId)).orderBy(asc(coachMessages.createdAt)),
    db().select().from(coachReviews).where(eq(coachReviews.userId, userId)).orderBy(asc(coachReviews.weekStart)),
  ]);
  return { messages, reviews };
}
