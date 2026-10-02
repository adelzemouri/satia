import { date, index, jsonb, numeric, pgTable, smallint, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import type { ACTIVITY_LEVELS } from "@/domain/profile";
import { DIETS, GOALS, PACES, SEXES } from "@/domain/profile";

import { user } from "./auth";

const kg = () => numeric({ precision: 5, scale: 1, mode: "number" });

export const profiles = pgTable("profiles", {
  userId: uuid()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  firstName: text().notNull(),
  sex: text({ enum: SEXES }).notNull(),
  birthDate: date({ mode: "string" }).notNull(),
  heightCm: smallint().notNull(),
  startWeightKg: kg().notNull(),
  targetWeightKg: kg(),
  goal: text({ enum: GOALS }).notNull(),
  activityLevel: smallint().$type<(typeof ACTIVITY_LEVELS)[number]>().notNull(),
  pace: text({ enum: PACES }).notNull(),
  diet: text({ enum: DIETS }).notNull(),
  foodsToAvoid: text().notNull().default(""),
  /** Horaires habituels « HH:MM » par repas, pour les rappels. */
  mealTimes: jsonb().$type<Record<"breakfast" | "lunch" | "dinner", string>>().notNull(),
  /** Objectif d'eau en verres de 250 ml. */
  waterGoalGlasses: smallint().notNull().default(8),
  disclaimerAcceptedAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** Historique des objectifs : un jour passé garde l'objectif qui était en vigueur. */
export const goals = pgTable(
  "goals",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    effectiveFrom: date({ mode: "string" }).notNull(),
    kcal: smallint().notNull(),
    proteinG: smallint().notNull(),
    carbsG: smallint().notNull(),
    fatG: smallint().notNull(),
    source: text({ enum: ["formula", "manual"] }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId), unique().on(t.userId, t.effectiveFrom)],
);
