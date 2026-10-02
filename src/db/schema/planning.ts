import { boolean, date, index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { MEAL_SLOTS } from "@/domain/meals";
import { AISLES } from "@/domain/planning";

import { user } from "./auth";
import { foods } from "./foods";
import { households } from "./households";

/** Menu de la semaine, commun au foyer : un plat prévu pour un repas d'un jour. */
export const mealPlanItems = pgTable(
  "meal_plan_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    householdId: uuid()
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    date: date({ mode: "string" }).notNull(),
    slot: text({ enum: MEAL_SLOTS }).notNull(),
    /** Recette du foyer (ou aliment public) ; null pour une simple idée en texte. */
    foodId: uuid().references(() => foods.id, { onDelete: "set null" }),
    label: text().notNull(),
    servings: numeric({ precision: 4, scale: 1, mode: "number" }).notNull(),
    createdBy: uuid().references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.householdId, t.date)],
);

/** Liste de courses du foyer : articles tirés du menu ou ajoutés à la main, cochables par tous. */
export const shoppingItems = pgTable(
  "shopping_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    householdId: uuid()
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    label: text().notNull(),
    /** Quantité calculée depuis le menu, en grammes ; null pour un article saisi à la main. */
    grams: numeric({ precision: 7, scale: 0, mode: "number" }),
    /** Précision libre d'un article saisi à la main (« 2 paquets »). */
    note: text(),
    aisle: text({ enum: AISLES }).notNull().default("other"),
    foodId: uuid().references(() => foods.id, { onDelete: "set null" }),
    fromMenu: boolean().notNull().default(false),
    checked: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.householdId)],
);
