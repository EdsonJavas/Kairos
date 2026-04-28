import {
  EVENT_CATEGORY_META,
  EVENT_PRIORITY_META,
  type EventCategory,
  type EventPriority,
} from "@shared/academic";

/* ──────────────────────────────────────────────────────────────────────
   Tipos
   ────────────────────────────────────────────────────────────────────── */

export type MockUser = {
  id: number;
  openId: string;
  name: string;
  email: string;
  loginMethod: string | null;
  role: "professor" | "student" | "admin";
  createdAt: string;
  updatedAt: string;
  lastSignedIn: string;
};

export type MockEvent = {
  id: number;
  title: string;
  description: string;
  category: EventCategory;
  priority: EventPriority;
  startsAt: number;
  endsAt: number | null;
  allDay: boolean;
  createdByUserId: number;
  updatedByUserId: number;
  createdAt: string;
  updatedAt: string;
};

export type MockNotification = {
  id: number;
  userId: number;
  eventId: number;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
  category: EventCategory | null;
};

export type DecoratedEvent = MockEvent & {
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

/* ──────────────────────────────────────────────────────────────────────
   Constantes
   ────────────────────────────────────────────────────────────────────── */

const STORAGE_KEYS = {
  user: "kairos.user.v1",
  events: "kairos.events.v1",
  notifications: "kairos.notifications.v1",
  seqs: "kairos.seqs.v1",
} as const;

type Sequences = { event: number; notification: number };

const PROFESSOR_USER: MockUser = {
  id: 1,
  openId: "dev-professor-unimar-001",
  name: "Prof. Demo",
  email: "professor@unimar.br",
  loginMethod: "credentials",
  role: "professor",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  lastSignedIn: new Date().toISOString(),
};

const STUDENT_USER: MockUser = {
  id: 2,
  openId: "dev-aluno-unimar-001",
  name: "Aluno Demo",
  email: "aluno@unimar.br",
  loginMethod: "credentials",
  role: "student",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  lastSignedIn: new Date().toISOString(),
};

const HARDCODED_LOGINS: Array<{ email: string; password: string; user: MockUser }> = [
  { email: "professor@unimar.br", password: "professor123", user: PROFESSOR_USER },
  { email: "aluno@unimar.br", password: "aluno123", user: STUDENT_USER },
];

/* ──────────────────────────────────────────────────────────────────────
   Persistência (localStorage)
   ────────────────────────────────────────────────────────────────────── */

function safeRead<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeWrite<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / privacy mode — silencioso */
  }
}

