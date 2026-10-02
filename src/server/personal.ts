import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { CONTAINER_KINDS, containers, foods, personalExpressions } from "@/db/schema";
import { normalizeForSearch } from "@/domain/search";
import { toGrams, UNITS } from "@/domain/units";

import { DomainError } from "./errors";
import { getFood } from "./foods";

/** « Mes contenants » et dictionnaire personnel : propres à chaque utilisateur. */

export type Container = typeof containers.$inferSelect;

export const containerSchema = z
  .object({
    name: z.string().trim().min(1, "required").max(60),
    kind: z.enum(CONTAINER_KINDS),
    volumeMl: z.number().int().min(10).max(5000).nullable(),
    diameterCm: z.number().min(3).max(60).nullable(),
  })
  .refine((value) => value.volumeMl !== null || value.diameterCm !== null, {
    path: ["volumeMl"],
    message: "container_size_required",
  });

export async function listContainers(userId: string): Promise<Container[]> {
  return db().select().from(containers).where(eq(containers.userId, userId)).orderBy(asc(containers.name));
}

export async function createContainer(userId: string, input: z.input<typeof containerSchema>): Promise<string> {
  const data = containerSchema.parse(input);
  const [row] = await db()
    .insert(containers)
    .values({ userId, ...data })
    .returning({ id: containers.id });
  return row!.id;
}

export async function deleteContainer(userId: string, id: string): Promise<void> {
  await db()
    .delete(containers)
    .where(and(eq(containers.id, z.uuid().parse(id)), eq(containers.userId, userId)));
}

export type ExpressionRow = {
  id: string;
  phrase: string;
  phraseNormalized: string;
  foodId: string;
  foodName: string;
  quantity: number;
  unit: (typeof UNITS)[number];
};

export const expressionSchema = z.object({
  phrase: z.string().trim().min(2, "required").max(60),
  foodId: z.uuid(),
  quantity: z.number().positive().max(10_000),
  unit: z.enum(UNITS),
});

export async function listExpressions(userId: string): Promise<ExpressionRow[]> {
  return db()
    .select({
      id: personalExpressions.id,
      phrase: personalExpressions.phrase,
      phraseNormalized: personalExpressions.phraseNormalized,
      foodId: personalExpressions.foodId,
      foodName: foods.nameFr,
      quantity: personalExpressions.quantity,
      unit: personalExpressions.unit,
    })
    .from(personalExpressions)
    .innerJoin(foods, eq(foods.id, personalExpressions.foodId))
    .where(eq(personalExpressions.userId, userId))
    .orderBy(asc(personalExpressions.phrase));
}

/** Ajoute ou remplace une expression (« ma tartine » → aliment, quantité, unité). */
export async function saveExpression(userId: string, input: z.input<typeof expressionSchema>): Promise<string> {
  const data = expressionSchema.parse(input);
  const phraseNormalized = normalizeForSearch(data.phrase);
  if (phraseNormalized.length < 2) throw new DomainError("invalid_form");
  const food = await getFood(userId, data.foodId);
  if (toGrams(data.quantity, data.unit, food) === null) throw new DomainError("unit_not_available");
  const values = { phrase: data.phrase, foodId: food.id, quantity: data.quantity, unit: data.unit };
  const [row] = await db()
    .insert(personalExpressions)
    .values({ userId, phraseNormalized, ...values })
    .onConflictDoUpdate({ target: [personalExpressions.userId, personalExpressions.phraseNormalized], set: values })
    .returning({ id: personalExpressions.id });
  return row!.id;
}

export async function deleteExpression(userId: string, id: string): Promise<void> {
  await db()
    .delete(personalExpressions)
    .where(and(eq(personalExpressions.id, z.uuid().parse(id)), eq(personalExpressions.userId, userId)));
}
