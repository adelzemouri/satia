import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import type { CountUnit } from "@/domain/units";

import { user } from "./auth";
import { households } from "./households";

export const FOOD_SOURCES = ["ciqual", "off", "custom", "recipe"] as const;
export type FoodSource = (typeof FOOD_SOURCES)[number];

/** Valeur nutritionnelle pour 100 g (ou 100 ml ramenés en grammes). */
const per100 = () => numeric({ precision: 7, scale: 2, mode: "number" });

/**
 * Aliments : table Ciqual, produits Open Food Facts mis en cache, aliments personnels
 * et recettes (une recette est un aliment dont les valeurs viennent de ses ingrédients).
 */
export const foods = pgTable(
  "foods",
  {
    id: uuid().primaryKey().defaultRandom(),
    source: text({ enum: FOOD_SOURCES }).notNull(),
    /** Code Ciqual ou code-barres OFF ; null pour les aliments personnels. */
    sourceRef: text(),
    /** Propriétaire d'un aliment personnel ou d'une recette ; null pour les aliments publics. */
    ownerUserId: uuid().references(() => user.id, { onDelete: "cascade" }),
    /** Recette du foyer : visible et modifiable par tous ses membres (alors sans propriétaire). */
    householdId: uuid().references(() => households.id, { onDelete: "cascade" }),
    nameFr: text().notNull(),
    nameEn: text(),
    brand: text(),
    groupFr: text(),
    /** Nom normalisé (sans accents) pour la recherche floue, voir `normalizeForSearch`. */
    searchName: text().notNull(),
    kcal: per100().notNull(),
    proteinG: per100().notNull(),
    carbsG: per100().notNull(),
    fatG: per100().notNull(),
    fiberG: per100(),
    sugarsG: per100(),
    saltG: per100(),
    densityGPerMl: numeric({ precision: 4, scale: 2, mode: "number" }),
    unitWeights: jsonb().$type<Partial<Record<CountUnit, number>>>(),
    /** Nombre de portions d'une recette. */
    servings: smallint(),
    /** Photo du produit hébergée par Open Food Facts (CC BY-SA), affichée telle quelle. */
    imageUrl: text(),
    fetchedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.source, t.sourceRef),
    index().on(t.ownerUserId),
    index().on(t.householdId),
    index("foods_search_name_trgm").using("gin", sql`${t.searchName} gin_trgm_ops`),
  ],
);

/** Ingrédients d'une recette, en grammes. */
export const recipeItems = pgTable(
  "recipe_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    recipeId: uuid()
      .notNull()
      .references(() => foods.id, { onDelete: "cascade" }),
    foodId: uuid()
      .notNull()
      .references(() => foods.id, { onDelete: "no action" }),
    grams: numeric({ precision: 7, scale: 1, mode: "number" }).notNull(),
    position: smallint().notNull(),
  },
  (t) => [index().on(t.recipeId)],
);

export const favorites = pgTable(
  "favorites",
  {
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    foodId: uuid()
      .notNull()
      .references(() => foods.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.foodId] })],
);
