import { boolean, date, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { FASTING_PROTOCOLS, type FastingPlan } from "@/domain/fasting";

import { user } from "./auth";

/** Planning de jeûne intermittent (un par personne). */
export const fastingPlans = pgTable("fasting_plans", {
  userId: uuid()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  plan: jsonb().$type<FastingPlan>().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const FAST_SOURCES = ["manual", "auto"] as const;

/** Jeûnes réalisés ou en cours (fin vide = en cours). */
export const fasts = pgTable(
  "fasts",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    startedAt: timestamp({ withTimezone: true }).notNull(),
    endedAt: timestamp({ withTimezone: true }),
    targetMinutes: integer().notNull(),
    protocol: text({ enum: FASTING_PROTOCOLS }).notNull(),
    source: text({ enum: FAST_SOURCES }).notNull().default("manual"),
  },
  (t) => [index().on(t.userId, t.startedAt)],
);

/**
 * Traitements suivis (ex. GLP-1) : un nom libre et, si on le souhaite, un rappel.
 * Aucune dose n'est stockée ni calculée.
 */
export const treatments = pgTable("treatments", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text().notNull(),
  /** Heure du rappel « HH:MM », ou aucun rappel. */
  reminderTime: text(),
  /** Jours du rappel, 0 = lundi. */
  reminderDays: jsonb().$type<number[]>().notNull().default([]),
  active: boolean().notNull().default(true),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** Journal des prises : date, heure, nom libre et note. */
export const treatmentLogs = pgTable(
  "treatment_logs",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    treatmentId: uuid().references(() => treatments.id, { onDelete: "set null" }),
    name: text().notNull(),
    date: date({ mode: "string" }).notNull(),
    time: text().notNull(),
    note: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId, t.date)],
);
