import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const createAcademicEventMock = vi.fn();
const updateAcademicEventMock = vi.fn();
const deleteAcademicEventMock = vi.fn();
const getAcademicEventByIdMock = vi.fn();
const markNotificationAsReadMock = vi.fn();
const markAllNotificationsAsReadMock = vi.fn();
const canManageAcademicEventsMock = vi.fn();
const listAcademicEventsMock = vi.fn();
const listUpcomingAcademicEventsMock = vi.fn();
const listNotificationsMock = vi.fn();
const getUnreadNotificationCountMock = vi.fn();
const buildPendingSummaryMock = vi.fn();

const decorateAcademicEventMock = vi.fn((event, now?: number) => ({
  ...event,
  categoryLabel:
    event.category === "exam"
      ? "Provas"
      : event.category === "assignment"
        ? "Entrega de trabalhos"
        : event.category === "notice"
          ? "Avisos"
          : "Atividades",
  categoryColor:
    event.category === "exam"
      ? "#DC2626"
      : event.category === "assignment"
        ? "#F97316"
        : event.category === "notice"
          ? "#16A34A"
          : "#2563EB",
  categorySoftColor: "rgba(37,99,235,0.18)",
  categoryBorderColor: "rgba(37,99,235,0.42)",
  priorityLabel:
    event.priority === "critical"
      ? "Crítica"
      : event.priority === "high"
        ? "Alta"
        : event.priority === "medium"
          ? "Média"
          : "Baixa",
  priorityValue:
    event.priority === "critical" ? 4 : event.priority === "high" ? 3 : event.priority === "medium" ? 2 : 1,
  priorityRing: "rgba(244,197,66,0.45)",
  priorityGlow: "rgba(244,197,66,0.12)",
  isUrgent:
    event.priority === "critical" || event.priority === "high",
  decoratedAt: now ?? null,
}));

vi.mock("./db", () => ({
  buildPendingSummary: buildPendingSummaryMock,
  canManageAcademicEvents: canManageAcademicEventsMock,
  createAcademicEvent: createAcademicEventMock,
  decorateAcademicEvent: decorateAcademicEventMock,
  deleteAcademicEvent: deleteAcademicEventMock,
  getAcademicEventById: getAcademicEventByIdMock,
  getUnreadNotificationCount: getUnreadNotificationCountMock,
  listAcademicEvents: listAcademicEventsMock,
  listNotifications: listNotificationsMock,
  listUpcomingAcademicEvents: listUpcomingAcademicEventsMock,
  markAllNotificationsAsRead: markAllNotificationsAsReadMock,
  markNotificationAsRead: markNotificationAsReadMock,
  updateAcademicEvent: updateAcademicEventMock,
}));

const { appRouter } = await import("./routers");

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

type RawEvent = {
  id: number;
  title: string;
  description: string;
  category: "activity" | "exam" | "assignment" | "notice";
  priority: "low" | "medium" | "high" | "critical";
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  createdById?: number;
};

type RawNotification = {
  id: number;
  userId: number;
  eventId: number;
  title: string;
  message: string;
  category: RawEvent["category"];
  isRead: boolean;
  createdAt: Date;
};

