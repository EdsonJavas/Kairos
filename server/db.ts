import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  academicEvents,
  eventNotifications,
  type AcademicEvent,
  type EventNotification,
  type InsertUser,
  users,
} from "../drizzle/schema";
import {
  type AcademicRole,
  type EventCategory,
  type EventPriority,
  EVENT_CATEGORY_META,
  EVENT_PRIORITY_META,
} from "../shared/academic";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// ── In-memory fallback when DATABASE_URL is not configured ──
const memEvents: AcademicEvent[] = [];
const memNotifications: Array<EventNotification & { category?: EventCategory | null }> = [];
let memEventIdSeq = 1;
let memNotifIdSeq = 1;

function isMemoryMode() {
  return !process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === "";
}

export type AcademicEventFilters = {
  from?: number;
  to?: number;
  category?: EventCategory | "all";
};

export type AcademicEventMutationInput = {
  title: string;
  description: string;
  category: EventCategory;
  priority: EventPriority;
  startsAt: number;
  endsAt?: number | null;
  allDay?: boolean;
};

export type DecoratedAcademicEvent = AcademicEvent & {
  categoryLabel: string;
  categoryColor: string;
  categorySoftColor: string;
  categoryBorderColor: string;
  priorityLabel: string;
  priorityValue: number;
  priorityRing: string;
  priorityGlow: string;
  isUrgent: boolean;
};

export type DecoratedNotification = EventNotification & {
  category?: EventCategory | null;
};

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }

  return _db;
}

export function canManageAcademicEvents(role: AcademicRole | null | undefined) {
  return role === "professor" || role === "admin";
}

export function getPriorityWeight(priority: EventPriority) {
  return EVENT_PRIORITY_META[priority].value;
}

export function sortEventsForAgenda<T extends Pick<AcademicEvent, "startsAt" | "priority">>(events: T[]) {
  return [...events].sort((left, right) => {
    if (left.startsAt === right.startsAt) {
      return getPriorityWeight(right.priority) - getPriorityWeight(left.priority);
    }

    return left.startsAt - right.startsAt;
  });
}

export function decorateAcademicEvent(event: AcademicEvent, now = Date.now()): DecoratedAcademicEvent {
  const categoryMeta = EVENT_CATEGORY_META[event.category];
  const priorityMeta = EVENT_PRIORITY_META[event.priority];
  const timeDistance = event.startsAt - now;
  const isUrgent = priorityMeta.value >= 3 || timeDistance <= 1000 * 60 * 60 * 48;

  return {
    ...event,
    categoryLabel: categoryMeta.label,
    categoryColor: categoryMeta.color,
    categorySoftColor: categoryMeta.softColor,
    categoryBorderColor: categoryMeta.borderColor,
    priorityLabel: priorityMeta.label,
    priorityValue: priorityMeta.value,
    priorityRing: priorityMeta.ring,
    priorityGlow: priorityMeta.glow,
    isUrgent,
  };
}

export function buildPendingSummary(events: AcademicEvent[], now = Date.now()) {
  const futureEvents = sortEventsForAgenda(events.filter(event => event.startsAt >= now));
  const nextExam = futureEvents.find(event => event.category === "exam") ?? null;
  const nextAssignment = futureEvents.find(event => event.category === "assignment") ?? null;
  const urgentCount = futureEvents.filter(event => decorateAcademicEvent(event, now).isUrgent).length;

  return {
    totalFuture: futureEvents.length,
    pendingActivities: futureEvents.filter(event => event.category === "activity").length,
    upcomingExams: futureEvents.filter(event => event.category === "exam").length,
    assignmentDeadlines: futureEvents.filter(event => event.category === "assignment").length,
    notices: futureEvents.filter(event => event.category === "notice").length,
    urgentCount,
    nextExamAt: nextExam?.startsAt ?? null,
    nextAssignmentAt: nextAssignment?.startsAt ?? null,
  };
}

