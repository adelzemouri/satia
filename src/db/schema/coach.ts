import { date, index, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";

/** Conversation avec le coach (privée ; seuls les derniers messages sont gardés). */
export const coachMessages = pgTable(
  "coach_messages",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text({ enum: ["user", "coach"] }).notNull(),
    content: text().notNull(),
    /** Réponse locale du coach, sans appel au LLM (texte traduit à l'affichage). */
    notice: text({ enum: ["floor", "medical", "care"] }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId, t.createdAt)],
);

export type WeeklyReviewContent = {
  summary: string;
  highlights: string[];
  ideas: string[];
  /** Données envoyées au LLM : si elles changent (repas corrigés après coup), le bilan est réécrit. */
  source?: string;
};

/** Bilan hebdomadaire rédigé par le coach : un par utilisateur et par semaine écoulée. */
export const coachReviews = pgTable(
  "coach_reviews",
  {
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Lundi de la semaine résumée. */
    weekStart: date({ mode: "string" }).notNull(),
    content: jsonb().$type<WeeklyReviewContent>().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.weekStart] })],
);
