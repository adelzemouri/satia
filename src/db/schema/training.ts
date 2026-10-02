import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import {
  FEELINGS,
  FOCUSES,
  type LoggedExercise,
  MUSCLES,
  PLACES,
  type PlannedSession,
  TRAINING_GOALS,
  TRAINING_LEVELS,
  type TrainingProfile,
} from "@/domain/training/types";

import { user } from "./auth";

/** Profil sportif (un par personne), complété à la première ouverture de l'espace Training. */
export const trainingProfiles = pgTable("training_profiles", {
  userId: uuid()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  level: text({ enum: TRAINING_LEVELS }).notNull(),
  goal: text({ enum: TRAINING_GOALS }).notNull(),
  place: text({ enum: PLACES }).notNull(),
  equipment: jsonb().$type<TrainingProfile["equipment"]>().notNull().default([]),
  /** Jours disponibles, 0 = lundi. */
  days: jsonb().$type<number[]>().notNull(),
  minutes: integer().notNull(),
  avoidZones: jsonb().$type<TrainingProfile["avoidZones"]>().notNull().default([]),
  /** Exercices signalés douloureux pendant une séance : ils ne sont plus proposés. */
  excluded: jsonb().$type<string[]>().notNull().default([]),
  /** Facteur de progression (1 = départ), ajusté par le ressenti après chaque séance. */
  progression: numeric({ precision: 3, scale: 2, mode: "number" }).notNull().default(1),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** Programme d'une semaine : structure par règles, puis titres et conseils du coach. */
export const trainingPrograms = pgTable(
  "training_programs",
  {
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    weekStart: date({ mode: "string" }).notNull(),
    sessions: jsonb().$type<PlannedSession[]>().notNull(),
    intro: text(),
    /** Passage du coach effectué (ou tenté) : un seul appel au LLM par semaine. */
    personalized: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.weekStart] })],
);

export const SESSION_KINDS = ["program", "replacement", "express", "on_demand"] as const;

/** Séance réalisée : séries saisies, durée, ressenti et calories estimées. */
export const trainingSessions = pgTable(
  "training_sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date({ mode: "string" }).notNull(),
    kind: text({ enum: SESSION_KINDS }).notNull(),
    focus: text({ enum: FOCUSES }).notNull(),
    title: text().notNull(),
    durationMin: integer().notNull(),
    kcal: integer().notNull(),
    feeling: text({ enum: FEELINGS }),
    items: jsonb().$type<LoggedExercise[]>().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId, t.date)],
);

/** Exercices ajoutés par une personne à sa bibliothèque. */
export const customExercises = pgTable("custom_exercises", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text().notNull(),
  muscle: text({ enum: MUSCLES }).notNull(),
  mode: text({ enum: ["reps", "time"] }).notNull(),
  notes: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
