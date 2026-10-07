import { type AnyPgColumn, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const households = pgTable("households", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  /** Foyer à part créé par une invitation : le foyer dont l'admin gère ce compte. */
  managedBy: uuid().references((): AnyPgColumn => households.id, { onDelete: "set null" }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
