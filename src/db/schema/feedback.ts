import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { FEEDBACK_KINDS } from "@/domain/feedback";

import { user } from "./auth";
import { households } from "./households";

/**
 * Remarques et bugs envoyés depuis l'app. `householdId` est le foyer qui les reçoit : celui de
 * la personne, ou le foyer qui gère son foyer à part (invités de la bêta).
 */
export const feedbackMessages = pgTable(
  "feedback_messages",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    householdId: uuid()
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    kind: text({ enum: FEEDBACK_KINDS }).notNull(),
    message: text().notNull(),
    /** Page de l'app d'où vient la personne (« /journal »). */
    page: text(),
    appVersion: text(),
    userAgent: text(),
    /** Détail technique quand le message part de l'écran d'erreur. */
    errorDetail: text(),
    screenshotKey: text().unique(),
    handledAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.householdId, t.createdAt), index().on(t.userId)],
);