function safeRemove(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

function getSeqs(): Sequences {
  return safeRead<Sequences>(STORAGE_KEYS.seqs) ?? { event: 1, notification: 1 };
}

function setSeqs(seqs: Sequences) {
  safeWrite(STORAGE_KEYS.seqs, seqs);
}

function nextEventId(): number {
  const seqs = getSeqs();
  const id = seqs.event;
  setSeqs({ ...seqs, event: id + 1 });
  return id;
}

function nextNotificationId(): number {
  const seqs = getSeqs();
  const id = seqs.notification;
  setSeqs({ ...seqs, notification: id + 1 });
  return id;
}

/* ──────────────────────────────────────────────────────────────────────
   Seeds — eventos e notificações iniciais para a UI nunca aparecer vazia
   ────────────────────────────────────────────────────────────────────── */

function ensureSeeded() {
  const events = safeRead<MockEvent[]>(STORAGE_KEYS.events);
  if (events !== null) return;

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const hour = 60 * 60 * 1000;

  // Sementes geradas relativas ao dia de hoje, garantindo que sempre haja algo a exibir.
  const seedDefs: Array<Omit<MockEvent, "id" | "createdAt" | "updatedAt" | "createdByUserId" | "updatedByUserId">> = [
    {
      title: "Aula de Direito Constitucional",
      description: "Conteúdo: princípios fundamentais e organização do Estado. Trazer Constituição comentada.",
      category: "activity",
      priority: "medium",
      startsAt: now + 4 * hour,
      endsAt: now + 6 * hour,
      allDay: false,
    },
    {
      title: "Prova de Direito Civil — Parte Geral",
      description: "Avaliação cobrindo capacidade civil, fatos jurídicos e prescrição. Duração de 2 horas.",
      category: "exam",
      priority: "critical",
      startsAt: now + 2 * day + 6 * hour,
      endsAt: now + 2 * day + 8 * hour,
      allDay: false,
    },
    {
      title: "Entrega · Trabalho de POO",
      description: "Submeter projeto orientado a objetos com mínimo de 3 classes e diagrama UML em PDF.",
      category: "assignment",
      priority: "high",
      startsAt: now + 3 * day + 23 * hour,
      endsAt: null,
      allDay: false,
    },
    {
      title: "Reunião de colegiado",
      description: "Discussão de planos pedagógicos e calendário do próximo semestre. Aberta a representantes.",
      category: "notice",
      priority: "low",
      startsAt: now + 5 * day,
      endsAt: null,
      allDay: true,
    },
    {
      title: "Simulado integrador",
      description: "Bloco de questões objetivas e dissertativas integrando todas as disciplinas do semestre.",
      category: "exam",
      priority: "high",
      startsAt: now + 9 * day + 5 * hour,
      endsAt: now + 9 * day + 9 * hour,
      allDay: false,
    },
    {
      title: "Apresentação do projeto integrador",
      description: "Cada grupo terá 10 minutos para apresentação seguidos de 5 minutos de arguição.",
      category: "activity",
      priority: "medium",
      startsAt: now + 12 * day + 2 * hour,
      endsAt: now + 12 * day + 8 * hour,
      allDay: false,
    },
    {
      title: "Aviso institucional · biblioteca",
      description: "Atualização do horário da biblioteca durante a semana de provas. Consultar o portal.",
      category: "notice",
      priority: "medium",
      startsAt: now + 6 * day,
      endsAt: null,
      allDay: true,
    },
    {
      title: "Entrega · Resenha crítica",
      description: "Entrega de resenha sobre artigo selecionado. Mínimo de 5 páginas, máximo de 8.",
      category: "assignment",
      priority: "medium",
      startsAt: now + 16 * day + 22 * hour,
      endsAt: null,
      allDay: false,
    },
  ];

  const events_: MockEvent[] = seedDefs.map(def => ({
    ...def,
    id: nextEventId(),
    createdByUserId: PROFESSOR_USER.id,
    updatedByUserId: PROFESSOR_USER.id,
    createdAt: new Date(now - 7 * day).toISOString(),
    updatedAt: new Date(now - 7 * day).toISOString(),
  }));

  safeWrite(STORAGE_KEYS.events, events_);

  // Notificações para o aluno (e também para o professor para variar)
  const notifs: MockNotification[] = events_.slice(0, 5).map((ev, idx) => ({
    id: nextNotificationId(),
    userId: STUDENT_USER.id,
    eventId: ev.id,
    title: idx === 0 ? `Novo ${EVENT_CATEGORY_META[ev.category].shortLabel.toLowerCase()} publicado` : `${EVENT_CATEGORY_META[ev.category].shortLabel} atualizado`,
    message: idx === 0
      ? `${ev.title} foi adicionado ao calendário.`
      : `${ev.title} recebeu uma atualização.`,
    isRead: idx >= 3,
    createdAt: new Date(now - (idx + 1) * 8 * hour).toISOString(),
    readAt: idx >= 3 ? new Date(now - idx * hour).toISOString() : null,
    category: ev.category,
  }));

  safeWrite(STORAGE_KEYS.notifications, notifs);
}

/* ──────────────────────────────────────────────────────────────────────
   Acessors públicos
   ────────────────────────────────────────────────────────────────────── */

export function getCurrentUser(): MockUser | null {
  return safeRead<MockUser>(STORAGE_KEYS.user);
}

export function loginWithCredentials(
  email: string,
  password: string,
): { ok: true; user: MockUser } | { ok: false; error: string } {
  const normalizedEmail = email.trim().toLowerCase();
  const entry = HARDCODED_LOGINS.find(
    e => e.email.toLowerCase() === normalizedEmail && e.password === password,
  );

  if (!entry) {
    return { ok: false, error: "Credenciais inválidas. Verifique os dados e tente novamente." };
  }

  const user: MockUser = { ...entry.user, lastSignedIn: new Date().toISOString() };
  safeWrite(STORAGE_KEYS.user, user);
  ensureSeeded();
  return { ok: true, user };
}

export function logoutCurrentUser() {
  safeRemove(STORAGE_KEYS.user);
}

function getAllEvents(): MockEvent[] {
  ensureSeeded();
  return safeRead<MockEvent[]>(STORAGE_KEYS.events) ?? [];
}

function setAllEvents(events: MockEvent[]) {
  safeWrite(STORAGE_KEYS.events, events);
}

function getAllNotifications(): MockNotification[] {
  ensureSeeded();
  return safeRead<MockNotification[]>(STORAGE_KEYS.notifications) ?? [];
}

function setAllNotifications(notifs: MockNotification[]) {
  safeWrite(STORAGE_KEYS.notifications, notifs);
}

/* ──────────────────────────────────────────────────────────────────────
   Helpers (porta dos do server/db.ts)
   ────────────────────────────────────────────────────────────────────── */

function decorateEvent(event: MockEvent, now = Date.now()): DecoratedEvent {
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

function sortAgenda<T extends Pick<MockEvent, "startsAt" | "priority">>(events: T[]) {
  return [...events].sort((a, b) => {
    if (a.startsAt === b.startsAt) {
      return EVENT_PRIORITY_META[b.priority].value - EVENT_PRIORITY_META[a.priority].value;
    }
    return a.startsAt - b.startsAt;
  });
}

function buildSummary(events: MockEvent[], now = Date.now()) {
  const future = sortAgenda(events.filter(e => e.startsAt >= now));
  const nextExam = future.find(e => e.category === "exam") ?? null;
  const nextAssignment = future.find(e => e.category === "assignment") ?? null;
  const urgentCount = future.filter(e => decorateEvent(e, now).isUrgent).length;

  return {
    totalFuture: future.length,
    pendingActivities: future.filter(e => e.category === "activity").length,
    upcomingExams: future.filter(e => e.category === "exam").length,
    assignmentDeadlines: future.filter(e => e.category === "assignment").length,
    notices: future.filter(e => e.category === "notice").length,
    urgentCount,
    nextExamAt: nextExam?.startsAt ?? null,
    nextAssignmentAt: nextAssignment?.startsAt ?? null,
  };
}

function listEventsInWindow(filters: { from?: number; to?: number; category?: EventCategory | "all" }) {
  let events = getAllEvents();
  if (filters.from !== undefined) events = events.filter(e => e.startsAt >= filters.from!);
  if (filters.to !== undefined) events = events.filter(e => e.startsAt <= filters.to!);
  if (filters.category && filters.category !== "all") events = events.filter(e => e.category === filters.category);
  return sortAgenda(events);
}

function listUpcomingEvents(limit: number, from: number = Date.now()) {
  const events = getAllEvents().filter(e => e.startsAt >= from);
  return sortAgenda(events).slice(0, limit);
}

function notifyStudentsAbout(event: MockEvent, mode: "create" | "update") {
  const notifs = getAllNotifications();
  const categoryLabel = EVENT_CATEGORY_META[event.category].shortLabel.toLowerCase();
  const dateLabel = new Date(event.startsAt).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: event.allDay ? undefined : "short",
  });
  const newNotif: MockNotification = {
    id: nextNotificationId(),
    userId: STUDENT_USER.id,
    eventId: event.id,
    title: mode === "create" ? `Novo ${categoryLabel} publicado` : `${EVENT_CATEGORY_META[event.category].shortLabel} atualizado`,
    message: mode === "create"
      ? `${event.title} foi adicionado ao calendário para ${dateLabel}.`
      : `${event.title} recebeu atualização e continua agendado para ${dateLabel}.`,
    isRead: false,
    createdAt: new Date().toISOString(),
    readAt: null,
    category: event.category,
  };
  setAllNotifications([newNotif, ...notifs]);
}

