import { date, index, integer, numeric, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { ACTIVITY_TYPES, INTENSITIES, MEASUREMENT_KINDS, POSES } from "@/domain/activity";

import { user } from "./auth";

/** Mensurations : une valeur par jour et par tour mesuré. */
export const bodyMeasurements = pgTable(
  "body_measurements",
  {
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date({ mode: "string" }).notNull(),
    kind: text({ enum: MEASUREMENT_KINDS }).notNull(),
    valueCm: numeric({ precision: 4, scale: 1, mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date, t.kind] })],
);

/** Photos de progression : privées, jamais envoyées au LLM, conservées jusqu'à suppression. */
export const progressPhotos = pgTable(
  "progress_photos",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date({ mode: "string" }).notNull(),
    pose: text({ enum: POSES }).notNull(),
    objectKey: text().notNull().unique(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId, t.date)],
);

export const ACTIVITY_SOURCES = ["manual", "import"] as const;

/** Activités libres (marche, vélo, ménage…) avec leurs calories estimées par MET. */
export const activities = pgTable(
  "activities",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date({ mode: "string" }).notNull(),
    type: text({ enum: ACTIVITY_TYPES }).notNull(),
    intensity: text({ enum: INTENSITIES }).notNull(),
    durationMin: integer().notNull(),
    kcal: integer().notNull(),
    source: text({ enum: ACTIVITY_SOURCES }).notNull().default("manual"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId, t.date)],
);

/** Pas du jour, saisis à la main ou importés. */
export const dailySteps = pgTable(
  "daily_steps",
  {
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date({ mode: "string" }).notNull(),
    steps: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);
