import { date, index, numeric, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { MEAL_SLOTS } from "@/domain/meals";

import { user } from "./auth";
import { foods } from "./foods";
import { households } from "./households";
import { mealEntries } from "./journal";

/**
 * Repas partagé : un plat préparé pour plusieurs, saisi une fois par un membre, avec son
 * nombre de parts. Chaque membre concerné le valide (ou non) avant tout ajout à son journal.
 */
export const sharedMeals = pgTable(
  "shared_meals",
  {
    id: uuid().primaryKey().defaultRandom(),
    householdId: uuid()
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    createdBy: uuid().references(() => user.id, { onDelete: "set null" }),
    /** Le plat : une recette (du foyer le plus souvent) ou un aliment. */
    foodId: uuid()
      .notNull()
      .references(() => foods.id, { onDelete: "cascade" }),
    date: date({ mode: "string" }).notNull(),
    slot: text({ enum: MEAL_SLOTS }).notNull(),
    totalParts: numeric({ precision: 4, scale: 1, mode: "number" }).notNull(),
    /** Poids du plat entier ; une part pèse totalGrams / totalParts. */
    totalGrams: numeric({ precision: 7, scale: 1, mode: "number" }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.householdId, t.date)],
);

export const SHARE_STATUSES = ["pending", "accepted", "declined"] as const;
export type ShareStatus = (typeof SHARE_STATUSES)[number];

/** Invitation d'un membre à un repas partagé, et sa réponse. Privée : seul ce membre la voit. */
export const sharedMealShares = pgTable(
  "shared_meal_shares",
  {
    sharedMealId: uuid()
      .notNull()
      .references(() => sharedMeals.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text({ enum: SHARE_STATUSES }).notNull().default("pending"),
    /** Ligne du journal créée à la validation. */
    entryId: uuid().references(() => mealEntries.id, { onDelete: "set null" }),
    respondedAt: timestamp({ withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.sharedMealId, t.userId] }), index().on(t.userId, t.status)],
);