function createContext(role: AuthenticatedUser["role"]): TrpcContext {
  return {
    user: {
      id: role === "admin" ? 9 : role === "user" ? 17 : 21,
      openId: `${role}-open-id`,
      email: `${role}@unimar.br`,
      name: role === "admin" ? "Professora" : role === "user" ? "Aluno" : "Professor",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as TrpcContext["res"],
  };
}

function makeEvent(overrides: Partial<RawEvent> = {}): RawEvent {
  return {
    id: 101,
    title: "Prova de Cálculo",
    description: "Avaliação bimestral com consulta proibida.",
    category: "exam",
    priority: "critical",
    startsAt: new Date("2026-05-10T13:00:00.000Z"),
    endsAt: null,
    allDay: false,
    createdById: 9,
    ...overrides,
  };
}

function makeNotification(overrides: Partial<RawNotification> = {}): RawNotification {
  return {
    id: 31,
    userId: 17,
    eventId: 101,
    title: "Nova prova publicada",
    message: "A prova de Cálculo foi adicionada ao calendário.",
    category: "exam",
    isRead: false,
    createdAt: new Date("2026-05-01T12:00:00.000Z"),
    ...overrides,
  };
}

describe("calendar router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canManageAcademicEventsMock.mockImplementation(role => role === "admin");

    listAcademicEventsMock.mockResolvedValue([
      makeEvent({ id: 101, category: "activity", priority: "medium", title: "Seminário de extensão" }),
      makeEvent({ id: 102, category: "exam", priority: "critical", title: "Prova de Cálculo" }),
    ]);
    listUpcomingAcademicEventsMock.mockResolvedValue([
      makeEvent({ id: 102, category: "exam", priority: "critical", title: "Prova de Cálculo" }),
      makeEvent({ id: 103, category: "assignment", priority: "high", title: "Entrega de artigo" }),
      makeEvent({ id: 104, category: "notice", priority: "medium", title: "Aviso sobre biblioteca" }),
    ]);
    listNotificationsMock.mockResolvedValue([
      makeNotification(),
      makeNotification({ id: 32, isRead: true, title: "Atualização de trabalho" }),
    ]);
    getUnreadNotificationCountMock.mockResolvedValue(1);
    buildPendingSummaryMock.mockReturnValue({
      totalFuture: 3,
      urgentCount: 2,
      pendingActivities: 1,
      upcomingExams: 1,
      assignmentDeadlines: 1,
      notices: 1,
    });

    createAcademicEventMock.mockResolvedValue(makeEvent());
    updateAcademicEventMock.mockResolvedValue(
      makeEvent({
        id: 101,
        title: "Prova de Cálculo II",
        description: "Avaliação reagendada para a segunda chamada.",
      }),
    );
    deleteAcademicEventMock.mockResolvedValue({ success: true });
    getAcademicEventByIdMock.mockResolvedValue(
      makeEvent({
        id: 105,
        category: "assignment",
        priority: "high",
        title: "Entrega de projeto final",
      }),
    );
    markNotificationAsReadMock.mockResolvedValue({ success: true });
    markAllNotificationsAsReadMock.mockResolvedValue({ success: true, updatedCount: 2 });
  });

  it("monta o dashboard com dados agregados reais, widgets e experiência em modo aluno quando solicitado pelo admin", async () => {
    const caller = appRouter.createCaller(createContext("admin"));

    const result = await caller.calendar.dashboard({ previewMode: "student" });

    expect(canManageAcademicEventsMock).toHaveBeenCalledWith("admin");
    expect(listAcademicEventsMock).toHaveBeenCalledTimes(1);
    expect(listUpcomingAcademicEventsMock).toHaveBeenCalledWith(24, expect.any(Number));
    expect(listNotificationsMock).toHaveBeenCalledWith(9, 8);
    expect(getUnreadNotificationCountMock).toHaveBeenCalledWith(9);
    expect(buildPendingSummaryMock).toHaveBeenCalledWith(expect.any(Array), expect.any(Number));

    expect(result.experience).toBe("student");
    expect(result.canManageEvents).toBe(true);
    expect(result.summary).toEqual({
      totalFuture: 3,
      urgentCount: 2,
      pendingActivities: 1,
      upcomingExams: 1,
      assignmentDeadlines: 1,
      notices: 1,
    });
    expect(result.widgets.nextExam?.title).toBe("Prova de Cálculo");
    expect(result.widgets.nextAssignment?.title).toBe("Entrega de artigo");
    expect(result.widgets.nextNotice?.title).toBe("Aviso sobre biblioteca");
    expect(result.agenda).toHaveLength(3);
    expect(result.monthEvents[0]).toMatchObject({
      categoryLabel: "Atividades",
    });
    expect(result.unreadCount).toBe(1);
  });

  it("impede que alunos criem eventos no calendário", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    await expect(
      caller.calendar.create({
        title: "Novo aviso",
        description: "Mudança de sala para a próxima aula.",
        category: "notice",
        priority: "medium",
        startsAt: Date.now() + 1000 * 60 * 60,
        endsAt: null,
        allDay: false,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Apenas professores podem criar eventos.",
    });

    expect(createAcademicEventMock).not.toHaveBeenCalled();
  });

  it("executa o ciclo de criação, edição e remoção para professores", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    const startsAt = Date.parse("2026-05-10T13:00:00.000Z");

    const created = await caller.calendar.create({
      title: "Prova de Cálculo",
      description: "Avaliação bimestral com consulta proibida.",
      category: "exam",
      priority: "critical",
      startsAt,
      endsAt: null,
      allDay: false,
    });

    const updated = await caller.calendar.update({
      eventId: 101,
      data: {
        title: "Prova de Cálculo II",
        description: "Avaliação reagendada para a segunda chamada.",
        category: "exam",
        priority: "high",
        startsAt,
        endsAt: Date.parse("2026-05-10T15:00:00.000Z"),
        allDay: false,
      },
    });

    const removed = await caller.calendar.remove({ eventId: 101 });

    expect(createAcademicEventMock).toHaveBeenCalledWith(9, {
      title: "Prova de Cálculo",
      description: "Avaliação bimestral com consulta proibida.",
      category: "exam",
      priority: "critical",
      startsAt,
      endsAt: null,
      allDay: false,
    });
    expect(updateAcademicEventMock).toHaveBeenCalledWith(101, 9, {
      title: "Prova de Cálculo II",
      description: "Avaliação reagendada para a segunda chamada.",
      category: "exam",
      priority: "high",
      startsAt,
      endsAt: Date.parse("2026-05-10T15:00:00.000Z"),
      allDay: false,
    });
    expect(deleteAcademicEventMock).toHaveBeenCalledWith(101);
    expect(created).toMatchObject({ id: 101, title: "Prova de Cálculo" });
    expect(updated).toMatchObject({ id: 101, title: "Prova de Cálculo II" });
    expect(removed).toEqual({ success: true });
  });

  it("expõe detalhes completos do evento decorado para a visualização no modal do aluno", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    const event = await caller.calendar.getById({ eventId: 105 });

    expect(getAcademicEventByIdMock).toHaveBeenCalledWith(105);
    expect(event).toMatchObject({
      id: 105,
      title: "Entrega de projeto final",
      category: "assignment",
      categoryLabel: "Entrega de trabalhos",
      priorityLabel: "Alta",
    });
  });

  it("bloqueia payload inválido antes de chegar ao backend ao criar eventos", async () => {
    const caller = appRouter.createCaller(createContext("admin"));

    await expect(
      caller.calendar.create({
        title: "Oi",
        description: "curta",
        category: "notice",
        priority: "medium",
        startsAt: -10,
        endsAt: null,
        allDay: false,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    expect(createAcademicEventMock).not.toHaveBeenCalled();
  });

  it("permite consultar notificações e marcar itens individualmente ou em massa", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    const notifications = await caller.calendar.notifications();
    const single = await caller.calendar.markNotificationRead({ notificationId: 33 });
    const bulk = await caller.calendar.markAllNotificationsRead();

    expect(listNotificationsMock).toHaveBeenCalledWith(17, 16);
    expect(notifications).toHaveLength(2);
    expect(markNotificationAsReadMock).toHaveBeenCalledWith(17, 33);
    expect(markAllNotificationsAsReadMock).toHaveBeenCalledWith(17);
    expect(single).toEqual({ success: true });
    expect(bulk).toEqual({ success: true, updatedCount: 2 });
  });
});
