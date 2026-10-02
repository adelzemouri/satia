import { date, integer, jsonb, pgTable, primaryKey, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";

import type { MissingData } from "@/domain/adaptive";

import { user } from "./auth";

/** Bilan hebdomadaire de l'objectif adaptatif : un par utilisateur et par semaine (lundi). */
export const metabolismChecks = pgTable(
  "metabolism_checks",
  {
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    weekStart: date({ mode: "string" }).notNull(),
    status: text({ enum: ["adjusted", "unchanged", "locked", "insufficient", "inconsistent"] }).notNull(),
    /** Dépense estimée par la formule (poids de tendance actuel). */
    estimatedTdee: integer().notNull(),
    /** Dépense mesurée, quand les données le permettent. */
    measuredTdee: integer(),
    kcalBefore: smallint().notNull(),
    kcalAfter: smallint().notNull(),
    missing: jsonb().$type<MissingData>(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.weekStart] })],
);

/** Jours marqués à l'avance « plus larges » (repas de famille, sortie) en budget hebdomadaire. */
export const largerDays = pgTable(
  "larger_days",
  {
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date({ mode: "string" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);
