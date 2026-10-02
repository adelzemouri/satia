import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Réglages globaux modifiables par l'admin (planchers caloriques, etc.). */
export const appSettings = pgTable("app_settings", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** Compteurs de limitation de débit (fenêtre fixe), partagés par toutes les instances. */
export const rateLimits = pgTable("rate_limits", {
  key: text().primaryKey(),
  count: integer().notNull(),
  windowStart: timestamp({ withTimezone: true }).notNull(),
});
