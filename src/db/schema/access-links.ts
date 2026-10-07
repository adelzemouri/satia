import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { ROLES, user } from "./auth";
import { households } from "./households";

/**
 * Liens à usage unique : invitation d'un membre ou réinitialisation de mot de passe.
 * Seul le hash SHA-256 du jeton est stocké.
 */
export const ACCESS_LINK_KINDS = ["invite", "password_reset"] as const;
export type AccessLinkKind = (typeof ACCESS_LINK_KINDS)[number];

export const accessLinks = pgTable(
  "access_links",
  {
    id: uuid().primaryKey().defaultRandom(),
    kind: text({ enum: ACCESS_LINK_KINDS }).notNull(),
    tokenHash: text().notNull().unique(),
    householdId: uuid()
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    /** Invitation : rôle attribué. */
    role: text({ enum: ROLES }),
    /** Invitation : crée un foyer à part (géré par `householdId`) au lieu de rejoindre celui-ci. */
    separateHousehold: boolean().notNull().default(false),
    /** Invitation : libellé libre (« Maman », « Léo ») pour s'y retrouver. */
    label: text(),
    /** Réinitialisation : compte concerné. */
    userId: uuid().references(() => user.id, { onDelete: "cascade" }),
    createdBy: uuid().references(() => user.id, { onDelete: "set null" }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.householdId)],
);