/* ──────────────────────────────────────────────────────────────────────
   Procedures (espelham os tRPC handlers do server/routers.ts)
   ────────────────────────────────────────────────────────────────────── */

function requireUser(): MockUser {
  const user = getCurrentUser();
  if (!user) throw new MockUnauthorizedError();
  return user;
}

class MockUnauthorizedError extends Error {
  code = "UNAUTHORIZED" as const;
  constructor() {
    super("Sessão inválida ou expirada.");
    this.name = "MockUnauthorizedError";
  }
}

class MockNotFoundError extends Error {
  code = "NOT_FOUND" as const;
  constructor(message: string) {
    super(message);
    this.name = "MockNotFoundError";
  }
}

class MockForbiddenError extends Error {
  code = "FORBIDDEN" as const;
  constructor(message: string) {
    super(message);
    this.name = "MockForbiddenError";
  }
}

function getMonthWindow(now: number) {
  const current = new Date(now);
  const start = new Date(current.getFullYear(), current.getMonth(), 1).getTime();
  const end = new Date(current.getFullYear(), current.getMonth() + 2, 0, 23, 59, 59, 999).getTime();
  return { start, end };
}

function canManage(role: MockUser["role"]) {
  return role === "professor" || role === "admin";
}

/**
 * Roteia uma chamada tRPC para o handler mock equivalente.
 * `path` no formato "namespace.proc" (ex: "calendar.dashboard").
 */