async function notifyStudentsAboutEvent(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  eventId: number,
  input: AcademicEventMutationInput,
  mode: "create" | "update",
) {
  const studentRecipients = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "student"));

  if (studentRecipients.length === 0) {
    return;
  }

  const categoryLabel = EVENT_CATEGORY_META[input.category].shortLabel.toLowerCase();
  const notificationDate = new Date(input.startsAt).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: input.allDay ? undefined : "short",
  });

  const title = mode === "create" ? `Novo ${categoryLabel} publicado` : `${EVENT_CATEGORY_META[input.category].shortLabel} atualizado`;
  const message =
    mode === "create"
      ? `${input.title} foi adicionado ao calendário para ${notificationDate}.`
      : `${input.title} recebeu atualização e continua agendado para ${notificationDate}.`;

  await db.insert(eventNotifications).values(
    studentRecipients.map(student => ({
      userId: student.id,
      eventId,
      title,
      message,
    })),
  );
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }

    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  if (isMemoryMode()) return undefined;

  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAcademicEventById(eventId: number) {
  if (isMemoryMode()) {
    return memEvents.find(e => e.id === eventId);
  }

  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(academicEvents).where(eq(academicEvents.id, eventId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listAcademicEvents(filters: AcademicEventFilters = {}) {
  if (isMemoryMode()) {
    let result = [...memEvents];
    if (filters.from !== undefined) result = result.filter(e => e.startsAt >= filters.from!);
    if (filters.to !== undefined) result = result.filter(e => e.startsAt <= filters.to!);
    if (filters.category && filters.category !== "all") result = result.filter(e => e.category === filters.category);
    return sortEventsForAgenda(result);
  }

  const db = await getDb();
  if (!db) return [] as AcademicEvent[];

  const conditions = [] as Array<ReturnType<typeof eq>>;
  if (filters.from !== undefined) conditions.push(gte(academicEvents.startsAt, filters.from));
  if (filters.to !== undefined) conditions.push(lte(academicEvents.startsAt, filters.to));
  if (filters.category && filters.category !== "all") conditions.push(eq(academicEvents.category, filters.category));

  const rows = await db
    .select()
    .from(academicEvents)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(academicEvents.startsAt), desc(academicEvents.createdAt));

  return sortEventsForAgenda(rows);
}

export async function listUpcomingAcademicEvents(limit = 12, from = Date.now()) {
  if (isMemoryMode()) {
    return sortEventsForAgenda(memEvents.filter(e => e.startsAt >= from)).slice(0, limit);
  }

  const db = await getDb();
  if (!db) return [] as AcademicEvent[];

  const rows = await db
    .select()
    .from(academicEvents)
    .where(gte(academicEvents.startsAt, from))
    .orderBy(asc(academicEvents.startsAt), desc(academicEvents.createdAt))
    .limit(limit);

  return sortEventsForAgenda(rows);
}

export async function createAcademicEvent(authorUserId: number, input: AcademicEventMutationInput) {
  if (isMemoryMode()) {
    const now = new Date();
    const event: AcademicEvent = {
      id: memEventIdSeq++,
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      allDay: input.allDay ?? false,
      createdByUserId: authorUserId,
      updatedByUserId: authorUserId,
      createdAt: now,
      updatedAt: now,
    };
    memEvents.push(event);
    return event;
  }

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const insertResult = await db.insert(academicEvents).values({
    title: input.title,
    description: input.description,
    category: input.category,
    priority: input.priority,
    startsAt: input.startsAt,
    endsAt: input.endsAt ?? null,
    allDay: input.allDay ?? false,
    createdByUserId: authorUserId,
    updatedByUserId: authorUserId,
  });

  const eventId = Number((insertResult as { insertId?: number }).insertId ?? 0);
  if (!eventId) throw new Error("Failed to create academic event");

  await notifyStudentsAboutEvent(db, eventId, input, "create");

  const createdEvent = await getAcademicEventById(eventId);
  if (!createdEvent) throw new Error("Created academic event could not be loaded");

  return createdEvent;
}

export async function updateAcademicEvent(eventId: number, authorUserId: number, input: AcademicEventMutationInput) {
  if (isMemoryMode()) {
    const idx = memEvents.findIndex(e => e.id === eventId);
    if (idx === -1) throw new Error("Event not found");
    memEvents[idx] = {
      ...memEvents[idx],
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      allDay: input.allDay ?? false,
      updatedByUserId: authorUserId,
      updatedAt: new Date(),
    };
    return memEvents[idx];
  }

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(academicEvents).set({
    title: input.title, description: input.description, category: input.category,
    priority: input.priority, startsAt: input.startsAt, endsAt: input.endsAt ?? null,
    allDay: input.allDay ?? false, updatedByUserId: authorUserId,
  }).where(eq(academicEvents.id, eventId));

  await notifyStudentsAboutEvent(db, eventId, input, "update");
  const updatedEvent = await getAcademicEventById(eventId);
  if (!updatedEvent) throw new Error("Updated academic event could not be loaded");
  return updatedEvent;
}

export async function deleteAcademicEvent(eventId: number) {
  if (isMemoryMode()) {
    const idx = memEvents.findIndex(e => e.id === eventId);
    if (idx !== -1) memEvents.splice(idx, 1);
    const notifIdxs = memNotifications.reduce<number[]>((acc, n, i) => { if (n.eventId === eventId) acc.push(i); return acc; }, []);
    for (let i = notifIdxs.length - 1; i >= 0; i--) memNotifications.splice(notifIdxs[i], 1);
    return { success: true } as const;
  }

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(eventNotifications).where(eq(eventNotifications.eventId, eventId));
  await db.delete(academicEvents).where(eq(academicEvents.id, eventId));
  return { success: true } as const;
}

export async function listNotifications(userId: number, limit = 12) {
  if (isMemoryMode()) {
    return memNotifications.filter(n => n.userId === userId).slice(0, limit);
  }

  const db = await getDb();
  if (!db) return [] as DecoratedNotification[];

  const rows = await db
    .select({
      id: eventNotifications.id, userId: eventNotifications.userId,
      eventId: eventNotifications.eventId, title: eventNotifications.title,
      message: eventNotifications.message, isRead: eventNotifications.isRead,
      createdAt: eventNotifications.createdAt, readAt: eventNotifications.readAt,
      category: academicEvents.category,
    })
    .from(eventNotifications)
    .leftJoin(academicEvents, eq(eventNotifications.eventId, academicEvents.id))
    .where(eq(eventNotifications.userId, userId))
    .orderBy(desc(eventNotifications.createdAt))
    .limit(limit);

  return rows;
}

export async function getUnreadNotificationCount(userId: number) {
  if (isMemoryMode()) {
    return memNotifications.filter(n => n.userId === userId && !n.isRead).length;
  }

  const db = await getDb();
  if (!db) return 0;

  const rows = await db
    .select({ id: eventNotifications.id })
    .from(eventNotifications)
    .where(and(eq(eventNotifications.userId, userId), eq(eventNotifications.isRead, false)));

  return rows.length;
}

export async function markNotificationAsRead(userId: number, notificationId: number) {
  if (isMemoryMode()) {
    const n = memNotifications.find(n => n.id === notificationId && n.userId === userId);
    if (n) { n.isRead = true; n.readAt = new Date(); }
    return { success: true } as const;
  }

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(eventNotifications).set({ isRead: true, readAt: new Date() })
    .where(and(eq(eventNotifications.id, notificationId), eq(eventNotifications.userId, userId)));
  return { success: true } as const;
}

export async function markAllNotificationsAsRead(userId: number) {
  if (isMemoryMode()) {
    memNotifications.filter(n => n.userId === userId && !n.isRead).forEach(n => { n.isRead = true; n.readAt = new Date(); });
    return { success: true } as const;
  }

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(eventNotifications).set({ isRead: true, readAt: new Date() })
    .where(and(eq(eventNotifications.userId, userId), eq(eventNotifications.isRead, false)));
  return { success: true } as const;
}
