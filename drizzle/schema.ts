import {
  bigint,
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { academicRoles, eventCategories, eventPriorities } from "../shared/academic";

/**
 * Core user table backing auth flow.
 * Extended with academic roles so the application can differentiate student and professor experiences.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", academicRoles).default("student").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const academicEvents = mysqlTable(
  "academic_events",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description").notNull(),
    category: mysqlEnum("category", eventCategories).notNull(),
    priority: mysqlEnum("priority", eventPriorities).default("medium").notNull(),
    startsAt: bigint("startsAt", { mode: "number" }).notNull(),
    endsAt: bigint("endsAt", { mode: "number" }),
    allDay: boolean("allDay").default(false).notNull(),
    createdByUserId: int("createdByUserId")
      .notNull()
      .references(() => users.id),
    updatedByUserId: int("updatedByUserId").references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("academic_events_starts_at_idx").on(table.startsAt),
    index("academic_events_category_idx").on(table.category),
    index("academic_events_priority_idx").on(table.priority),
    index("academic_events_created_by_idx").on(table.createdByUserId),
  ],
);

export const eventNotifications = mysqlTable(
  "event_notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    eventId: int("eventId")
      .notNull()
      .references(() => academicEvents.id),
    title: varchar("title", { length: 160 }).notNull(),
    message: text("message").notNull(),
    isRead: boolean("isRead").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    readAt: timestamp("readAt"),
  },
  table => [
    index("event_notifications_user_idx").on(table.userId),
    index("event_notifications_event_idx").on(table.eventId),
    index("event_notifications_read_idx").on(table.isRead),
  ],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type AcademicEvent = typeof academicEvents.$inferSelect;
export type InsertAcademicEvent = typeof academicEvents.$inferInsert;

export type EventNotification = typeof eventNotifications.$inferSelect;
export type InsertEventNotification = typeof eventNotifications.$inferInsert;
