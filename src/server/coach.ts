import "server-only";

import { and, asc, desc, eq, gte, inArray, lte, notInArray, sum } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import {
  coachMessages,
  coachReviews,
  dailyCheckins,
  mealEntries,
  metabolismChecks,
  profiles,
  weightEntries,
} from "@/db/schema";
import {
  asksBelowFloor,
  coachContext,
  type DayStats,
  type DishCandidate,
  mealHistoryLines,
  mentionsMedicalTopic,
  mentionsRiskyPractice,
  promptLine,
  suggestsDailyBelowFloor,
  workoutRequest,
  suggestDish,
  weekStats,
} from "@/domain/coach";
import { APP_TIMEZONE } from "@/config/app";
import { todayIso } from "@/domain/dates";
import { addDays } from "@/domain/energy";
import { type MealSlot, slotAt } from "@/domain/meals";
import { COACH_STYLES, type CoachStyle } from "@/domain/profile";
import { weekQuality } from "@/domain/quality";
import { CATEGORY_SLOTS, catalogRecipeFor } from "@/domain/recipes/catalog";
import { isoWeekStart } from "@/domain/streak";
import { weightTrend } from "@/domain/weight-trend";
import { RECIPE_PHOTOS } from "@/features/recipes/recipe-photos";
import { AiUnavailableError, coachReply, writeWeeklyReview } from "@/llm";

import { weekBudget } from "./adaptive";
import { dishPool } from "./foods";
import { daySummary } from "./journal";
import { getGoalOn, getProfile } from "./profile";
import { checkinOn, dayQualityFor, qualityItems } from "./quality";
import { getCalorieFloors } from "./settings";
import { coachWorkoutLine } from "./training";

/** Derniers échanges envoyés au LLM avec le nouveau message, et nombre de messages gardés. */
const PROMPT_HISTORY = 10;
/** Jours de repas passés résumés pour le coach. */
const MEAL_HISTORY_DAYS = 14;
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

/** Contexte compact du jour pour le coach (quelques lignes). */
export async function coachContextFor(userId: string, today: string = todayIso()): Promise<string | null> {
  const profile = await getProfile(userId);
  if (!profile) return null;
  const [summary, floors, quality, feeling, week, weighIns, meals] = await Promise.all([
    daySummary(userId, today),
    getCalorieFloors(),
    dayQualityFor(userId, today),
    checkinOn(userId, today),
    profile.budgetMode === "weekly" ? weekBudget(userId, today) : null,
    db()
      .select({ date: weightEntries.date, weightKg: weightEntries.weightKg })
      .from(weightEntries)
      .where(and(eq(weightEntries.userId, userId), gte(weightEntries.date, addDays(today, -60))))
      .orderBy(asc(weightEntries.date)),
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
      .where(
        and(
          eq(mealEntries.userId, userId),
          gte(mealEntries.date, addDays(today, -MEAL_HISTORY_DAYS)),
          lte(mealEntries.date, today),
        ),
      )
      .orderBy(asc(mealEntries.createdAt)),
  ]);
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
    trendKg: weightTrend(weighIns).at(-1)?.trendKg ?? null,
    targetKg: profile.targetWeightKg,
    diet: profile.diet,
    foodsToAvoid: profile.foodsToAvoid,
    fiberG: quality.fiberG,
    fruitVegPortions: quality.fruitVegPortions,
    feeling,
    weekly: week && { consumed: week.consumed, total: week.total },
    history: mealHistoryLines(meals, today, (days) => addDays(today, -days)),
  });
}

export const coachMessageSchema = z.string().trim().min(1).max(500);

/**
 * Envoie un message au coach. Une demande sous le plancher, une pratique à risque ou une
 * question de dosage reçoit une réponse locale, sans appel au LLM. Le message n'est enregistré qu'avec sa réponse :
 * si l'IA est indisponible, rien n'est perdu côté formulaire et rien n'est stocké.
 */
