import { index, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { UNITS } from "@/domain/units";

import { user } from "./auth";
import { foods } from "./foods";

/**
 * Photos de repas envoyées à l'IA, dans le stockage objet privé. Purgées chaque jour :
 * après la durée de conservation réglée par l'admin, ou dès le lendemain si aucun repas
 * ne les utilise.
 */
export const photos = pgTable(
  "photos",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    objectKey: text().notNull().unique(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId), index().on(t.createdAt)],
);

/**
 * Corrections d'une proposition de l'IA (aliment ou quantité) : celles qui reviennent
 * deviennent des règles locales appliquées avant l'appel suivant.
 */
export const foodCorrections = pgTable(
  "food_corrections",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Nom proposé par l'IA, normalisé (voir `normalizeForSearch`). */
    aiLabel: text().notNull(),
    aiGrams: numeric({ precision: 7, scale: 1, mode: "number" }).notNull(),
    foodId: uuid()
      .notNull()
      .references(() => foods.id, { onDelete: "cascade" }),
    grams: numeric({ precision: 7, scale: 1, mode: "number" }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId, t.aiLabel)],
);

export const CONTAINER_KINDS = ["bowl", "plate", "glass", "mug"] as const;
export type ContainerKind = (typeof CONTAINER_KINDS)[number];

/** « Mes contenants » : bols, assiettes, verres et mugs de la maison, pour mieux estimer les quantités. */
export const containers = pgTable(
  "containers",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text().notNull(),
    kind: text({ enum: CONTAINER_KINDS }).notNull(),
    volumeMl: numeric({ precision: 6, scale: 0, mode: "number" }),
    diameterCm: numeric({ precision: 4, scale: 1, mode: "number" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId)],
);

/** Dictionnaire personnel : « ma tartine » → un aliment et une quantité, reconnus sans appel à l'IA. */
export const personalExpressions = pgTable(
  "personal_expressions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    phrase: text().notNull(),
    phraseNormalized: text().notNull(),
    foodId: uuid()
      .notNull()
      .references(() => foods.id, { onDelete: "cascade" }),
    quantity: numeric({ precision: 7, scale: 2, mode: "number" }).notNull(),
    unit: text({ enum: UNITS }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.phraseNormalized)],
);
