import {
  boolean,
  date,
  index,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { MEAL_SLOTS, type MealSlot } from "@/domain/meals";
import { UNITS } from "@/domain/units";

import { user } from "./auth";
import { foods } from "./foods";

export { MEAL_SLOTS, type MealSlot };

export const INPUT_METHODS = ["manual", "barcode", "copy"] as const;

const value = () => numeric({ precision: 7, scale: 1, mode: "number" });

/**
 * Lignes du journal. Les valeurs nutritionnelles sont figées à la saisie :
 * modifier ou supprimer un aliment ne réécrit pas l'historique.
 */
export const mealEntries = pgTable(
  "meal_entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date({ mode: "string" }).notNull(),
    slot: text({ enum: MEAL_SLOTS }).notNull(),
    foodId: uuid().references(() => foods.id, { onDelete: "set null" }),
    label: text().notNull(),
    quantity: numeric({ precision: 7, scale: 2, mode: "number" }).notNull(),
    unit: text({ enum: UNITS }).notNull(),
    grams: value().notNull(),
    kcal: value().notNull(),
    proteinG: value().notNull(),
    carbsG: value().notNull(),
    fatG: value().notNull(),
    isEstimated: boolean().notNull().default(false),
    inputMethod: text({ enum: INPUT_METHODS }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId, t.date), index().on(t.userId, t.foodId)],
);

/** Verres d'eau bus par jour (un verre = 250 ml). */
export const waterLogs = pgTable(
  "water_logs",
  {
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date({ mode: "string" }).notNull(),
    glasses: smallint().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

/** Une pesée par jour ; la tendance lissée est calculée à la volée. */
export const weightEntries = pgTable(
  "weight_entries",
  {
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date({ mode: "string" }).notNull(),
    weightKg: numeric({ precision: 5, scale: 1, mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);