export async function sendCoachMessage(userId: string, text: string): Promise<CoachMessage> {
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
    const [context, history, workoutLine] = await Promise.all([
      coachContextFor(userId),
      listCoachMessages(userId, PROMPT_HISTORY),
      workout ? coachWorkoutLine(userId, workout) : null,
    ]);
    const conversation = history
      .filter((entry) => entry.notice === null)
      .map((entry) => `${entry.role === "user" ? "Moi" : "Coach"} : ${promptLine(entry.content)}`);
    const prompt = [`Contexte :\n${context}`, workoutLine, ...conversation, `Moi : ${promptLine(message)}`]
      .filter(Boolean)
      .join("\n");
    const content = await coachReply(userId, profile.coachStyle, prompt);
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

export async function setCoachStyle(userId: string, style: CoachStyle): Promise<void> {
  await db()
    .update(profiles)
    .set({ coachStyle: z.enum(COACH_STYLES).parse(style), updatedAt: new Date() })
    .where(eq(profiles.userId, userId));
}

// --- Bilan hebdomadaire ------------------------------------------------------------

export type CoachReview = typeof coachReviews.$inferSelect;

/** Bilan de la semaine écoulée, s'il a déjà été rédigé. */
export async function lastWeekReview(userId: string, today: string = todayIso()): Promise<CoachReview | null> {
  const weekStart = addDays(isoWeekStart(today), -7);
  const [row] = await db()
    .select()
    .from(coachReviews)
    .where(and(eq(coachReviews.userId, userId), eq(coachReviews.weekStart, weekStart)));
  return row ?? null;
}

/** Il faut au moins 3 jours saisis la semaine écoulée pour qu'un bilan ait du sens. */
const MIN_DAYS_FOR_REVIEW = 3;

/** Données de la semaine écoulée, en lignes courtes pour le prompt ; null s'il y a trop peu de saisies. */
export async function weeklyReviewData(userId: string, today: string = todayIso()): Promise<string | null> {
  const from = addDays(isoWeekStart(today), -7);
  const to = addDays(from, 6);
  const goal = await getGoalOn(userId, to);
  if (!goal) return null;
  const [intakes, checkins, items, check] = await Promise.all([
    db()
      .select({
        date: mealEntries.date,
        kcal: sum(mealEntries.kcal).mapWith(Number),
        proteinG: sum(mealEntries.proteinG).mapWith(Number),
      })
      .from(mealEntries)
      .where(and(eq(mealEntries.userId, userId), gte(mealEntries.date, from), lte(mealEntries.date, to)))
      .groupBy(mealEntries.date),
    db()
      .select({ date: dailyCheckins.date, energy: dailyCheckins.energy, mood: dailyCheckins.mood })
      .from(dailyCheckins)
      .where(and(eq(dailyCheckins.userId, userId), gte(dailyCheckins.date, from), lte(dailyCheckins.date, to))),
    qualityItems(userId, from, to),
    db()
      .select()
      .from(metabolismChecks)
      .where(and(eq(metabolismChecks.userId, userId), eq(metabolismChecks.weekStart, isoWeekStart(today)))),
  ]);
  const byDate = new Map(intakes.map((row) => [row.date, row]));
  const energyByDate = new Map(checkins.map((row) => [row.date, row.energy]));
  const days: DayStats[] = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(from, index);
    const intake = byDate.get(date);
    return {
      date,
      kcal: intake?.kcal ?? 0,
      proteinG: intake?.proteinG ?? 0,
      logged: intake !== undefined,
      energy: energyByDate.get(date) ?? null,
    };
  });
  const stats = weekStats(days, goal.proteinG);
  if (stats.daysLogged < MIN_DAYS_FOR_REVIEW) return null;
  const quality = weekQuality(items);
  const moods = checkins.flatMap((row) => (row.mood === null ? [] : [row.mood]));
  const metabolism = check[0];

  return [
    `Semaine du ${from} au ${to}. Jours saisis : ${stats.daysLogged}/7.`,
    `Apport moyen : ${stats.averageKcal} kcal (objectif ${goal.kcal}). Protéines : ${stats.averageProteinG} g (objectif ${goal.proteinG}).`,
    quality &&
      `Fibres ${quality.fiberPerDay} g/j, fruits et légumes ${quality.fruitVegPortionsPerDay} portions/j, sel ${quality.saltPerDay} g/j` +
        (quality.ultraProcessedShare !== null
          ? `, ultra-transformés ${Math.round(quality.ultraProcessedShare * 100)} % des calories connues.`
          : "."),
    metabolism?.status === "adjusted" &&
      `Objectif ajusté de ${metabolism.kcalBefore} à ${metabolism.kcalAfter} kcal d'après la dépense mesurée (${metabolism.measuredTdee} kcal).`,
    stats.energyLowProtein !== null &&
      stats.energyOtherDays !== null &&
      `Énergie moyenne : ${stats.energyLowProtein}/5 les jours pauvres en protéines, ${stats.energyOtherDays}/5 les autres.`,
    moods.length > 0 &&
      `Humeur moyenne : ${Math.round((moods.reduce((a, b) => a + b, 0) / moods.length) * 10) / 10}/5.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Bilan de la semaine écoulée : rédigé une seule fois (1 appel au LLM par utilisateur et par
 * semaine), à la première visite du coach. Null s'il y a trop peu de données ou si l'IA est
 * indisponible.
 */
export async function ensureWeeklyReview(userId: string, today: string = todayIso()): Promise<CoachReview | null> {
  const existing = await lastWeekReview(userId, today);
  if (existing) return existing;
  const [profile, data] = await Promise.all([getProfile(userId), weeklyReviewData(userId, today)]);
  if (!profile || !data) return null;
  try {
    const content = await writeWeeklyReview(userId, profile.coachStyle, data);
    await db()
      .insert(coachReviews)
      .values({ userId, weekStart: addDays(isoWeekStart(today), -7), content })
      .onConflictDoNothing();
  } catch (error) {
    if (error instanceof AiUnavailableError) return null;
    throw error;
  }
  return lastWeekReview(userId, today);
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
  const pool = await dishPool(userId);
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
  const day = { slot, goalKcal, remainingKcal };
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