export function handleMockTrpcCall(path: string, input: unknown): unknown {
  const now = Date.now();

  switch (path) {
    /* ─── system ─── */
    case "system.health":
      return { ok: true };

    /* ─── auth ─── */
    case "auth.me":
      return getCurrentUser();
    case "auth.logout":
      logoutCurrentUser();
      return { success: true } as const;

    /* ─── calendar ─── */
    case "calendar.dashboard": {
      const user = requireUser();
      const previewMode =
        user.role === "admin"
          ? ((input as { previewMode?: "student" | "professor" } | undefined)?.previewMode ?? "professor")
          : undefined;
      const userCanManage = canManage(user.role);
      const experience = previewMode ?? (userCanManage ? "professor" : "student");
      const { start, end } = getMonthWindow(now);

      const monthEvents = listEventsInWindow({ from: start, to: end });
      const upcoming = listUpcomingEvents(24, now);
      const notifications = getAllNotifications()
        .filter(n => n.userId === user.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8);
      const unreadCount = getAllNotifications().filter(n => n.userId === user.id && !n.isRead).length;

      const decoratedMonth = monthEvents.map(e => decorateEvent(e, now));
      const decoratedUpcoming = upcoming.map(e => decorateEvent(e, now));
      const agenda = decoratedUpcoming.slice(0, 10);
      const summary = buildSummary(upcoming, now);
      const nextExam = decoratedUpcoming.find(e => e.category === "exam") ?? null;
      const nextAssignment = decoratedUpcoming.find(e => e.category === "assignment") ?? null;
      const nextNotice = decoratedUpcoming.find(e => e.category === "notice") ?? null;

      return {
        serverTime: now,
        experience,
        canManageEvents: userCanManage,
        currentUser: user,
        summary,
        widgets: { nextExam, nextAssignment, nextNotice },
        monthEvents: decoratedMonth,
        upcoming: decoratedUpcoming,
        agenda,
        notifications,
        unreadCount,
      };
    }

    case "calendar.list": {
      requireUser();
      const filters = (input ?? {}) as { from?: number; to?: number; category?: EventCategory | "all" };
      const events = listEventsInWindow(filters);
      return events.map(e => decorateEvent(e, now));
    }

    case "calendar.getById": {
      requireUser();
      const { eventId } = input as { eventId: number };
      const event = getAllEvents().find(e => e.id === eventId);
      if (!event) throw new MockNotFoundError("Evento não encontrado.");
      return decorateEvent(event, now);
    }

    case "calendar.create": {
      const user = requireUser();
      if (!canManage(user.role)) throw new MockForbiddenError("Apenas professores podem criar eventos.");
      const data = input as Omit<MockEvent, "id" | "createdAt" | "updatedAt" | "createdByUserId" | "updatedByUserId">;
      const event: MockEvent = {
        ...data,
        endsAt: data.endsAt ?? null,
        allDay: data.allDay ?? false,
        id: nextEventId(),
        createdByUserId: user.id,
        updatedByUserId: user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setAllEvents([...getAllEvents(), event]);
      notifyStudentsAbout(event, "create");
      return decorateEvent(event, now);
    }

    case "calendar.update": {
      const user = requireUser();
      if (!canManage(user.role)) throw new MockForbiddenError("Apenas professores podem editar eventos.");
      const { eventId, data } = input as {
        eventId: number;
        data: Omit<MockEvent, "id" | "createdAt" | "updatedAt" | "createdByUserId" | "updatedByUserId">;
      };
      const events = getAllEvents();
      const idx = events.findIndex(e => e.id === eventId);
      if (idx === -1) throw new MockNotFoundError("Evento não encontrado.");
      const updated: MockEvent = {
        ...events[idx],
        ...data,
        endsAt: data.endsAt ?? null,
        allDay: data.allDay ?? false,
        updatedByUserId: user.id,
        updatedAt: new Date().toISOString(),
      };
      const next = [...events];
      next[idx] = updated;
      setAllEvents(next);
      notifyStudentsAbout(updated, "update");
      return decorateEvent(updated, now);
    }

    case "calendar.remove": {
      const user = requireUser();
      if (!canManage(user.role)) throw new MockForbiddenError("Apenas professores podem remover eventos.");
      const { eventId } = input as { eventId: number };
      setAllEvents(getAllEvents().filter(e => e.id !== eventId));
      setAllNotifications(getAllNotifications().filter(n => n.eventId !== eventId));
      return { success: true } as const;
    }

    case "calendar.notifications": {
      const user = requireUser();
      return getAllNotifications()
        .filter(n => n.userId === user.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 16);
    }

    case "calendar.markNotificationRead": {
      const user = requireUser();
      const { notificationId } = input as { notificationId: number };
      const next = getAllNotifications().map(n =>
        n.id === notificationId && n.userId === user.id
          ? { ...n, isRead: true, readAt: new Date().toISOString() }
          : n,
      );
      setAllNotifications(next);
      return { success: true } as const;
    }

    case "calendar.markAllNotificationsRead": {
      const user = requireUser();
      const next = getAllNotifications().map(n =>
        n.userId === user.id && !n.isRead
          ? { ...n, isRead: true, readAt: new Date().toISOString() }
          : n,
      );
      setAllNotifications(next);
      return { success: true } as const;
    }

    default:
      throw new MockNotFoundError(`Procedimento não implementado no mock: ${path}`);
  }
}

export { MockUnauthorizedError, MockNotFoundError, MockForbiddenError };
