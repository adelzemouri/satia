import { index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { NOTIFICATION_KINDS } from "@/domain/notifications";

import { user } from "./auth";

/** Abonnements Web Push : un par appareil (navigateur) qui a accepté les notifications. */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text().notNull().unique(),
    p256dh: text().notNull(),
    auth: text().notNull(),
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId)],
);

/** Rappels déjà envoyés : chacun ne part qu'une fois (purgés après 30 jours). */
export const notificationLog = pgTable(
  "notification_log",
  {
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text({ enum: NOTIFICATION_KINDS }).notNull(),
    key: text().notNull(),
    sentAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind, t.key] }), index().on(t.sentAt)],
);
