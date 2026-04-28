import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Activity,
  ArrowRight,
  Bell,
  BellRing,
  BookMarked,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Clock3,
  Eye,
  Filter,
  Flame,
  GraduationCap,
  Hourglass,
  Inbox,
  LayoutDashboard,
  LayoutList,
  ListFilter,
  MailOpen,
  Megaphone,
  PencilLine,
  Plus,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Sunrise,
  Target,
  Trash2,
  TrendingUp,
  Type,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type EventCategory = "activity" | "exam" | "assignment" | "notice";
type EventPriority = "low" | "medium" | "high" | "critical";

type DashboardEvent = {
  id: number;
  title: string;
  description: string;
  category: EventCategory;
  priority: EventPriority;
  startsAt: number;
  endsAt: number | null;
  allDay: boolean;
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

type NotificationItem = {
  id: number;
  eventId: number;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date | string;
  category?: EventCategory | null;
};

type EventFormState = {
  title: string;
  description: string;
  category: EventCategory;
  priority: EventPriority;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
};

type DashboardSummary = {
  totalFuture: number;
  pendingActivities: number;
  upcomingExams: number;
  assignmentDeadlines: number;
  notices: number;
  urgentCount: number;
};

type DashboardWidgets = {
  nextExam: DashboardEvent | null;
  nextAssignment: DashboardEvent | null;
  nextNotice: DashboardEvent | null;
};

const navItems = [
  { icon: LayoutDashboard, label: "Painel", path: "/app" },
  { icon: CalendarDays, label: "Calendário", path: "/calendario" },
  { icon: CalendarCheck2, label: "Agenda", path: "/agenda" },
  { icon: Bell, label: "Notificações", path: "/notificacoes" },
] as const;

const categoryOptions: Array<{ value: EventCategory; label: string; icon: typeof BookMarked }> = [
  { value: "activity", label: "Atividades", icon: BookMarked },
  { value: "exam", label: "Provas", icon: GraduationCap },
  { value: "assignment", label: "Entrega de trabalhos", icon: ClipboardCheck },
  { value: "notice", label: "Avisos", icon: Megaphone },
];

const priorityOptions: Array<{ value: EventPriority | "all"; label: string }> = [
  { value: "all", label: "Todas as prioridades" },
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Crítica" },
];

const emptyForm: EventFormState = {
  title: "",
  description: "",
  category: "activity",
  priority: "medium",
  startsAt: "",
  endsAt: "",
  allDay: false,
};

export default function Workspace() {
  const [location, setLocation] = useLocation();
  const [previewMode, setPreviewMode] = useState<"student" | "professor">("professor");
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | "all">("all");
  const [selectedPriority, setSelectedPriority] = useState<EventPriority | "all">("all");
  const [searchText, setSearchText] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<DashboardEvent | null>(null);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [formState, setFormState] = useState<EventFormState>(emptyForm);
  const utils = trpc.useUtils();

  const dashboardQuery = trpc.calendar.dashboard.useQuery({ previewMode });
  const notificationsQuery = trpc.calendar.notifications.useQuery(undefined, {
    enabled: dashboardQuery.isSuccess,
  });
  const eventDetailsQuery = trpc.calendar.getById.useQuery(
    { eventId: selectedEventId ?? 0 },
    { enabled: selectedEventId !== null },
  );

  const invalidateAll = async () => {
    await Promise.all([
      utils.calendar.dashboard.invalidate(),
      utils.calendar.list.invalidate(),
      utils.calendar.notifications.invalidate(),
      selectedEventId ? utils.calendar.getById.invalidate({ eventId: selectedEventId }) : Promise.resolve(),
    ]);
  };

  const createEvent = trpc.calendar.create.useMutation({
    onSuccess: async created => {
      toast.success("Evento publicado com sucesso.");
      resetComposer();
      setSelectedDate(new Date(created.startsAt));
      await invalidateAll();
    },
    onError: error => toast.error(error.message),
  });

  const updateEvent = trpc.calendar.update.useMutation({
    onSuccess: async updated => {
      toast.success("Evento atualizado com sucesso.");
      resetComposer();
      setSelectedDate(new Date(updated.startsAt));
      await invalidateAll();
    },
    onError: error => toast.error(error.message),
  });

  const deleteEvent = trpc.calendar.remove.useMutation({
    onSuccess: async () => {
      toast.success("Evento removido com sucesso.");
      resetComposer();
      setSelectedEventId(null);
      await invalidateAll();
    },
    onError: error => toast.error(error.message),
  });

  const markNotificationRead = trpc.calendar.markNotificationRead.useMutation({
    onSuccess: async () => {
      await Promise.all([dashboardQuery.refetch(), notificationsQuery.refetch()]);
    },
    onError: error => toast.error(error.message),
  });

  const markAllNotificationsRead = trpc.calendar.markAllNotificationsRead.useMutation({
    onSuccess: async () => {
      toast.success("Todas as notificações foram marcadas como lidas.");
      await Promise.all([dashboardQuery.refetch(), notificationsQuery.refetch()]);
    },
    onError: error => toast.error(error.message),
  });

  function resetComposer() {
    setEditingEventId(null);
    setFormState(emptyForm);
  }

  const data = dashboardQuery.data;
  const monthEvents = ((data?.monthEvents ?? []) as DashboardEvent[]).slice();
  const agenda = ((data?.agenda ?? []) as DashboardEvent[]).slice();
  const upcoming = ((data?.upcoming ?? []) as DashboardEvent[]).slice();
  const notifications = ((notificationsQuery.data ?? data?.notifications ?? []) as NotificationItem[]).slice();
  const summary = (data?.summary ?? {
    totalFuture: 0,
    pendingActivities: 0,
    upcomingExams: 0,
    assignmentDeadlines: 0,
    notices: 0,
    urgentCount: 0,
  }) as DashboardSummary;
  const widgets = (data?.widgets ?? {
    nextExam: null,
    nextAssignment: null,
    nextNotice: null,
  }) as DashboardWidgets;
  const experience = data?.experience ?? "student";
  const canManageEvents = data?.canManageEvents ?? false;
  const currentUser = data?.currentUser;
  const isProfessorExperience = experience === "professor";
  const isAdmin = currentUser?.role === "admin";

  const filteredEvents = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return monthEvents.filter(event => {
      const matchesCategory = selectedCategory === "all" || event.category === selectedCategory;
      const matchesPriority = selectedPriority === "all" || event.priority === selectedPriority;
      const matchesSearch =
        search.length === 0 ||
        event.title.toLowerCase().includes(search) ||
        event.description.toLowerCase().includes(search) ||
        event.categoryLabel.toLowerCase().includes(search);

      return matchesCategory && matchesPriority && matchesSearch;
    });
  }, [monthEvents, searchText, selectedCategory, selectedPriority]);

  const filteredAgenda = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return agenda.filter(event => {
      const matchesCategory = selectedCategory === "all" || event.category === selectedCategory;
      const matchesPriority = selectedPriority === "all" || event.priority === selectedPriority;
      const matchesSearch =
        search.length === 0 ||
        event.title.toLowerCase().includes(search) ||
        event.description.toLowerCase().includes(search) ||
        event.categoryLabel.toLowerCase().includes(search);

      return matchesCategory && matchesPriority && matchesSearch;
    });
  }, [agenda, searchText, selectedCategory, selectedPriority]);

  const selectedDayEvents = useMemo(() => {
    return filteredEvents.filter(event => isSameDay(new Date(event.startsAt), selectedDate));
  }, [filteredEvents, selectedDate]);

  const todayEvents = useMemo(() => {
    return upcoming.filter(event => isSameDay(new Date(event.startsAt), new Date(data?.serverTime ?? Date.now())));
  }, [upcoming, data?.serverTime]);

  const weekEvents = useMemo(() => {
    const now = data?.serverTime ?? Date.now();
    return upcoming.filter(event => {
      const diff = differenceInCalendarDays(new Date(event.startsAt), new Date(now));
      return diff >= 0 && diff <= 6;
    });
  }, [upcoming, data?.serverTime]);

  const weeklyDigest = useMemo(() => {
    return {
      activity: weekEvents.filter(event => event.category === "activity").length,
      exam: weekEvents.filter(event => event.category === "exam").length,
      assignment: weekEvents.filter(event => event.category === "assignment").length,
      notice: weekEvents.filter(event => event.category === "notice").length,
    };
  }, [weekEvents]);

  const unreadNotifications = notifications.filter(notification => !notification.isRead).length;

  const headerActions = (
    <div className="flex items-center gap-2">
      {isAdmin ? (
        <div className="hidden rounded-full border border-white/10 bg-white/6 p-1 md:flex">
          <Button
            type="button"
            size="sm"
            variant={previewMode === "student" ? "default" : "ghost"}
            className={previewMode === "student" ? "rounded-full bg-amber-300 text-slate-950 hover:bg-amber-200" : "rounded-full text-white/75 hover:bg-white/10 hover:text-white"}
            onClick={() => setPreviewMode("student")}
          >
            Ver aluno
          </Button>
          <Button
            type="button"
            size="sm"
            variant={previewMode === "professor" ? "default" : "ghost"}
            className={previewMode === "professor" ? "rounded-full bg-sky-700 text-white hover:bg-sky-500" : "rounded-full text-white/75 hover:bg-white/10 hover:text-white"}
            onClick={() => setPreviewMode("professor")}
          >
            Ver professor
          </Button>
        </div>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="rounded-full border-white/12 bg-white/5 text-white hover:bg-white/10 hover:text-white"
        onClick={() => {
          setSelectedDate(new Date());
          setLocation("/calendario");
        }}
      >
        Hoje
      </Button>
      {canManageEvents && isProfessorExperience ? (
        <Button
          type="button"
          className="rounded-full bg-amber-300 text-slate-950 hover:bg-amber-200"
          onClick={() => {
            resetComposer();
            setLocation("/calendario");
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo evento
        </Button>
      ) : null}
    </div>
  );

  const navWithBadges = navItems.map(item =>
    item.path === "/notificacoes"
      ? { ...item, badge: unreadNotifications ? String(unreadNotifications) : undefined }
      : item,
  );

  const selectedEvent = (eventDetailsQuery.data ?? null) as DashboardEvent | null;

  if (dashboardQuery.isLoading) {
    return <FullscreenLoader label="A preparar a experiência académica..." />;
  }

  if (dashboardQuery.isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="max-w-xl rounded-[2rem] border border-white/10 bg-white/6 p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <h1 className="text-2xl font-semibold">Não foi possível carregar o calendário.</h1>
          <p className="mt-3 text-white/62">Recarregue a aplicação para tentar novamente.</p>
          <Button className="mt-6 rounded-full bg-sky-700 text-white hover:bg-sky-500" onClick={() => dashboardQuery.refetch()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  const handleSubmitEvent = () => {
    if (!formState.title.trim() || !formState.description.trim() || !formState.startsAt) {
      toast.error("Preencha título, descrição e data do evento.");
      return;
    }

    const startsAt = parseLocalDate(formState.startsAt, formState.allDay);
    const endsAt = formState.endsAt ? parseLocalDate(formState.endsAt, formState.allDay) : null;

    if (Number.isNaN(startsAt) || (endsAt !== null && Number.isNaN(endsAt))) {
      toast.error("Informe datas válidas para continuar.");
      return;
    }

    if (endsAt !== null && endsAt < startsAt) {
      toast.error("A data final não pode ser anterior ao início do evento.");
      return;
    }

    const payload = {
      title: formState.title.trim(),
      description: formState.description.trim(),
      category: formState.category,
      priority: formState.priority,
      startsAt,
      endsAt,
      allDay: formState.allDay,
    };

    if (editingEventId) {
      updateEvent.mutate({ eventId: editingEventId, data: payload });
      return;
    }

    createEvent.mutate(payload);
  };

  return (
    <>
      <DashboardLayout
        menuItems={navWithBadges}
        title="Kairos"
        subtitle="Calendário académico moderno para professores e alunos"
        headerActions={headerActions}
      >
        {location === "/agenda" ? (
          <AgendaView
            agenda={filteredAgenda}
            summary={summary}
            serverTime={data.serverTime}
            searchText={searchText}
            onSearchChange={setSearchText}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            selectedPriority={selectedPriority}
            onPriorityChange={setSelectedPriority}
            onOpenEvent={eventId => setSelectedEventId(eventId)}
            canManage={canManageEvents && isProfessorExperience}
            onEdit={event => hydrateComposer(event, setFormState, setEditingEventId, setLocation)}
            onDelete={event => setDeletingEvent(event)}
          />
        ) : location === "/notificacoes" ? (
          <NotificationsView
            notifications={notifications}
            unreadCount={unreadNotifications}
            onRead={notificationId => markNotificationRead.mutate({ notificationId })}
            onReadAll={() => markAllNotificationsRead.mutate()}
            onOpenEvent={eventId => setSelectedEventId(eventId)}
          />
        ) : location === "/calendario" ? (
          <CalendarWorkspace
            experience={experience}
            canManage={canManageEvents && isProfessorExperience}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            selectedPriority={selectedPriority}
            onPriorityChange={setSelectedPriority}
            searchText={searchText}
            onSearchChange={setSearchText}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            monthEvents={filteredEvents}
            selectedDayEvents={selectedDayEvents}
            agenda={filteredAgenda}
            notifications={notifications}
            serverTime={data.serverTime}
            editingEventId={editingEventId}
            formState={formState}
            onFormChange={setFormState}
            onFormCancel={resetComposer}
            onFormSubmit={handleSubmitEvent}
            isSaving={createEvent.isPending || updateEvent.isPending}
            onOpenEvent={eventId => setSelectedEventId(eventId)}
            onEdit={event => hydrateComposer(event, setFormState, setEditingEventId, setLocation)}
            onDelete={event => setDeletingEvent(event)}
          />
        ) : (
          <DashboardOverview
            experience={experience}
            userName={currentUser?.name || "Comunidade académica"}
            summary={summary}
            widgets={widgets}
            serverTime={data.serverTime}
            todayEvents={todayEvents}
            weekEvents={weekEvents}
            weeklyDigest={weeklyDigest}
            agenda={filteredAgenda.slice(0, 6)}
            notifications={notifications.slice(0, 4)}
            onOpenEvent={eventId => setSelectedEventId(eventId)}
            onGoToCalendar={() => setLocation("/calendario")}
            onGoToAgenda={() => setLocation("/agenda")}
            onGoToNotifications={() => setLocation("/notificacoes")}
            canManage={canManageEvents && isProfessorExperience}
          />
        )}
      </DashboardLayout>

      <Dialog open={selectedEventId !== null} onOpenChange={open => !open && setSelectedEventId(null)}>
        <DialogContent
          showCloseButton={false}
          className="max-w-2xl overflow-hidden border-white/10 bg-[#070d18] p-0 text-white shadow-[0_36px_140px_-24px_rgba(0,0,0,0.7)]"
        >
          {eventDetailsQuery.isLoading ? (
            <div className="p-8">
              <FullscreenInlineLoader label="A carregar detalhes do evento..." />
            </div>
          ) : selectedEvent ? (
            <EventDetailsDialog
              event={selectedEvent}
              canManage={canManageEvents && isProfessorExperience}
              serverTime={data?.serverTime ?? Date.now()}
              onClose={() => setSelectedEventId(null)}
              onEdit={() => {
                hydrateComposer(selectedEvent, setFormState, setEditingEventId, setLocation);
                setSelectedEventId(null);
              }}
              onDelete={() => {
                setSelectedEventId(null);
                setDeletingEvent(selectedEvent);
              }}
            />
          ) : (
            <div className="p-8 text-sm text-white/60">Não foi possível carregar os detalhes deste evento.</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation modal */}
      {deletingEvent && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeletingEvent(null)} />
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#0a1120] shadow-[0_28px_80px_rgba(0,0,0,0.6)]">
            <div className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/14 text-red-400">
                  <Trash2 className="h-5 w-5" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-white">Remover evento</h3>
                  <p className="mt-0.5 text-xs text-white/40">Esta ação não pode ser desfeita</p>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                <p className="text-sm text-white/70">
                  Tem a certeza de que deseja remover <span className="font-semibold text-white">{deletingEvent.title}</span>?
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeletingEvent(null)}
                className="rounded-xl border-white/10 bg-white/5 text-sm text-white/60 hover:bg-white/10 hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => {
                  deleteEvent.mutate({ eventId: deletingEvent.id });
                  setDeletingEvent(null);
                }}
                className="rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-500"
              >
                Remover
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function DashboardOverview({
  experience,
  userName,
  summary,
  widgets,
  serverTime,
  todayEvents,
  weekEvents,
  weeklyDigest,
  agenda,
  notifications,
  onOpenEvent,
  onGoToCalendar,
  onGoToAgenda,
  onGoToNotifications,
  canManage,
}: {
  experience: string;
  userName: string;
  summary: DashboardSummary;
  widgets: DashboardWidgets;
  serverTime: number;
  todayEvents: DashboardEvent[];
  weekEvents: DashboardEvent[];
  weeklyDigest: Record<EventCategory, number>;
  agenda: DashboardEvent[];
  notifications: NotificationItem[];
  onOpenEvent: (eventId: number) => void;
  onGoToCalendar: () => void;
  onGoToAgenda: () => void;
  onGoToNotifications: () => void;
  canManage: boolean;
}) {
  return (
    <div className="space-y-6">
      <HeroPanel experience={experience} userName={userName} summary={summary} widgets={widgets} serverTime={serverTime} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          title="Atividades pendentes"
          value={summary.pendingActivities}
          description="Compromissos académicos planeados."
          icon={BookMarked}
          color="#3B82F6"
        />
        <DashboardStatCard
          title="Provas próximas"
          value={summary.upcomingExams}
          description={widgets.nextExam ? countdownLabel(widgets.nextExam.startsAt, serverTime) : "Sem prova agendada."}
          icon={GraduationCap}
          color="#EF4444"
        />
        <DashboardStatCard
          title="Prazos de entrega"
          value={summary.assignmentDeadlines}
          description={widgets.nextAssignment ? countdownLabel(widgets.nextAssignment.startsAt, serverTime) : "Sem entregas próximas."}
          icon={ClipboardCheck}
          color="#F97316"
        />
        <DashboardStatCard
          title="Avisos ativos"
          value={summary.notices}
          description={widgets.nextNotice ? formatEventDate(widgets.nextNotice.startsAt, widgets.nextNotice.allDay) : "Sem aviso em destaque."}
          icon={Megaphone}
          color="#22C55E"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <TodayLane
          todayEvents={todayEvents}
          weekEvents={weekEvents}
          weeklyDigest={weeklyDigest}
          onOpenEvent={onOpenEvent}
          onGoToCalendar={onGoToCalendar}
          canManage={canManage}
        />
        <CommandCenter
          agenda={agenda}
          notifications={notifications}
          serverTime={serverTime}
          onOpenEvent={onOpenEvent}
          onGoToAgenda={onGoToAgenda}
          onGoToNotifications={onGoToNotifications}
          canManage={canManage}
        />
      </div>
    </div>
  );
}

function CalendarWorkspace({
  experience,
  canManage,
  selectedCategory,
  onCategoryChange,
  selectedPriority,
  onPriorityChange,
  searchText,
  onSearchChange,
  selectedDate,
  onSelectDate,
  monthEvents,
  selectedDayEvents,
  agenda,
  notifications,
  serverTime,
  editingEventId,
  formState,
  onFormChange,
  onFormCancel,
  onFormSubmit,
  isSaving,
  onOpenEvent,
  onEdit,
  onDelete,
}: {
  experience: string;
  canManage: boolean;
  selectedCategory: EventCategory | "all";
  onCategoryChange: (value: EventCategory | "all") => void;
  selectedPriority: EventPriority | "all";
  onPriorityChange: (value: EventPriority | "all") => void;
  searchText: string;
  onSearchChange: (value: string) => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  monthEvents: DashboardEvent[];
  selectedDayEvents: DashboardEvent[];
  agenda: DashboardEvent[];
  notifications: NotificationItem[];
  serverTime: number;
  editingEventId: number | null;
  formState: EventFormState;
  onFormChange: (value: EventFormState) => void;
  onFormCancel: () => void;
  onFormSubmit: () => void;
  isSaving: boolean;
  onOpenEvent: (eventId: number) => void;
  onEdit: (event: DashboardEvent) => void;
  onDelete: (event: DashboardEvent) => void;
}) {
  const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(selectedDate));

  // Manter o viewMonth sincronizado quando o usuário pula para uma data fora do mês visível
  useEffect(() => {
    if (!isSameMonth(selectedDate, viewMonth)) {
      setViewMonth(startOfMonth(selectedDate));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  return (
    <div className="space-y-5">
      <CalendarHeader
        viewMonth={viewMonth}
        onChangeMonth={setViewMonth}
        onJumpToday={() => {
          setViewMonth(startOfMonth(new Date()));
          onSelectDate(new Date());
        }}
        monthEvents={monthEvents}
        selectedCategory={selectedCategory}
        onCategoryChange={onCategoryChange}
        selectedPriority={selectedPriority}
        onPriorityChange={onPriorityChange}
        searchText={searchText}
        onSearchChange={onSearchChange}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <MonthCalendar
            viewMonth={viewMonth}
            onChangeMonth={setViewMonth}
            events={monthEvents}
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
            onOpenEvent={onOpenEvent}
          />
          <DaySpotlight
            events={selectedDayEvents}
            selectedDate={selectedDate}
            serverTime={serverTime}
            onOpenEvent={onOpenEvent}
            canManage={canManage}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>

        <div className="space-y-4">
          <MiniMonthCalendar
            viewMonth={viewMonth}
            onChangeMonth={setViewMonth}
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
            events={monthEvents}
          />
          <CategoryBreakdown events={monthEvents} viewMonth={viewMonth} />

          {canManage ? (
            <ProfessorComposer
              editingEventId={editingEventId}
              formState={formState}
              isBusy={isSaving}
              onChange={onFormChange}
              onCancel={onFormCancel}
              onSubmit={onFormSubmit}
            />
          ) : (
            <StudentFocusPanel agenda={agenda} notifications={notifications} serverTime={serverTime} onOpenEvent={onOpenEvent} />
          )}

          <UpcomingEventsPanel agenda={agenda.slice(0, 5)} onEdit={onEdit} onDelete={onDelete} onOpenEvent={onOpenEvent} canManage={canManage} />
        </div>
      </div>
    </div>
  );
}

function AgendaView({
  agenda,
  summary,
  serverTime,
  searchText,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedPriority,
  onPriorityChange,
  onOpenEvent,
  canManage,
  onEdit,
  onDelete,
}: {
  agenda: DashboardEvent[];
  summary: DashboardSummary;
  serverTime: number;
  searchText: string;
  onSearchChange: (value: string) => void;
  selectedCategory: EventCategory | "all";
  onCategoryChange: (value: EventCategory | "all") => void;
  selectedPriority: EventPriority | "all";
  onPriorityChange: (value: EventPriority | "all") => void;
  onOpenEvent: (eventId: number) => void;
  canManage: boolean;
  onEdit: (event: DashboardEvent) => void;
  onDelete: (event: DashboardEvent) => void;
}) {
  const categoryBreakdown = useMemo(() => {
    return categoryOptions.map(opt => ({
      ...opt,
      count: agenda.filter(e => e.category === opt.value).length,
      color: getCategoryColor(opt.value),
    }));
  }, [agenda]);

  const totalEvents = agenda.length;
  const urgentEvents = agenda.filter(e => e.isUrgent);

  // Eventos agrupados por janela temporal
  const grouped = useMemo(() => groupAgendaByBucket(agenda, serverTime), [agenda, serverTime]);
  const nextEvent = agenda[0] ?? null;

  // Janela de 30 dias para o heat strip
  const horizon = useMemo(() => {
    const today = startOfDay(new Date(serverTime));
    const days = Array.from({ length: 30 }, (_, i) => addDays(today, i));
    const eventsPerDay = days.map(day =>
      agenda.filter(e => isSameDay(new Date(e.startsAt), day)),
    );
    return { today, days, eventsPerDay };
  }, [agenda, serverTime]);

  return (
    <div className="space-y-5">
      <AgendaHeader
        agenda={agenda}
        summary={summary}
        nextEvent={nextEvent}
        serverTime={serverTime}
        searchText={searchText}
        onSearchChange={onSearchChange}
        selectedCategory={selectedCategory}
        onCategoryChange={onCategoryChange}
        selectedPriority={selectedPriority}
        onPriorityChange={onPriorityChange}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Coluna principal */}
        <div className="space-y-5">
          <AgendaHeatStrip horizon={horizon} />

          {agenda.length ? (
            AGENDA_BUCKETS.filter(b => grouped[b.id].length > 0).map(bucket => (
              <AgendaGroupSection
                key={bucket.id}
                bucket={bucket}
                events={grouped[bucket.id]}
                serverTime={serverTime}
                onOpenEvent={onOpenEvent}
                canManage={canManage}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))
          ) : (
            <AgendaEmptyState searchText={searchText} />
          )}
        </div>

        {/* Sidebar contextual */}
        <aside className="space-y-4">
          <AgendaCategoryPanel data={categoryBreakdown} total={totalEvents} />
          {urgentEvents.length > 0 ? (
            <AgendaUrgentPanel
              urgent={urgentEvents}
              serverTime={serverTime}
              onOpenEvent={onOpenEvent}
            />
          ) : null}
          <AgendaNext24Panel
            agenda={agenda}
            serverTime={serverTime}
            onOpenEvent={onOpenEvent}
          />
          <AgendaQuickStats summary={summary} />
        </aside>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Helpers + group buckets
   ────────────────────────────────────────────────────────────────────── */

type AgendaBucketId = "today" | "tomorrow" | "thisWeek" | "thisMonth" | "later";

type AgendaBucketDef = {
  id: AgendaBucketId;
  label: string;
  hint: string;
  icon: typeof Sparkles;
  accent: string;
};

const AGENDA_BUCKETS: AgendaBucketDef[] = [
  { id: "today", label: "Hoje", hint: "Agora mesmo", icon: Zap, accent: "#F4C542" },
  { id: "tomorrow", label: "Amanhã", hint: "Em 24 horas", icon: Sunrise, accent: "#3ABEFF" },
  { id: "thisWeek", label: "Esta semana", hint: "Próximos dias", icon: CalendarRange, accent: "#A78BFA" },
  { id: "thisMonth", label: "Este mês", hint: "No horizonte", icon: CalendarDays, accent: "#34D399" },
  { id: "later", label: "Mais adiante", hint: "Planejamento futuro", icon: Hourglass, accent: "#94A3B8" },
];

function groupAgendaByBucket(
  agenda: DashboardEvent[],
  serverTime: number,
): Record<AgendaBucketId, DashboardEvent[]> {
  const today = startOfDay(new Date(serverTime));
  const tomorrow = addDays(today, 1);
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const monthEnd = endOfMonth(today);

  const result: Record<AgendaBucketId, DashboardEvent[]> = {
    today: [],
    tomorrow: [],
    thisWeek: [],
    thisMonth: [],
    later: [],
  };

  agenda.forEach(event => {
    const eventDay = startOfDay(new Date(event.startsAt));
    if (isSameDay(eventDay, today)) result.today.push(event);
    else if (isSameDay(eventDay, tomorrow)) result.tomorrow.push(event);
    else if (event.startsAt <= weekEnd.getTime()) result.thisWeek.push(event);
    else if (event.startsAt <= monthEnd.getTime()) result.thisMonth.push(event);
    else result.later.push(event);
  });

  return result;
}

function urgencyToneFor(event: DashboardEvent, serverTime: number): {
  tone: "critical" | "warning" | "watch" | "default";
  className: string;
} {
  const diffHours = (event.startsAt - serverTime) / (1000 * 60 * 60);
  if (event.isUrgent || diffHours <= 24) {
    return { tone: "critical", className: "bg-red-500/14 text-red-300 ring-1 ring-inset ring-red-400/25" };
  }
  if (diffHours <= 72) {
    return { tone: "warning", className: "bg-amber-300/14 text-amber-300 ring-1 ring-inset ring-amber-300/25" };
  }
  if (diffHours <= 24 * 7) {
    return { tone: "watch", className: "bg-sky-400/12 text-sky-300 ring-1 ring-inset ring-sky-400/25" };
  }
  return { tone: "default", className: "bg-white/[0.05] text-white/55 ring-1 ring-inset ring-white/10" };
}

/* ──────────────────────────────────────────────────────────────────────
   AgendaHeader · hero da página
   ────────────────────────────────────────────────────────────────────── */

function AgendaHeader({
  agenda,
  summary,
  nextEvent,
  serverTime,
  searchText,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedPriority,
  onPriorityChange,
}: {
  agenda: DashboardEvent[];
  summary: DashboardSummary;
  nextEvent: DashboardEvent | null;
  serverTime: number;
  searchText: string;
  onSearchChange: (v: string) => void;
  selectedCategory: EventCategory | "all";
  onCategoryChange: (v: EventCategory | "all") => void;
  selectedPriority: EventPriority | "all";
  onPriorityChange: (v: EventPriority | "all") => void;
}) {
  const horizonDays = 30;
  const horizonEnd = addDays(new Date(serverTime), horizonDays);
  const inHorizon = agenda.filter(e => e.startsAt <= horizonEnd.getTime()).length;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(0,114,188,0.16),rgba(7,17,31,0.55)_50%,rgba(244,197,66,0.12))] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)] backdrop-blur-xl">
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-amber-300/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

      <div className="relative grid gap-6 p-6 md:p-7 xl:grid-cols-[1.4fr_1fr] xl:items-center">
        <div className="flex items-center gap-5">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-sky-400/25 bg-sky-500/10 text-sky-300 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),0_8px_28px_-12px_rgba(58,190,255,0.55)]">
            <LayoutList className="h-7 w-7" />
            <span className="absolute -bottom-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-950 px-1.5 font-heading text-[10px] font-bold tabular-nums text-sky-300 shadow-[0_0_0_2px_rgba(58,190,255,0.35)]">
              {agenda.length}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-sky-300/85">
              Agenda futura · próximos {horizonDays} dias
            </p>
            <div className="mt-1 flex items-baseline gap-3">
              <h2 className="text-3xl font-semibold tracking-tight text-white md:text-[2.4rem]">Agenda</h2>
              <span className="font-heading text-2xl font-light tabular-nums text-white/35">
                {inHorizon}{agenda.length > inHorizon ? `+${agenda.length - inHorizon}` : ""}
              </span>
            </div>
            {nextEvent ? (
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-white/55">
                <Target className="h-3 w-3 text-amber-300" />
                <span className="text-white/40">Próximo:</span>
                <span className="font-medium text-white/80">{nextEvent.title}</span>
                <span className="text-white/30">·</span>
                <span className="font-medium tabular-nums text-amber-300">
                  {countdownLabel(nextEvent.startsAt, serverTime)}
                </span>
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-white/40">Sem eventos no horizonte. Explore com filtros.</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
          <HeaderKpi icon={CalendarDays} label="Total futuro" value={summary.totalFuture} color="#3ABEFF" />
          <HeaderKpi icon={ShieldAlert} label="Urgentes" value={summary.urgentCount} color="#F87171" pulse={summary.urgentCount > 0} />
          <HeaderKpi icon={GraduationCap} label="Provas" value={summary.upcomingExams} color="#F4C542" />
          <HeaderKpi icon={ClipboardCheck} label="Entregas" value={summary.assignmentDeadlines} color="#F97316" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="relative border-t border-white/8 bg-white/[0.02] px-5 py-3 md:px-7 md:py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
            <input
              value={searchText}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Buscar título, descrição ou categoria…"
              className="h-10 w-full rounded-full border border-white/10 bg-white/[0.05] pl-10 pr-9 text-sm text-white placeholder:text-white/30 outline-none transition-all focus:border-sky-400/40 focus:bg-white/[0.08] focus:ring-2 focus:ring-sky-400/15"
            />
            {searchText ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-white/40 hover:bg-white/[0.08] hover:text-white"
                aria-label="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
            <FilterPill label="Todas" active={selectedCategory === "all"} onClick={() => onCategoryChange("all")} compact />
            {categoryOptions.map(opt => (
              <FilterPill
                key={opt.value}
                label={opt.label}
                active={selectedCategory === opt.value}
                color={getCategoryColor(opt.value)}
                onClick={() => onCategoryChange(opt.value)}
                compact
              />
            ))}
          </div>
          <div className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1 lg:flex">
            <ListFilter className="ml-2 h-3 w-3 text-white/35" />
            {priorityOptions.map(opt => (
              <FilterPill
                key={opt.value}
                label={opt.label === "Todas as prioridades" ? "Todas" : opt.label}
                active={selectedPriority === opt.value}
                onClick={() => onPriorityChange(opt.value as EventPriority | "all")}
                compact
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   AgendaHeatStrip · 30 dias com densidade
   ────────────────────────────────────────────────────────────────────── */

function AgendaHeatStrip({
  horizon,
}: {
  horizon: { today: Date; days: Date[]; eventsPerDay: DashboardEvent[][] };
}) {
  const counts = horizon.eventsPerDay.map(arr => arr.length);
  const maxCount = Math.max(1, ...counts);
  const totalCount = counts.reduce((a, b) => a + b, 0);
  const busiestIdx = counts.reduce((maxIdx, c, i) => (c > counts[maxIdx] ? i : maxIdx), 0);
  const busiest = counts[busiestIdx];

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.015] p-5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" />

      <header className="mb-4 flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-300/12 text-amber-300">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/45">Densidade</p>
            <h4 className="mt-0.5 text-sm font-semibold tracking-tight text-white">
              Próximos 30 dias · <span className="font-heading tabular-nums text-amber-300">{totalCount}</span>{" "}
              <span className="text-white/55">evento{totalCount === 1 ? "" : "s"}</span>
            </h4>
          </div>
        </div>
        {busiest > 0 ? (
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/55">
            <Flame className="h-3 w-3 text-amber-300" />
            <span>Pico</span>
            <span className="font-heading text-[11px] tabular-nums text-amber-300">{busiest}</span>
            <span className="text-white/35">·</span>
            <span className="text-white/65">{format(horizon.days[busiestIdx], "d MMM", { locale: ptBR })}</span>
          </div>
        ) : null}
      </header>

      <div className="flex h-12 items-end gap-[3px]">
        {horizon.days.map((day, i) => {
          const count = counts[i];
          const dayEvents = horizon.eventsPerDay[i];
          const heightPct = count > 0 ? Math.max(20, (count / maxCount) * 100) : 6;
          const isToday = isSameDay(day, horizon.today);
          const dow = day.getDay();
          const isWeekend = dow === 0 || dow === 6;

          // Cor predominante: categoria mais frequente
          let topColor = "rgba(255,255,255,0.08)";
          if (count > 0) {
            const tally = new Map<string, number>();
            dayEvents.forEach(e => tally.set(e.categoryColor, (tally.get(e.categoryColor) ?? 0) + 1));
            let best: [string, number] = ["#3ABEFF", 0];
            tally.forEach((v, k) => {
              if (v > best[1]) best = [k, v];
            });
            topColor = best[0];
          }

          return (
            <div key={i} className="group/heat relative flex h-full flex-1 flex-col justify-end">
              <div
                className={cn(
                  "relative w-full overflow-hidden rounded-md transition-all duration-200",
                  count > 0 && "hover:opacity-90",
                )}
                style={{
                  height: `${heightPct}%`,
                  background:
                    count > 0
                      ? `linear-gradient(180deg, ${topColor}, ${topColor}55)`
                      : isWeekend
                      ? "rgba(244,197,66,0.05)"
                      : "rgba(255,255,255,0.025)",
                  boxShadow: count > 0 ? `0 0 12px ${topColor}55` : undefined,
                }}
              >
                {isToday ? (
                  <span className="absolute inset-x-0 top-0 h-px bg-amber-300" />
                ) : null}
              </div>

              {/* Tooltip on hover */}
              <div className="pointer-events-none absolute -top-12 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-slate-950/95 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur transition-opacity group-hover/heat:opacity-100">
                <span className="font-semibold capitalize">{format(day, "EEE d MMM", { locale: ptBR })}</span>
                <span className="ml-1.5 text-white/55">·</span>
                <span className="ml-1.5 font-heading font-bold tabular-nums text-amber-300">
                  {count} {count === 1 ? "evento" : "eventos"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex justify-between text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">
        <span className="text-amber-300/80">Hoje</span>
        <span>+15d</span>
        <span>+30d</span>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   AgendaGroupSection · um bucket temporal
   ────────────────────────────────────────────────────────────────────── */

function AgendaGroupSection({
  bucket,
  events,
  serverTime,
  onOpenEvent,
  canManage,
  onEdit,
  onDelete,
}: {
  bucket: AgendaBucketDef;
  events: DashboardEvent[];
  serverTime: number;
  onOpenEvent: (eventId: number) => void;
  canManage: boolean;
  onEdit: (event: DashboardEvent) => void;
  onDelete: (event: DashboardEvent) => void;
}) {
  const Icon = bucket.icon;
  const urgentInBucket = events.filter(e => e.isUrgent).length;
  const firstEventDate = events[0] ? new Date(events[0].startsAt) : null;
  const lastEventDate = events[events.length - 1] ? new Date(events[events.length - 1].startsAt) : null;

  return (
    <section>
      <header className="mb-3 flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl border"
          style={{ background: `${bucket.accent}1F`, borderColor: `${bucket.accent}30`, color: bucket.accent }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-2.5">
            <h3 className="text-base font-semibold tracking-tight text-white">{bucket.label}</h3>
            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">
              {bucket.hint}
            </span>
            {urgentInBucket > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/14 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300">
                <ShieldAlert className="h-2.5 w-2.5" />
                {urgentInBucket} urgente{urgentInBucket === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
          {firstEventDate && lastEventDate && bucket.id !== "today" && bucket.id !== "tomorrow" ? (
            <p className="mt-0.5 text-[11px] text-white/40">
              {format(firstEventDate, "d MMM", { locale: ptBR })}
              {!isSameDay(firstEventDate, lastEventDate) ? (
                <> → {format(lastEventDate, "d MMM", { locale: ptBR })}</>
              ) : null}
            </p>
          ) : null}
        </div>
        <span className="font-heading text-base font-bold tabular-nums text-white/55">{events.length}</span>
      </header>

      <ul className="space-y-2.5">
        {events.map(event => (
          <AgendaEventCard
            key={event.id}
            event={event}
            serverTime={serverTime}
            onOpen={() => onOpenEvent(event.id)}
            canManage={canManage}
            onEdit={() => onEdit(event)}
            onDelete={() => onDelete(event)}
          />
        ))}
      </ul>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   AgendaEventCard · cartão rico de evento
   ────────────────────────────────────────────────────────────────────── */

function AgendaEventCard({
  event,
  serverTime,
  onOpen,
  canManage,
  onEdit,
  onDelete,
}: {
  event: DashboardEvent;
  serverTime: number;
  onOpen: () => void;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const startDate = new Date(event.startsAt);
  const endDate = event.endsAt ? new Date(event.endsAt) : null;
  const upcoming = event.startsAt > serverTime;
  const urgency = urgencyToneFor(event, serverTime);
  const dow = startDate.getDay();
  const isWeekend = dow === 0 || dow === 6;
  const durationMin = endDate ? Math.max(0, (endDate.getTime() - startDate.getTime()) / 60000) : null;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group/agenda relative flex w-full gap-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06] hover:shadow-[0_16px_44px_-16px_rgba(0,0,0,0.6)]"
      >
        {/* Color bar */}
        <span
          className="pointer-events-none absolute inset-y-0 left-0 w-1 rounded-r-full"
          style={{
            background: `linear-gradient(180deg, ${event.categoryColor}, ${event.categoryColor}55)`,
            boxShadow: `0 0 16px ${event.categoryColor}66`,
          }}
        />
        {/* Top accent */}
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-50"
          style={{ background: `linear-gradient(90deg, transparent, ${event.categoryColor}, transparent)` }}
        />

        {/* Date tile */}
        <div
          className={cn(
            "relative flex w-[72px] shrink-0 flex-col items-center justify-center rounded-xl border bg-gradient-to-b px-2 py-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]",
            isWeekend
              ? "border-amber-300/20 from-amber-300/10 to-amber-300/[0.02]"
              : "border-white/10 from-white/[0.06] to-white/[0.02]",
          )}
        >
          <span className={cn("text-[9px] font-bold uppercase tracking-[0.24em]", isWeekend ? "text-amber-300/70" : "text-white/45")}>
            {format(startDate, "EEE", { locale: ptBR })}
          </span>
          <span className="font-heading text-2xl font-bold tabular-nums leading-none text-white">
            {format(startDate, "d")}
          </span>
          <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.24em] text-white/45">
            {format(startDate, "MMM", { locale: ptBR })}
          </span>
          {!event.allDay ? (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/[0.08] px-1.5 py-0.5 font-heading text-[9px] font-bold tabular-nums text-white/75">
              <Clock3 className="h-2 w-2" />
              {format(startDate, "HH:mm")}
            </span>
          ) : (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-300/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
              dia
            </span>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ background: `${event.categoryColor}22`, color: event.categoryColor }}
            >
              <span className="h-1 w-1 rounded-full" style={{ background: event.categoryColor }} />
              {event.categoryLabel}
            </span>
            <span
              className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-white/60"
              style={{ borderColor: event.priorityRing }}
            >
              {event.priorityLabel}
            </span>
            {event.isUrgent ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/14 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300">
                <ShieldAlert className="h-2.5 w-2.5" />
                Urgente
              </span>
            ) : null}
            {upcoming ? (
              <span
                className={cn(
                  "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider tabular-nums",
                  urgency.className,
                )}
              >
                <Clock3 className="h-2.5 w-2.5" />
                {countdownLabel(event.startsAt, serverTime)}
              </span>
            ) : null}
          </div>

          <h3 className="mt-2 truncate text-[15px] font-semibold leading-tight text-white transition-colors group-hover/agenda:text-amber-200">
            {event.title}
          </h3>

          {event.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/55">{event.description}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-white/40">
            <span className="inline-flex items-center gap-1 capitalize">
              <CalendarDays className="h-3 w-3" />
              {format(startDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </span>
            {!event.allDay ? (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Clock3 className="h-3 w-3" />
                {format(startDate, "HH:mm")}
                {endDate ? <> → {format(endDate, "HH:mm")}</> : null}
              </span>
            ) : null}
            {durationMin && durationMin > 0 ? (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Hourglass className="h-3 w-3" />
                {durationMin >= 60 ? `${Math.round(durationMin / 60)}h` : `${Math.round(durationMin)}min`}
              </span>
            ) : null}
            {isWeekend ? (
              <span className="inline-flex items-center gap-1 text-amber-300/65">
                <Sunrise className="h-3 w-3" />
                Fim de semana
              </span>
            ) : null}
          </div>
        </div>

        {canManage ? (
          <div className="flex shrink-0 flex-col gap-1.5 opacity-0 transition-opacity group-hover/agenda:opacity-100">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onEdit();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/55 hover:bg-amber-300/15 hover:text-amber-300"
              aria-label="Editar"
            >
              <PencilLine className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onDelete();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/55 hover:bg-red-500/15 hover:text-red-300"
              aria-label="Remover"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ) : null}
      </button>
    </li>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Sidebar panels
   ────────────────────────────────────────────────────────────────────── */

function AgendaCategoryPanel({
  data,
  total,
}: {
  data: Array<{ value: EventCategory; label: string; icon: typeof BookMarked; count: number; color: string }>;
  total: number;
}) {
  const max = Math.max(1, ...data.map(d => d.count));
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.015] p-5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/25 to-transparent" />

      <header className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/45">Distribuição</p>
          <h4 className="mt-1 text-[13px] font-semibold tracking-tight text-white">Por categoria</h4>
        </div>
        <div className="flex items-baseline gap-1.5">
          <TrendingUp className="h-3 w-3 text-white/30" />
          <span className="font-heading text-base font-bold tabular-nums text-white">{total}</span>
        </div>
      </header>

      <div className="space-y-3">
        {data.map(item => {
          const pct = (item.count / max) * 100;
          const sharePct = total > 0 ? (item.count / total) * 100 : 0;
          return (
            <div key={item.value}>
              <div className="mb-1.5 flex items-center justify-between text-[12px]">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/10"
                    style={{ background: `${item.color}1F`, color: item.color }}
                  >
                    <item.icon className="h-3 w-3" />
                  </span>
                  <span className="truncate font-medium text-white/80">{item.label}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-heading text-sm font-bold tabular-nums text-white">{item.count}</span>
                  <span className="text-[10px] font-medium tabular-nums text-white/35">{Math.round(sharePct)}%</span>
                </div>
              </div>
              <div className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${item.color}AA, ${item.color})`,
                    boxShadow: item.count > 0 ? `0 0 12px ${item.color}66` : "none",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AgendaUrgentPanel({
  urgent,
  serverTime,
  onOpenEvent,
}: {
  urgent: DashboardEvent[];
  serverTime: number;
  onOpenEvent: (eventId: number) => void;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-red-400/25 bg-gradient-to-br from-red-500/[0.08] to-red-500/[0.02] p-5 shadow-[0_8px_24px_-12px_rgba(239,68,68,0.35)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-400/40 to-transparent" />
      <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-red-500/15 blur-2xl" />

      <header className="mb-4 flex items-center gap-2.5">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-red-400/30 bg-red-500/15 text-red-300">
          <ShieldAlert className="h-4 w-4" />
          <span className="absolute inset-0 animate-ping rounded-xl bg-red-500/30 opacity-40" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-red-300/80">Atenção</p>
          <h4 className="text-[13px] font-semibold tracking-tight text-white">
            {urgent.length} item{urgent.length === 1 ? "" : "s"} urgente{urgent.length === 1 ? "" : "s"}
          </h4>
        </div>
      </header>

      <ul className="space-y-2">
        {urgent.slice(0, 4).map(event => (
          <li key={event.id}>
            <button
              type="button"
              onClick={() => onOpenEvent(event.id)}
              className="group/u flex w-full items-center gap-3 rounded-xl border border-red-400/15 bg-red-500/[0.04] p-2.5 text-left transition-all hover:border-red-400/35 hover:bg-red-500/[0.08]"
            >
              <span
                className="h-9 w-1 shrink-0 rounded-full"
                style={{ background: `linear-gradient(180deg, ${event.categoryColor}, ${event.categoryColor}55)`, boxShadow: `0 0 8px ${event.categoryColor}aa` }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-white">{event.title}</p>
                <p className="mt-0.5 text-[11px] capitalize text-red-300/75">
                  {format(new Date(event.startsAt), "EEE, d MMM", { locale: ptBR })}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-1 font-heading text-[10px] font-bold tabular-nums text-red-300">
                <Clock3 className="h-2.5 w-2.5" />
                {countdownLabel(event.startsAt, serverTime)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AgendaNext24Panel({
  agenda,
  serverTime,
  onOpenEvent,
}: {
  agenda: DashboardEvent[];
  serverTime: number;
  onOpenEvent: (eventId: number) => void;
}) {
  const horizon24 = serverTime + 24 * 60 * 60 * 1000;
  const next = agenda.filter(e => e.startsAt >= serverTime && e.startsAt <= horizon24).slice(0, 4);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.015] p-5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" />

      <header className="mb-3 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-300/12 text-amber-300">
          <Hourglass className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/45">Próximas 24h</p>
          <h4 className="text-[13px] font-semibold tracking-tight text-white">
            {next.length === 0 ? "Janela limpa" : `${next.length} compromisso${next.length === 1 ? "" : "s"}`}
          </h4>
        </div>
      </header>

      {next.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] py-4 text-center text-xs text-white/40">
          Nada nos próximos dois turnos.
        </p>
      ) : (
        <ol className="relative space-y-2.5 before:absolute before:left-[11px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-gradient-to-b before:from-white/15 before:via-white/8 before:to-transparent">
          {next.map(event => (
            <li key={event.id} className="relative flex gap-2.5">
              <span
                className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 bg-slate-950/80"
                style={{ boxShadow: `0 0 0 2px ${event.categoryColor}33, 0 0 12px ${event.categoryColor}55` }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: event.categoryColor }} />
              </span>
              <button
                type="button"
                onClick={() => onOpenEvent(event.id)}
                className="group/n flex-1 rounded-xl border border-white/8 bg-white/[0.03] p-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                    style={{ background: `${event.categoryColor}22`, color: event.categoryColor }}
                  >
                    {event.categoryLabel}
                  </span>
                  <span className="font-heading text-[10px] font-bold tabular-nums text-amber-300">
                    {countdownLabel(event.startsAt, serverTime)}
                  </span>
                </div>
                <p className="mt-1.5 truncate text-[12px] font-semibold text-white">{event.title}</p>
                <p className="mt-0.5 text-[10px] tabular-nums text-white/45">
                  {format(new Date(event.startsAt), "HH:mm")}
                  {event.endsAt ? <> → {format(new Date(event.endsAt), "HH:mm")}</> : null}
                </p>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function AgendaQuickStats({ summary }: { summary: DashboardSummary }) {
  const items = [
    { label: "Provas", value: summary.upcomingExams, icon: GraduationCap, color: "#EF4444" },
    { label: "Atividades", value: summary.pendingActivities, icon: BookMarked, color: "#3B82F6" },
    { label: "Entregas", value: summary.assignmentDeadlines, icon: ClipboardCheck, color: "#F97316" },
    { label: "Avisos", value: summary.notices, icon: Megaphone, color: "#22C55E" },
  ];

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.015] p-4 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <header className="mb-3 flex items-center gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/45">Resumo geral</p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        {items.map(item => (
          <div
            key={item.label}
            className="group/q relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] p-3 transition-all hover:border-white/20 hover:bg-white/[0.05]"
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{ background: `linear-gradient(90deg, transparent, ${item.color}, transparent)` }}
            />
            <div className="flex items-center justify-between">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10"
                style={{ background: `${item.color}1F`, color: item.color }}
              >
                <item.icon className="h-3.5 w-3.5" />
              </span>
              <span className="font-heading text-xl font-bold tabular-nums text-white">{item.value}</span>
            </div>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AgendaEmptyState({ searchText }: { searchText: string }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-dashed border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/45">
        <Inbox className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-white">
        {searchText.trim() ? "Nenhum resultado para os filtros atuais." : "Sua agenda futura está limpa."}
      </h3>
      <p className="mt-1 text-sm text-white/45">
        {searchText.trim()
          ? "Ajuste a busca, categoria ou prioridade para ampliar a visão."
          : "Aproveite o respiro — novos eventos publicados aparecerão aqui automaticamente."}
      </p>
    </section>
  );
}

type NotificationFilter = "all" | "unread" | "read";

function NotificationsView({
  notifications,
  unreadCount,
  onRead,
  onReadAll,
  onOpenEvent,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
  onRead: (notificationId: number) => void;
  onReadAll: () => void;
  onOpenEvent: (eventId: number) => void;
}) {
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<EventCategory | "all">("all");

  // Estatísticas (calculadas do dataset completo)
  const stats = useMemo(() => {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const newToday = notifications.filter(n => new Date(n.createdAt).getTime() >= dayAgo).length;
    const newThisWeek = notifications.filter(n => new Date(n.createdAt).getTime() >= weekAgo).length;
    return { total: notifications.length, newToday, newThisWeek };
  }, [notifications]);

  const categoryStats = useMemo(() => {
    const counts: Record<EventCategory, number> = { activity: 0, exam: 0, assignment: 0, notice: 0 };
    notifications.forEach(n => {
      if (n.category) counts[n.category] = (counts[n.category] ?? 0) + 1;
    });
    return categoryOptions.map(opt => ({
      ...opt,
      count: counts[opt.value],
      color: getCategoryColor(opt.value),
    }));
  }, [notifications]);

  // Aplicar filtros
  const filtered = useMemo(() => {
    return notifications.filter(n => {
      if (filter === "unread" && n.isRead) return false;
      if (filter === "read" && !n.isRead) return false;
      if (categoryFilter !== "all" && n.category !== categoryFilter) return false;
      return true;
    });
  }, [notifications, filter, categoryFilter]);

  // Agrupar por bucket temporal
  const grouped = useMemo(() => groupNotificationsByBucket(filtered), [filtered]);
  const orderedBuckets = NOTIFICATION_BUCKETS.filter(b => grouped[b.id].length > 0);

  return (
    <div className="space-y-5">
      <NotificationsHeader
        total={stats.total}
        unread={unreadCount}
        newToday={stats.newToday}
        newThisWeek={stats.newThisWeek}
        filter={filter}
        onFilterChange={setFilter}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        onReadAll={onReadAll}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Coluna principal */}
        <div className="space-y-5">
          {filtered.length === 0 ? (
            <NotificationsEmptyState filter={filter} unread={unreadCount} />
          ) : (
            orderedBuckets.map(bucket => (
              <NotificationsGroup
                key={bucket.id}
                bucket={bucket}
                notifications={grouped[bucket.id]}
                onRead={onRead}
                onOpenEvent={onOpenEvent}
              />
            ))
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <NotificationsUnreadHero unread={unreadCount} newToday={stats.newToday} onReadAll={onReadAll} />
          <NotificationsCategoryPanel data={categoryStats} total={stats.total} />
          <NotificationsTipsPanel />
        </aside>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Buckets temporais para notificações
   ────────────────────────────────────────────────────────────────────── */

type NotificationBucketId = "today" | "yesterday" | "thisWeek" | "older";

type NotificationBucketDef = {
  id: NotificationBucketId;
  label: string;
  hint: string;
  icon: typeof Sparkles;
  accent: string;
};

const NOTIFICATION_BUCKETS: NotificationBucketDef[] = [
  { id: "today", label: "Hoje", hint: "Últimas 24h", icon: BellRing, accent: "#F4C542" },
  { id: "yesterday", label: "Ontem", hint: "Recém-passado", icon: Clock3, accent: "#3ABEFF" },
  { id: "thisWeek", label: "Esta semana", hint: "Últimos 7 dias", icon: CalendarRange, accent: "#A78BFA" },
  { id: "older", label: "Mais antigo", hint: "Arquivo", icon: Inbox, accent: "#94A3B8" },
];

function groupNotificationsByBucket(
  notifications: NotificationItem[],
): Record<NotificationBucketId, NotificationItem[]> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = startOfDay(addDays(now, -1));
  const weekStart = startOfDay(addDays(now, -7));

  const result: Record<NotificationBucketId, NotificationItem[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: [],
  };

  // ordenar por data desc (mais recente primeiro)
  const sorted = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  sorted.forEach(n => {
    const created = new Date(n.createdAt);
    if (created >= todayStart) result.today.push(n);
    else if (created >= yesterdayStart) result.yesterday.push(n);
    else if (created >= weekStart) result.thisWeek.push(n);
    else result.older.push(n);
  });

  return result;
}

function formatRelativeTimeShort(value: Date | string) {
  const d = new Date(value);
  const now = Date.now();
  const diff = now - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `há ${days}d`;
  return format(d, "d MMM", { locale: ptBR });
}

/* ──────────────────────────────────────────────────────────────────────
   NotificationsHeader · hero
   ────────────────────────────────────────────────────────────────────── */

function NotificationsHeader({
  total,
  unread,
  newToday,
  newThisWeek,
  filter,
  onFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  onReadAll,
}: {
  total: number;
  unread: number;
  newToday: number;
  newThisWeek: number;
  filter: NotificationFilter;
  onFilterChange: (f: NotificationFilter) => void;
  categoryFilter: EventCategory | "all";
  onCategoryFilterChange: (v: EventCategory | "all") => void;
  onReadAll: () => void;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(244,197,66,0.14),rgba(7,17,31,0.55)_50%,rgba(0,114,188,0.16))] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)] backdrop-blur-xl">
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-amber-300/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-sky-500/12 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

      <div className="relative grid gap-6 p-6 md:p-7 xl:grid-cols-[1.4fr_1fr] xl:items-center">
        <div className="flex items-center gap-5">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-amber-300/30 bg-amber-300/10 text-amber-300 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),0_8px_28px_-12px_rgba(244,197,66,0.55)]">
            {unread > 0 ? <BellRing className="h-7 w-7" /> : <Bell className="h-7 w-7" />}
            {unread > 0 ? (
              <span className="absolute -bottom-1.5 -right-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 font-heading text-[11px] font-bold tabular-nums text-white shadow-[0_0_0_2px_rgba(7,17,31,1)]">
                {unread > 99 ? "99+" : unread}
              </span>
            ) : (
              <span className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_0_0_2px_rgba(7,17,31,1)]">
                <Check className="h-3 w-3" />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-amber-300/85">
              Centro de notificações
            </p>
            <div className="mt-1 flex items-baseline gap-3">
              <h2 className="text-3xl font-semibold tracking-tight text-white md:text-[2.4rem]">
                {unread > 0 ? "Há novidades" : "Tudo em dia"}
              </h2>
              {unread > 0 ? (
                <span className="font-heading text-2xl font-light tabular-nums text-amber-300/85">
                  {unread}
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-white/55">
              <span className="font-medium text-white/75">{total}</span>
              <span className="text-white/40">total</span>
              <span className="text-white/15">·</span>
              <span className="font-medium text-amber-300">{newToday}</span>
              <span className="text-white/40">hoje</span>
              <span className="text-white/15">·</span>
              <span className="font-medium text-sky-300">{newThisWeek}</span>
              <span className="text-white/40">esta semana</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <HeaderKpi icon={BellRing} label="Não lidas" value={unread} color="#F87171" pulse={unread > 0} />
          <HeaderKpi icon={Zap} label="Novas hoje" value={newToday} color="#F4C542" />
          <HeaderKpi icon={Inbox} label="Total" value={total} color="#3ABEFF" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="relative border-t border-white/8 bg-white/[0.02] px-5 py-3 md:px-7 md:py-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status tabs */}
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
            <NotificationTab label="Todas" count={total} active={filter === "all"} onClick={() => onFilterChange("all")} />
            <NotificationTab
              label="Não lidas"
              count={unread}
              active={filter === "unread"}
              onClick={() => onFilterChange("unread")}
              highlight={unread > 0}
            />
            <NotificationTab label="Lidas" count={total - unread} active={filter === "read"} onClick={() => onFilterChange("read")} />
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
            <FilterPill label="Todas categorias" active={categoryFilter === "all"} onClick={() => onCategoryFilterChange("all")} compact />
            {categoryOptions.map(opt => (
              <FilterPill
                key={opt.value}
                label={opt.label}
                active={categoryFilter === opt.value}
                color={getCategoryColor(opt.value)}
                onClick={() => onCategoryFilterChange(opt.value)}
                compact
              />
            ))}
          </div>

          <div className="ml-auto">
            <Button
              type="button"
              onClick={onReadAll}
              disabled={unread === 0}
              className={cn(
                "h-9 rounded-full text-xs font-bold transition-all",
                unread === 0
                  ? "border border-white/10 bg-white/[0.03] text-white/35"
                  : "bg-amber-300 text-slate-950 shadow-[0_8px_20px_-8px_rgba(244,197,66,0.55)] hover:bg-amber-200",
              )}
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
              Marcar todas
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function NotificationTab({
  label,
  count,
  active,
  onClick,
  highlight = false,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition-all",
        active
          ? "bg-white/[0.12] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
          : "text-white/45 hover:bg-white/[0.06] hover:text-white/80",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 font-heading text-[10px] font-bold tabular-nums",
          active
            ? highlight
              ? "bg-red-500/22 text-red-300"
              : "bg-white/[0.08] text-white/65"
            : highlight
            ? "bg-red-500/15 text-red-300"
            : "bg-white/[0.05] text-white/45",
        )}
      >
        {count}
      </span>
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   NotificationsGroup · um bucket
   ────────────────────────────────────────────────────────────────────── */

function NotificationsGroup({
  bucket,
  notifications,
  onRead,
  onOpenEvent,
}: {
  bucket: NotificationBucketDef;
  notifications: NotificationItem[];
  onRead: (id: number) => void;
  onOpenEvent: (eventId: number) => void;
}) {
  const Icon = bucket.icon;
  const unreadInBucket = notifications.filter(n => !n.isRead).length;

  return (
    <section>
      <header className="mb-3 flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl border"
          style={{ background: `${bucket.accent}1F`, borderColor: `${bucket.accent}30`, color: bucket.accent }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-2.5">
            <h3 className="text-base font-semibold tracking-tight text-white">{bucket.label}</h3>
            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">{bucket.hint}</span>
            {unreadInBucket > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/14 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                <span className="h-1 w-1 rounded-full bg-amber-300" />
                {unreadInBucket} {unreadInBucket === 1 ? "nova" : "novas"}
              </span>
            ) : null}
          </div>
        </div>
        <span className="font-heading text-base font-bold tabular-nums text-white/55">{notifications.length}</span>
      </header>

      <ul className="space-y-2.5">
        {notifications.map(notification => (
          <NotificationCard
            key={notification.id}
            notification={notification}
            onRead={() => onRead(notification.id)}
            onOpenEvent={() => onOpenEvent(notification.eventId)}
          />
        ))}
      </ul>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   NotificationCard · cartão rico
   ────────────────────────────────────────────────────────────────────── */

function NotificationCard({
  notification,
  onRead,
  onOpenEvent,
}: {
  notification: NotificationItem;
  onRead: () => void;
  onOpenEvent: () => void;
}) {
  const cat = notification.category;
  const tint =
    cat === "exam"
      ? "#EF4444"
      : cat === "assignment"
      ? "#F97316"
      : cat === "activity"
      ? "#3B82F6"
      : cat === "notice"
      ? "#22C55E"
      : "#F4C542";
  const Icon =
    cat === "exam"
      ? GraduationCap
      : cat === "assignment"
      ? ClipboardCheck
      : cat === "activity"
      ? BookMarked
      : cat === "notice"
      ? Megaphone
      : Sparkles;
  const catLabel = cat ? categoryLabel(cat) : "Atualização";
  const isUnread = !notification.isRead;

  return (
    <li>
      <article
        className={cn(
          "group/notif relative overflow-hidden rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_44px_-16px_rgba(0,0,0,0.6)]",
          isUnread
            ? "border-white/15 bg-gradient-to-br from-white/[0.06] to-white/[0.015]"
            : "border-white/8 bg-white/[0.02] opacity-85",
        )}
        style={
          isUnread
            ? {
                boxShadow: `inset 3px 0 0 ${tint}`,
              }
            : undefined
        }
      >
        {/* Top accent line para não lidas */}
        {isUnread ? (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60"
            style={{ background: `linear-gradient(90deg, transparent, ${tint}, transparent)` }}
          />
        ) : null}

        <div className="flex gap-4">
          {/* Avatar/icon tematizado */}
          <div className="relative shrink-0">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl border shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]",
              )}
              style={{
                background: `linear-gradient(180deg, ${tint}22, ${tint}08)`,
                borderColor: `${tint}30`,
                color: tint,
              }}
            >
              <Icon className="h-5 w-5" />
            </div>
            {isUnread ? (
              <span className="absolute -right-1 -top-1 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-70" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-300 ring-2 ring-slate-950" />
              </span>
            ) : null}
          </div>

          {/* Conteúdo */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: `${tint}22`, color: tint }}
              >
                <span className="h-1 w-1 rounded-full" style={{ background: tint }} />
                {catLabel}
              </span>
              {isUnread ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  <Sparkles className="h-2.5 w-2.5" />
                  Novo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/40">
                  <CheckCheck className="h-2.5 w-2.5" />
                  Lido
                </span>
              )}
              <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider tabular-nums text-white/45">
                <Clock3 className="h-2.5 w-2.5" />
                {formatRelativeTimeShort(notification.createdAt)}
              </span>
            </div>

            <h4
              className={cn(
                "mt-2 truncate text-[15px] font-semibold leading-tight transition-colors group-hover/notif:text-amber-200",
                isUnread ? "text-white" : "text-white/65",
              )}
            >
              {notification.title}
            </h4>
            <p className={cn("mt-1 line-clamp-2 text-xs leading-relaxed", isUnread ? "text-white/65" : "text-white/45")}>
              {notification.message}
            </p>

            {/* Footer actions */}
            <div className="mt-3 flex items-center gap-2 text-[11px]">
              <span className="text-white/30">{formatNotificationDate(notification.createdAt)}</span>
              <span className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onOpenEvent}
                  className="inline-flex items-center gap-1 rounded-full border border-sky-400/25 bg-sky-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-300 transition-all hover:bg-sky-500/20"
                >
                  <Eye className="h-2.5 w-2.5" />
                  Ver evento
                </button>
                {isUnread ? (
                  <button
                    type="button"
                    onClick={onRead}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300 transition-all hover:bg-amber-300/20"
                  >
                    <Check className="h-2.5 w-2.5" />
                    Marcar lida
                  </button>
                ) : null}
              </span>
            </div>
          </div>
        </div>
      </article>
    </li>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Sidebar panels
   ────────────────────────────────────────────────────────────────────── */

function NotificationsUnreadHero({
  unread,
  newToday,
  onReadAll,
}: {
  unread: number;
  newToday: number;
  onReadAll: () => void;
}) {
  if (unread === 0) {
    return (
      <section className="relative overflow-hidden rounded-2xl border border-emerald-400/25 bg-gradient-to-br from-emerald-500/12 to-emerald-500/[0.02] p-5 shadow-[0_8px_24px_-12px_rgba(16,185,129,0.4)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/15 text-emerald-300">
            <CheckCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-300/80">Caixa limpa</p>
            <h4 className="mt-0.5 text-[13px] font-semibold tracking-tight text-white">Tudo lido</h4>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-white/55">
          Você está em dia com todas as atualizações. Continue assim.
        </p>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-amber-300/25 bg-gradient-to-br from-amber-300/15 to-amber-300/[0.02] p-5 shadow-[0_8px_24px_-12px_rgba(244,197,66,0.45)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/45 to-transparent" />
      <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-amber-300/15 blur-2xl" />

      <div className="flex items-start gap-3">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-amber-300/40 bg-amber-300/15 text-amber-300">
          <BellRing className="h-5 w-5" />
          <span className="absolute inset-0 animate-ping rounded-xl bg-amber-300/30 opacity-30" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-300/85">Atenção</p>
          <h4 className="mt-0.5 text-[13px] font-semibold tracking-tight text-white">
            Você tem alertas pendentes
          </h4>
        </div>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="font-heading text-4xl font-bold tabular-nums leading-none text-amber-300">{unread}</span>
        <span className="text-xs font-medium text-white/55">não lidas</span>
      </div>
      <p className="mt-1 text-[11px] text-white/45">
        {newToday > 0 ? (
          <>
            <span className="font-bold tabular-nums text-white/75">{newToday}</span>{" "}
            chegaram nas últimas 24 horas
          </>
        ) : (
          "Acumuladas dos últimos dias"
        )}
      </p>

      <Button
        type="button"
        onClick={onReadAll}
        className="mt-4 h-8 w-full rounded-full bg-amber-300 text-[11px] font-bold uppercase tracking-wider text-slate-950 shadow-[0_4px_12px_-4px_rgba(244,197,66,0.5)] hover:bg-amber-200"
      >
        <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
        Marcar todas como lidas
      </Button>
    </section>
  );
}

function NotificationsCategoryPanel({
  data,
  total,
}: {
  data: Array<{ value: EventCategory; label: string; icon: typeof BookMarked; count: number; color: string }>;
  total: number;
}) {
  const max = Math.max(1, ...data.map(d => d.count));
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.015] p-5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/25 to-transparent" />

      <header className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/45">Origens</p>
          <h4 className="mt-1 text-[13px] font-semibold tracking-tight text-white">Por categoria</h4>
        </div>
        <div className="flex items-baseline gap-1.5">
          <CircleDot className="h-3 w-3 text-white/30" />
          <span className="font-heading text-base font-bold tabular-nums text-white">{total}</span>
        </div>
      </header>

      {total === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] py-4 text-center text-xs text-white/40">
          Sem notificações até o momento.
        </p>
      ) : (
        <div className="space-y-3">
          {data.map(item => {
            const pct = (item.count / max) * 100;
            const sharePct = total > 0 ? (item.count / total) * 100 : 0;
            return (
              <div key={item.value}>
                <div className="mb-1.5 flex items-center justify-between text-[12px]">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/10"
                      style={{ background: `${item.color}1F`, color: item.color }}
                    >
                      <item.icon className="h-3 w-3" />
                    </span>
                    <span className="truncate font-medium text-white/80">{item.label}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-heading text-sm font-bold tabular-nums text-white">{item.count}</span>
                    <span className="text-[10px] font-medium tabular-nums text-white/35">{Math.round(sharePct)}%</span>
                  </div>
                </div>
                <div className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${item.color}AA, ${item.color})`,
                      boxShadow: item.count > 0 ? `0 0 12px ${item.color}66` : "none",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function NotificationsTipsPanel() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.015] p-5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/25 to-transparent" />
      <header className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-sky-400/25 bg-sky-500/12 text-sky-300">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/45">Dicas rápidas</p>
      </header>
      <ul className="space-y-2.5 text-[11px] leading-relaxed text-white/55">
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-sky-400" />
          Toque em <span className="font-semibold text-white/75">Ver evento</span> para abrir os detalhes do compromisso.
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-300" />
          Use o filtro <span className="font-semibold text-white/75">Não lidas</span> para focar no que precisa de atenção.
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
          Notificações são geradas automaticamente quando docentes publicam ou atualizam eventos.
        </li>
      </ul>
    </section>
  );
}

function NotificationsEmptyState({ filter, unread }: { filter: NotificationFilter; unread: number }) {
  const allEmpty = filter === "all";
  const isUnreadFilter = filter === "unread";
  const isReadFilter = filter === "read";

  return (
    <section className="relative overflow-hidden rounded-3xl border border-dashed border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent p-12 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/45">
        {isUnreadFilter && unread === 0 ? (
          <CheckCheck className="h-7 w-7 text-emerald-400" />
        ) : (
          <MailOpen className="h-7 w-7" />
        )}
      </div>
      <h3 className="mt-5 text-lg font-semibold text-white">
        {allEmpty
          ? "Nenhuma notificação por enquanto."
          : isUnreadFilter
          ? "Você não tem mensagens novas."
          : isReadFilter
          ? "Sem notificações já lidas."
          : "Nenhum resultado para os filtros."}
      </h3>
      <p className="mt-2 text-sm text-white/45">
        {allEmpty
          ? "Quando publicações ou atualizações ocorrerem no calendário, elas aparecerão aqui automaticamente."
          : isUnreadFilter
          ? "Você está em dia com tudo. Aproveite a paz para focar."
          : "Mude o filtro para visualizar outras notificações."}
      </p>
    </section>
  );
}

function HeroPanel({
  experience,
  userName,
  summary,
  widgets,
  serverTime,
}: {
  experience: string;
  userName: string;
  summary: DashboardSummary;
  widgets: DashboardWidgets;
  serverTime: number;
}) {
  const audienceLabel = experience === "professor" ? "Painel de professor" : "Painel de aluno";
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 5 ? "Boa madrugada" : hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const dateLabel = format(now, "EEEE, d 'de' MMMM", { locale: ptBR });
  const firstName = userName.split(" ")[0] || userName;
  const subline = experience === "professor"
    ? "Sua agenda académica está sincronizada. Acompanhe publicações, prioridades e prazos críticos abaixo."
    : "Tudo o que importa no seu semestre — provas, prazos e alertas em leitura imediata.";

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(0,114,188,0.18),rgba(7,17,31,0.55)_45%,rgba(244,197,66,0.14))] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)] backdrop-blur-xl">
      {/* radial accents para profundidade */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-300/12 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl" />
      {/* hairline luminosa no topo */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

      <div className="relative grid gap-8 p-6 md:p-8 xl:grid-cols-[1.15fr_0.85fr] xl:items-center xl:gap-10">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium uppercase tracking-[0.24em] text-white/55">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-emerald-300/90">ao vivo</span>
            <span className="text-white/20">·</span>
            <span>{audienceLabel}</span>
            <span className="text-white/20">·</span>
            <span>{dateLabel}</span>
          </div>

          <h2 className="mt-5 text-3xl font-semibold leading-[1.05] tracking-tight text-white md:text-[2.6rem]">
            {greeting}, <span className="brand-text-gold">{firstName}</span>.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65 md:text-[15px]">{subline}</p>

          <div className="mt-6 flex flex-wrap gap-2">
            <HeroChip label="Eventos futuros" value={summary.totalFuture} color="#3ABEFF" />
            <HeroChip label="Urgentes" value={summary.urgentCount} color="#F87171" pulse={summary.urgentCount > 0} />
            <HeroChip label="Provas" value={summary.upcomingExams} color="#FBBF24" />
            <HeroChip label="Prazos" value={summary.assignmentDeadlines} color="#F97316" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <KpiTile
            label="Próxima prova"
            title={widgets.nextExam?.title ?? "Sem prova agendada"}
            sub={widgets.nextExam ? countdownLabel(widgets.nextExam.startsAt, serverTime) : "Aguardando publicação"}
            color="#EF4444"
            icon={GraduationCap}
            empty={!widgets.nextExam}
          />
          <KpiTile
            label="Próximo prazo"
            title={widgets.nextAssignment?.title ?? "Sem prazo ativo"}
            sub={widgets.nextAssignment ? countdownLabel(widgets.nextAssignment.startsAt, serverTime) : "Sem entregas"}
            color="#F97316"
            icon={ClipboardCheck}
            empty={!widgets.nextAssignment}
          />
        </div>
      </div>
    </section>
  );
}

function HeroChip({
  label,
  value,
  color,
  pulse = false,
}: {
  label: string;
  value: number;
  color: string;
  pulse?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 backdrop-blur-md">
      <span className="relative flex h-1.5 w-1.5">
        {pulse ? (
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
            style={{ backgroundColor: color }}
          />
        ) : null}
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      </span>
      <span className="text-[11px] uppercase tracking-[0.16em] text-white/55">{label}</span>
      <span className="font-heading text-sm font-semibold tabular-nums text-white">{value}</span>
    </div>
  );
}

function KpiTile({
  label,
  title,
  sub,
  color,
  icon: Icon,
  empty = false,
}: {
  label: string;
  title: string;
  sub: string;
  color: string;
  icon: typeof Sparkles;
  empty?: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full opacity-25 blur-2xl transition-opacity group-hover:opacity-40"
        style={{ background: color }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/45">{label}</p>
          <p className={cn("mt-2 line-clamp-1 text-[15px] font-semibold leading-tight", empty ? "text-white/55" : "text-white")}>
            {title}
          </p>
          <p className="mt-1.5 text-xs font-medium text-white/55">{sub}</p>
        </div>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10"
          style={{ background: `${color}20`, color }}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function TodayLane({
  todayEvents,
  weekEvents,
  weeklyDigest,
  onOpenEvent,
  onGoToCalendar,
  canManage,
}: {
  todayEvents: DashboardEvent[];
  weekEvents: DashboardEvent[];
  weeklyDigest: Record<EventCategory, number>;
  onOpenEvent: (eventId: number) => void;
  onGoToCalendar: () => void;
  canManage: boolean;
}) {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const eventsPerDay = weekDays.map(day =>
    weekEvents.filter(e => isSameDay(new Date(e.startsAt), day)).length
  );
  const maxPerDay = Math.max(1, ...eventsPerDay);

  const digestItems: Array<{ label: string; value: number; color: string; icon: typeof Sparkles }> = [
    { label: "Atividades", value: weeklyDigest.activity, color: "#3B82F6", icon: BookMarked },
    { label: "Provas", value: weeklyDigest.exam, color: "#EF4444", icon: GraduationCap },
    { label: "Trabalhos", value: weeklyDigest.assignment, color: "#F97316", icon: ClipboardCheck },
    { label: "Avisos", value: weeklyDigest.notice, color: "#22C55E", icon: Megaphone },
  ];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.015] shadow-[0_16px_44px_-16px_rgba(0,0,0,0.55)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" />

      {/* Header */}
      <header className="flex items-center justify-between gap-4 border-b border-white/8 bg-white/[0.02] px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/12 text-amber-300 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/45">
              {format(today, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
            <h3 className="mt-0.5 text-base font-semibold tracking-tight text-white">
              {todayEvents.length === 0
                ? "Sem compromissos hoje"
                : `${todayEvents.length} compromisso${todayEvents.length === 1 ? "" : "s"} hoje`}
            </h3>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-full border-white/12 bg-white/[0.04] text-xs font-medium text-white hover:bg-white/[0.08] hover:text-white"
          onClick={onGoToCalendar}
        >
          Abrir calendário
          <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </header>

      {/* Today list */}
      <div className="space-y-2 px-6 pt-5">
        {todayEvents.length ? (
          todayEvents.map(event => (
            <button
              key={event.id}
              type="button"
              onClick={() => onOpenEvent(event.id)}
              className="group/item w-full rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-white/18 hover:bg-white/[0.06] hover:shadow-[0_10px_32px_-12px_rgba(0,0,0,0.6)]"
            >
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-center">
                  {event.allDay ? (
                    <>
                      <span className="font-heading text-sm font-bold leading-none text-white">DIA</span>
                      <span className="mt-1 text-[9px] font-medium uppercase tracking-[0.2em] text-white/40">inteiro</span>
                    </>
                  ) : (
                    <>
                      <span className="font-heading text-sm font-bold leading-none tabular-nums text-white">
                        {format(new Date(event.startsAt), "HH:mm")}
                      </span>
                      <span className="mt-1 text-[9px] font-medium uppercase tracking-[0.2em] text-white/40">hoje</span>
                    </>
                  )}
                </div>
                <span
                  className="h-12 w-1 self-stretch rounded-full"
                  style={{
                    background: `linear-gradient(180deg, ${event.categoryColor}, ${event.categoryColor}55)`,
                    opacity: event.isUrgent ? 1 : 0.7,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ background: `${event.categoryColor}22`, color: event.categoryColor }}
                    >
                      {event.categoryLabel}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                      {event.priorityLabel}
                    </span>
                    {event.isUrgent ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-300">
                        <ShieldAlert className="h-2.5 w-2.5" />
                        Urgente
                      </span>
                    ) : null}
                  </div>
                  <h4 className="mt-2 truncate text-[15px] font-semibold leading-tight text-white transition-colors group-hover/item:text-amber-200">
                    {event.title}
                  </h4>
                  <p className="mt-1 line-clamp-1 text-xs leading-relaxed text-white/55">
                    {event.description || "Sem descrição adicional."}
                  </p>
                </div>
                <ChevronRight className="hidden h-4 w-4 shrink-0 text-white/30 transition-all group-hover/item:translate-x-1 group-hover/item:text-amber-300 sm:block" />
              </div>
            </button>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/45">
              <CalendarCheck2 className="h-4 w-4" />
            </div>
            <p className="mt-3 text-sm font-medium text-white/65">Nenhum compromisso para hoje.</p>
            <p className="mt-1 text-xs text-white/40">
              {canManage
                ? "Aproveite para publicar novos eventos para sua turma."
                : "Aproveite o tempo livre para revisar conteúdo da semana."}
            </p>
          </div>
        )}
      </div>

      {/* Weekly heatmap */}
      <div className="mt-6 border-t border-white/8 px-6 py-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/45">Distribuição semanal</p>
            <h4 className="mt-1 text-sm font-semibold tracking-tight text-white">
              {weekEvents.length} evento{weekEvents.length === 1 ? "" : "s"} de {format(weekStart, "d MMM", { locale: ptBR })} a {format(addDays(weekStart, 6), "d MMM", { locale: ptBR })}
            </h4>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {weekDays.map((day, i) => {
            const isCurrent = isSameDay(day, today);
            const count = eventsPerDay[i];
            const heightPct = count > 0 ? Math.max(18, (count / maxPerDay) * 100) : 0;
            const dayLabel = format(day, "EEEEEE", { locale: ptBR });
            return (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className={cn(
                  "relative flex h-20 w-full items-end overflow-hidden rounded-lg border bg-white/[0.025] transition-colors",
                  isCurrent ? "border-amber-300/50" : "border-white/8 group-hover:border-white/15",
                )}>
                  {count > 0 ? (
                    <div
                      className={cn(
                        "w-full rounded-md transition-all",
                        isCurrent ? "bg-gradient-to-t from-amber-300 to-amber-200" : "bg-gradient-to-t from-sky-500/70 to-sky-400/40",
                      )}
                      style={{ height: `${heightPct}%` }}
                    />
                  ) : null}
                  {count > 0 ? (
                    <span
                      className={cn(
                        "absolute inset-x-0 top-1.5 text-center font-heading text-[11px] font-bold tabular-nums",
                        isCurrent ? "text-slate-950" : "text-white",
                      )}
                    >
                      {count}
                    </span>
                  ) : null}
                  {isCurrent ? (
                    <span className="absolute inset-x-0 bottom-0 h-px bg-amber-300" />
                  ) : null}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium uppercase tracking-[0.16em]",
                    isCurrent ? "font-bold text-amber-300" : "text-white/40",
                  )}
                >
                  {dayLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category digest pills */}
      <div className="border-t border-white/8 px-6 py-4">
        <div className="flex flex-wrap gap-2">
          {digestItems.map(item => (
            <div
              key={item.label}
              className="group/pill flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 transition-all hover:border-white/20 hover:bg-white/[0.06]"
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{ background: `${item.color}1F`, color: item.color }}
              >
                <item.icon className="h-3.5 w-3.5" />
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/45">
                  {item.label}
                </span>
                <span className="font-heading text-sm font-semibold tabular-nums text-white">
                  {item.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CommandCenter({
  agenda,
  notifications,
  serverTime,
  onOpenEvent,
  onGoToAgenda,
  onGoToNotifications,
  canManage,
}: {
  agenda: DashboardEvent[];
  notifications: NotificationItem[];
  serverTime: number;
  onOpenEvent: (eventId: number) => void;
  onGoToAgenda: () => void;
  onGoToNotifications: () => void;
  canManage: boolean;
}) {
  const upcoming = agenda.slice(0, 4);
  const recentAlerts = notifications.slice(0, 4);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="space-y-6">
      {/* Próximos movimentos — timeline */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.015] shadow-[0_16px_44px_-16px_rgba(0,0,0,0.55)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/30 to-transparent" />

        <header className="flex items-center justify-between gap-4 border-b border-white/8 bg-white/[0.02] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-500/14 text-sky-300">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/45">Próximos</p>
              <h3 className="mt-0.5 text-base font-semibold tracking-tight text-white">Movimentos da agenda</h3>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-full border-white/12 bg-white/[0.04] text-xs font-medium text-white hover:bg-white/[0.08] hover:text-white"
            onClick={onGoToAgenda}
          >
            Ver agenda
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </header>

        <div className="px-6 py-5">
          {upcoming.length ? (
            <ol className="relative space-y-3 before:absolute before:left-[15px] before:top-3 before:h-[calc(100%-1.5rem)] before:w-px before:bg-gradient-to-b before:from-white/15 before:via-white/8 before:to-transparent">
              {upcoming.map(event => (
                <li key={event.id} className="relative flex gap-3.5">
                  <span
                    className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-slate-950/80 backdrop-blur-md transition-transform group-hover:scale-110"
                    style={{ boxShadow: `0 0 0 3px ${event.categoryColor}33, 0 0 20px ${event.categoryColor}22` }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: event.categoryColor }} />
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenEvent(event.id)}
                    className="group/event flex-1 rounded-2xl border border-white/8 bg-white/[0.03] p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-white/18 hover:bg-white/[0.06] hover:shadow-[0_10px_28px_-12px_rgba(0,0,0,0.6)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                        style={{ background: `${event.categoryColor}22`, color: event.categoryColor }}
                      >
                        {event.categoryLabel}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider tabular-nums",
                          event.isUrgent
                            ? "bg-red-500/14 text-red-300"
                            : "bg-amber-300/12 text-amber-300",
                        )}
                      >
                        {event.isUrgent ? <ShieldAlert className="h-2.5 w-2.5" /> : <Clock3 className="h-2.5 w-2.5" />}
                        {countdownLabel(event.startsAt, serverTime)}
                      </span>
                    </div>
                    <h4 className="mt-2 truncate text-sm font-semibold text-white transition-colors group-hover/event:text-amber-200">
                      {event.title}
                    </h4>
                    <p className="mt-1 truncate text-xs text-white/50">
                      {formatEventDate(event.startsAt, event.allDay)} · {event.priorityLabel}
                    </p>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/45">
                <Sparkles className="h-4 w-4" />
              </div>
              <p className="mt-3 text-sm font-medium text-white/65">Agenda futura limpa.</p>
              <p className="mt-1 text-xs text-white/40">Nada exigindo atenção neste momento.</p>
            </div>
          )}
        </div>
      </section>

      {/* Alertas recentes */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.015] shadow-[0_16px_44px_-16px_rgba(0,0,0,0.55)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" />

        <header className="flex items-center justify-between gap-4 border-b border-white/8 bg-white/[0.02] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/12 text-amber-300">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-[0_0_0_2px_rgba(7,17,31,1)]">
                  {unreadCount}
                </span>
              ) : null}
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/45">Alertas</p>
              <h3 className="mt-0.5 text-base font-semibold tracking-tight text-white">Notificações recentes</h3>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-full border-white/12 bg-white/[0.04] text-xs font-medium text-white hover:bg-white/[0.08] hover:text-white"
            onClick={onGoToNotifications}
          >
            Ver tudo
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </header>

        {recentAlerts.length ? (
          <ul className="divide-y divide-white/6">
            {recentAlerts.map(notification => {
              const cat = notification.category;
              const tint =
                cat === "exam" ? "#EF4444" : cat === "assignment" ? "#F97316" : cat === "activity" ? "#3B82F6" : cat === "notice" ? "#22C55E" : "#F4C542";
              const Icon =
                cat === "exam" ? GraduationCap : cat === "assignment" ? ClipboardCheck : cat === "activity" ? BookMarked : cat === "notice" ? Megaphone : Sparkles;
              return (
                <li
                  key={notification.id}
                  className={cn(
                    "group/notif flex gap-3 px-6 py-4 transition-colors hover:bg-white/[0.025]",
                    !notification.isRead && "bg-white/[0.015]",
                  )}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10"
                    style={{ background: `${tint}1F`, color: tint }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-white">{notification.title}</p>
                      {!notification.isRead ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                          Novo
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/55">
                      {notification.message}
                    </p>
                    <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-white/35">
                      {formatNotificationDate(notification.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-6 py-8 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/45">
              <Bell className="h-4 w-4" />
            </div>
            <p className="mt-3 text-sm font-medium text-white/65">Sem alertas recentes.</p>
            <p className="mt-1 text-xs text-white/40">
              {canManage
                ? "Nenhuma atualização enviada para os alunos ainda."
                : "Você está em dia com as atualizações."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function ToolbarFilters({
  selectedCategory,
  onCategoryChange,
  selectedPriority,
  onPriorityChange,
  searchText,
  onSearchChange,
}: {
  selectedCategory: EventCategory | "all";
  onCategoryChange: (value: EventCategory | "all") => void;
  selectedPriority: EventPriority | "all";
  onPriorityChange: (value: EventPriority | "all") => void;
  searchText: string;
  onSearchChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[180px] flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/32" />
        <input
          value={searchText}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Pesquisar eventos..."
          className="h-10 w-full rounded-full border border-white/10 bg-white/6 pl-9 pr-4 text-sm text-white placeholder:text-white/26 outline-none backdrop-blur-xl transition focus:border-sky-400/36 focus:bg-white/8"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterPill label="Todos" active={selectedCategory === "all"} onClick={() => onCategoryChange("all")} />
        {categoryOptions.map(opt => (
          <FilterPill
            key={opt.value}
            label={opt.label}
            active={selectedCategory === opt.value}
            color={getCategoryColor(opt.value)}
            onClick={() => onCategoryChange(opt.value)}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {priorityOptions.map(opt => (
          <FilterPill
            key={opt.value}
            label={opt.label}
            active={selectedPriority === opt.value}
            onClick={() => onPriorityChange(opt.value as EventPriority | "all")}
          />
        ))}
      </div>
    </div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
  color,
  compact = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition-all",
          active
            ? "bg-white/[0.12] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
            : "text-white/45 hover:bg-white/[0.06] hover:text-white/80",
        )}
      >
        {color ? (
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: color, boxShadow: active ? `0 0 8px ${color}` : "none" }}
          />
        ) : null}
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
        active
          ? "border-white/20 bg-white/12 text-white"
          : "border-white/8 bg-white/4 text-white/44 hover:border-white/14 hover:bg-white/8 hover:text-white/72",
      )}
    >
      {color && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />}
      {label}
    </button>
  );
}

function CalendarHeader({
  viewMonth,
  onChangeMonth,
  onJumpToday,
  monthEvents,
  selectedCategory,
  onCategoryChange,
  selectedPriority,
  onPriorityChange,
  searchText,
  onSearchChange,
}: {
  viewMonth: Date;
  onChangeMonth: (month: Date) => void;
  onJumpToday: () => void;
  monthEvents: DashboardEvent[];
  selectedCategory: EventCategory | "all";
  onCategoryChange: (value: EventCategory | "all") => void;
  selectedPriority: EventPriority | "all";
  onPriorityChange: (value: EventPriority | "all") => void;
  searchText: string;
  onSearchChange: (value: string) => void;
}) {
  const stats = useMemo(() => {
    const inMonth = monthEvents.filter(e => isSameMonth(new Date(e.startsAt), viewMonth));
    const urgent = inMonth.filter(e => e.isUrgent).length;
    const byDay = new Map<string, number>();
    inMonth.forEach(e => {
      const k = format(new Date(e.startsAt), "yyyy-MM-dd");
      byDay.set(k, (byDay.get(k) ?? 0) + 1);
    });
    let busiestKey = "";
    let busiestCount = 0;
    byDay.forEach((v, k) => {
      if (v > busiestCount) {
        busiestCount = v;
        busiestKey = k;
      }
    });
    return {
      total: inMonth.length,
      urgent,
      busiestDate: busiestKey ? new Date(busiestKey + "T12:00:00") : null,
      busiestCount,
    };
  }, [monthEvents, viewMonth]);

  const isCurrentMonth = isSameMonth(viewMonth, new Date());
  const monthsAhead = differenceInCalendarDays(viewMonth, startOfMonth(new Date()));

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(0,114,188,0.16),rgba(7,17,31,0.55)_50%,rgba(244,197,66,0.12))] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)] backdrop-blur-xl">
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-amber-300/12 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

      {/* TOPO: identidade + nav + KPIs */}
      <div className="relative grid gap-6 p-6 md:p-7 xl:grid-cols-[1.35fr_1fr] xl:items-center">
        <div className="flex items-center gap-5">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-300/10 text-amber-300 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),0_8px_28px_-12px_rgba(244,197,66,0.55)]">
            <CalendarRange className="h-7 w-7" />
            <span className="absolute -bottom-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-950 px-1.5 font-heading text-[10px] font-bold tabular-nums text-amber-300 shadow-[0_0_0_2px_rgba(244,197,66,0.4)]">
              {format(viewMonth, "d")}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-amber-300/85">
              Calendário académico
              {!isCurrentMonth ? <span className="ml-2 text-white/35">· {monthsAhead > 0 ? `+${Math.abs(monthsAhead)}d adiante` : `${monthsAhead}d atrás`}</span> : null}
            </p>
            <div className="mt-1 flex items-baseline gap-3">
              <h2 className="text-3xl font-semibold capitalize tracking-tight text-white md:text-[2.4rem]">
                {format(viewMonth, "MMMM", { locale: ptBR })}
              </h2>
              <span className="font-heading text-2xl font-light tabular-nums text-white/35">
                {format(viewMonth, "yyyy")}
              </span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChangeMonth(subMonths(viewMonth, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/65 transition-all hover:-translate-x-0.5 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onJumpToday}
              className={cn(
                "rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition-all",
                isCurrentMonth
                  ? "border-amber-300/30 bg-amber-300/10 text-amber-300 hover:bg-amber-300/15"
                  : "border-white/12 bg-white/[0.05] text-white/70 hover:border-amber-300/30 hover:bg-amber-300/10 hover:text-amber-300",
              )}
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => onChangeMonth(addMonths(viewMonth, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/65 transition-all hover:translate-x-0.5 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 3 KPIs do mês */}
        <div className="grid grid-cols-3 gap-2.5">
          <HeaderKpi icon={CalendarDays} label="Eventos no mês" value={stats.total} color="#3ABEFF" />
          <HeaderKpi icon={ShieldAlert} label="Urgentes" value={stats.urgent} color="#F87171" pulse={stats.urgent > 0} />
          <HeaderKpi
            icon={Flame}
            label="Pico"
            value={stats.busiestCount}
            sub={stats.busiestDate ? format(stats.busiestDate, "d MMM", { locale: ptBR }) : "—"}
            color="#F4C542"
          />
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="relative border-t border-white/8 bg-white/[0.02] px-5 py-3 md:px-7 md:py-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
            <input
              value={searchText}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Buscar título, descrição ou categoria…"
              className="h-10 w-full rounded-full border border-white/10 bg-white/[0.05] pl-10 pr-9 text-sm text-white placeholder:text-white/30 outline-none transition-all focus:border-amber-300/40 focus:bg-white/[0.08] focus:ring-2 focus:ring-amber-300/15"
            />
            {searchText ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-white/40 hover:bg-white/[0.08] hover:text-white"
                aria-label="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {/* Categorias */}
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
            <FilterPill label="Todas" active={selectedCategory === "all"} onClick={() => onCategoryChange("all")} compact />
            {categoryOptions.map(opt => (
              <FilterPill
                key={opt.value}
                label={opt.label}
                active={selectedCategory === opt.value}
                color={getCategoryColor(opt.value)}
                onClick={() => onCategoryChange(opt.value)}
                compact
              />
            ))}
          </div>

          {/* Prioridades */}
          <div className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1 lg:flex">
            <Filter className="ml-2 h-3 w-3 text-white/35" />
            {priorityOptions.map(opt => (
              <FilterPill
                key={opt.value}
                label={opt.label === "Todas as prioridades" ? "Todas" : opt.label}
                active={selectedPriority === opt.value}
                onClick={() => onPriorityChange(opt.value as EventPriority | "all")}
                compact
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HeaderKpi({
  icon: Icon,
  label,
  value,
  color,
  sub,
  pulse = false,
}: {
  icon: typeof Sparkles;
  label: string;
  value: number;
  color: string;
  sub?: string;
  pulse?: boolean;
}) {
  return (
    <div className="group/kpi relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full opacity-25 blur-2xl transition-opacity group-hover/kpi:opacity-40"
        style={{ background: color }}
      />
      <div className="relative flex items-center gap-2.5">
        <span
          className={cn("relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10")}
          style={{ background: `${color}20`, color }}
        >
          <Icon className="h-4 w-4" />
          {pulse ? (
            <span className="absolute inset-0 animate-ping rounded-xl opacity-40" style={{ background: color }} />
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-white/45">{label}</p>
          <div className="flex items-baseline gap-1.5">
            <span className="font-heading text-xl font-bold tabular-nums text-white">{value}</span>
            {sub ? <span className="truncate text-[10px] font-medium text-white/45">{sub}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniMonthCalendar({
  viewMonth,
  onChangeMonth,
  selectedDate,
  onSelectDate,
  events,
}: {
  viewMonth: Date;
  onChangeMonth: (m: Date) => void;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  events: DashboardEvent[];
}) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  const eventDays = useMemo(() => {
    const map = new Map<string, number>();
    events.forEach(e => {
      const k = format(new Date(e.startsAt), "yyyy-MM-dd");
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return map;
  }, [events]);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.015] p-4 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]">
      <header className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/45">Navegar</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChangeMonth(subMonths(viewMonth, 1))}
            className="flex h-6 w-6 items-center justify-center rounded-full text-white/45 hover:bg-white/[0.08] hover:text-white"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[88px] text-center text-[12px] font-semibold capitalize text-white">
            {format(viewMonth, "MMM yyyy", { locale: ptBR })}
          </span>
          <button
            type="button"
            onClick={() => onChangeMonth(addMonths(viewMonth, 1))}
            className="flex h-6 w-6 items-center justify-center rounded-full text-white/45 hover:bg-white/[0.08] hover:text-white"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => (
          <div key={i} className="text-center text-[9px] font-bold uppercase tracking-widest text-white/25">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const isSel = isSameDay(day, selectedDate);
          const isTd = isToday(day);
          const inM = isSameMonth(day, viewMonth);
          const k = format(day, "yyyy-MM-dd");
          const count = eventDays.get(k) ?? 0;
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDate(day)}
              className={cn(
                "relative flex h-7 w-full items-center justify-center rounded-md text-[11px] font-semibold tabular-nums transition-all",
                !inM && "opacity-25",
                isSel && "bg-amber-300 font-bold text-slate-950 shadow-[0_4px_12px_rgba(244,197,66,0.45)]",
                !isSel && isTd && "text-amber-300 ring-1 ring-amber-300/45",
                !isSel && !isTd && "text-white/55 hover:bg-white/[0.08] hover:text-white",
              )}
            >
              {format(day, "d")}
              {count > 0 && !isSel ? (
                <span className="absolute bottom-0.5 left-1/2 h-1 -translate-x-1/2 rounded-full bg-sky-400" style={{ width: count >= 3 ? 6 : 3 }} />
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CategoryBreakdown({
  events,
  viewMonth,
}: {
  events: DashboardEvent[];
  viewMonth: Date;
}) {
  const data = useMemo(() => {
    const counts: Record<EventCategory, number> = { activity: 0, exam: 0, assignment: 0, notice: 0 };
    events.forEach(e => {
      counts[e.category] = (counts[e.category] ?? 0) + 1;
    });
    return categoryOptions.map(opt => ({
      ...opt,
      count: counts[opt.value],
      color: getCategoryColor(opt.value),
    }));
  }, [events]);

  const total = data.reduce((acc, d) => acc + d.count, 0);
  const max = Math.max(1, ...data.map(d => d.count));

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.015] p-5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/25 to-transparent" />

      <header className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/45">Distribuição</p>
          <h4 className="mt-1 text-[13px] font-semibold capitalize tracking-tight text-white">
            {format(viewMonth, "MMMM", { locale: ptBR })}
          </h4>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3 text-white/30" />
          <span className="font-heading text-base font-bold tabular-nums text-white">{total}</span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-white/35">eventos</span>
        </div>
      </header>

      {total === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] py-5 text-center text-xs text-white/40">
          Nenhum evento neste mês.
        </p>
      ) : (
        <div className="space-y-3">
          {data.map(item => {
            const pct = (item.count / max) * 100;
            const sharePct = (item.count / Math.max(1, total)) * 100;
            return (
              <div key={item.value}>
                <div className="mb-1.5 flex items-center justify-between text-[12px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/10"
                      style={{ background: `${item.color}1F`, color: item.color }}
                    >
                      <item.icon className="h-3 w-3" />
                    </span>
                    <span className="truncate font-medium text-white/80">{item.label}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-heading text-sm font-bold tabular-nums text-white">{item.count}</span>
                    <span className="text-[10px] font-medium tabular-nums text-white/35">
                      {Math.round(sharePct)}%
                    </span>
                  </div>
                </div>
                <div className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${item.color}AA, ${item.color})`,
                      boxShadow: item.count > 0 ? `0 0 12px ${item.color}66` : "none",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MonthCalendar({
  viewMonth,
  onChangeMonth,
  events,
  selectedDate,
  onSelectDate,
  onOpenEvent,
}: {
  viewMonth: Date;
  onChangeMonth: (month: Date) => void;
  events: DashboardEvent[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onOpenEvent: (eventId: number) => void;
}) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, DashboardEvent[]>();
    for (const event of events) {
      const key = format(new Date(event.startsAt), "yyyy-MM-dd");
      const bucket = map.get(key) ?? [];
      bucket.push(event);
      map.set(key, bucket);
    }
    map.forEach(bucket => bucket.sort((a, b) => a.startsAt - b.startsAt));
    return map;
  }, [events]);

  const today = new Date();
  const weekdayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.015] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" />

      {/* Sub-header com mini-nav e legenda */}
      <header className="flex items-center justify-between gap-3 border-b border-white/8 bg-white/[0.025] px-5 py-3.5">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-white/45">
          <CalendarRange className="h-3.5 w-3.5 text-amber-300" />
          <span>Visão mensal</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 md:flex">
            {categoryOptions.map(option => {
              const color = getCategoryColor(option.value);
              return (
                <div key={option.value} className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }} />
                  {option.label}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-0.5">
            <IconCircleMicroButton icon={ChevronLeft} onClick={() => onChangeMonth(subMonths(viewMonth, 1))} aria="Mês anterior" />
            <IconCircleMicroButton icon={ChevronRight} onClick={() => onChangeMonth(addMonths(viewMonth, 1))} aria="Próximo mês" />
          </div>
        </div>
      </header>

      {/* Weekday header rail */}
      <div className="grid grid-cols-7 border-b border-white/8 bg-white/[0.015]">
        {weekdayLabels.map((label, i) => {
          const isWeekend = i >= 5;
          return (
            <div
              key={label}
              className={cn(
                "relative py-3.5 text-center text-[10px] font-bold uppercase tracking-[0.28em]",
                isWeekend ? "text-amber-300/60" : "text-white/40",
              )}
            >
              {label}
              {isWeekend ? <span className="absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-300/15 to-transparent" /> : null}
            </div>
          );
        })}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDate.get(key) ?? [];
          const isSelected = isSameDay(day, selectedDate);
          const isTodayDay = isToday(day);
          const isCurrentMonth = isSameMonth(day, viewMonth);
          const isPast = isBefore(endOfDay(day), startOfDay(today));
          const dow = day.getDay();
          const isWeekend = dow === 0 || dow === 6;
          const isLastRow = idx >= days.length - 7;
          const isLastCol = (idx + 1) % 7 === 0;

          // Density rail (categoria → contagem)
          const rail: Array<[string, number]> = [];
          const railMap = new Map<string, number>();
          dayEvents.forEach(e => railMap.set(e.categoryColor, (railMap.get(e.categoryColor) ?? 0) + 1));
          railMap.forEach((count, color) => rail.push([color, count]));

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(day)}
              className={cn(
                "group/cell relative flex min-h-[140px] flex-col p-2.5 text-left transition-all duration-200",
                !isLastRow && "border-b border-white/6",
                !isLastCol && "border-r border-white/6",
                isWeekend && isCurrentMonth && !isSelected && "bg-amber-300/[0.012]",
                !isCurrentMonth && "opacity-30",
                isPast && isCurrentMonth && !isSelected && !isTodayDay && "opacity-65",
                isSelected
                  ? "z-10 bg-gradient-to-br from-sky-500/20 via-sky-500/5 to-transparent shadow-[inset_0_0_0_1px_rgba(244,197,66,0.4),0_8px_28px_-8px_rgba(0,114,188,0.4)]"
                  : "hover:bg-white/[0.025]",
              )}
            >
              {/* Glow para o dia de hoje */}
              {isTodayDay ? (
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-300/[0.05] via-transparent to-transparent" />
              ) : null}

              {/* Day header */}
              <div className="relative flex items-center justify-between">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full font-heading text-[13px] font-bold tabular-nums transition-all",
                    isTodayDay && "bg-amber-300 text-slate-950 shadow-[0_4px_14px_rgba(244,197,66,0.55)] ring-2 ring-amber-300/30",
                    !isTodayDay && isSelected && "bg-sky-500/30 text-white shadow-[0_2px_10px_rgba(14,165,233,0.35)]",
                    !isTodayDay && !isSelected && isCurrentMonth && "text-white/75 group-hover/cell:bg-white/[0.06] group-hover/cell:text-white",
                    !isCurrentMonth && "text-white/35",
                  )}
                >
                  {format(day, "d")}
                </span>
                {dayEvents.length > 0 ? (
                  <span className="font-heading text-[10px] font-bold tabular-nums text-white/40">
                    {dayEvents.length}
                  </span>
                ) : null}
              </div>

              {/* Event chips (até 3) */}
              <div className="relative mt-2 flex-1 space-y-1">
                {dayEvents.slice(0, 3).map(event => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={ev => {
                      ev.stopPropagation();
                      onOpenEvent(event.id);
                    }}
                    title={event.title}
                    className={cn(
                      "relative w-full overflow-hidden rounded-md py-1 pl-2 pr-1.5 text-left text-[11px] font-medium leading-none text-white transition-all hover:translate-x-0.5",
                      event.isUrgent && "ring-1 ring-inset ring-red-400/30",
                    )}
                    style={{
                      background: `linear-gradient(90deg, ${event.categoryColor}33, ${event.categoryColor}10)`,
                      boxShadow: `inset 2px 0 0 ${event.categoryColor}`,
                    }}
                  >
                    <span className="flex items-center gap-1.5">
                      {!event.allDay ? (
                        <span className="font-heading text-[9px] font-bold tabular-nums text-white/65">
                          {format(new Date(event.startsAt), "HH:mm")}
                        </span>
                      ) : null}
                      <span className="truncate">{event.title}</span>
                      {event.isUrgent ? (
                        <ShieldAlert className="ml-auto h-2.5 w-2.5 shrink-0 text-red-300" />
                      ) : null}
                    </span>
                  </button>
                ))}
                {dayEvents.length > 3 ? (
                  <div className="flex items-center gap-1 px-1 text-[10px] font-medium text-white/45">
                    <span>+{dayEvents.length - 3} mais</span>
                    <div className="ml-auto flex gap-0.5">
                      {rail.slice(0, 4).map(([color], i) => (
                        <span key={i} className="h-1 w-1 rounded-full" style={{ background: color }} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Density rail no fundo */}
              {dayEvents.length > 0 ? (
                <div className="absolute inset-x-0 bottom-0 flex h-[3px] gap-px overflow-hidden">
                  {rail.map(([color, count], i) => (
                    <span key={i} className="h-full" style={{ background: color, flex: count, opacity: isCurrentMonth ? 0.85 : 0.4 }} />
                  ))}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function IconCircleMicroButton({
  icon: Icon,
  onClick,
  aria,
}: {
  icon: typeof ChevronLeft;
  onClick: () => void;
  aria: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={aria}
      className="flex h-7 w-7 items-center justify-center rounded-full text-white/55 transition-all hover:bg-white/[0.08] hover:text-white"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function DaySpotlight({
  events,
  selectedDate,
  serverTime,
  onOpenEvent,
  canManage,
  onEdit,
  onDelete,
}: {
  events: DashboardEvent[];
  selectedDate: Date;
  serverTime: number;
  onOpenEvent: (eventId: number) => void;
  canManage: boolean;
  onEdit: (event: DashboardEvent) => void;
  onDelete: (event: DashboardEvent) => void;
}) {
  const today = startOfDay(new Date());
  const target = startOfDay(selectedDate);
  const diff = differenceInCalendarDays(target, today);
  const relative =
    diff === 0 ? "Hoje" : diff === 1 ? "Amanhã" : diff === -1 ? "Ontem" : diff > 0 ? `Em ${diff} dias` : `Há ${Math.abs(diff)} dias`;
  const isPastDay = diff < 0;
  const isTodaySel = diff === 0;
  const dow = selectedDate.getDay();
  const isWeekend = dow === 0 || dow === 6;

  const allDayEvents = useMemo(
    () => events.filter(e => e.allDay).sort((a, b) => b.priorityValue - a.priorityValue),
    [events],
  );
  const timedEvents = useMemo(
    () => events.filter(e => !e.allDay).sort((a, b) => a.startsAt - b.startsAt),
    [events],
  );

  const urgentCount = events.filter(e => e.isUrgent).length;
  const hoursOccupied = useMemo(() => {
    return timedEvents.reduce((acc, ev) => {
      if (ev.endsAt && ev.endsAt > ev.startsAt) {
        return acc + (ev.endsAt - ev.startsAt) / (1000 * 60 * 60);
      }
      return acc + 1;
    }, 0);
  }, [timedEvents]);

  // Para o eixo temporal: mínima 06h, máxima 22h, ajustável por eventos
  const hourRange = useMemo(() => {
    if (!timedEvents.length) return { start: 8, end: 20 };
    const earliest = Math.floor(timedEvents[0].startsAt && new Date(timedEvents[0].startsAt).getHours());
    const latest = Math.ceil(
      Math.max(
        ...timedEvents.map(e => {
          const end = e.endsAt ?? e.startsAt + 60 * 60 * 1000;
          return new Date(end).getHours() + (new Date(end).getMinutes() > 0 ? 1 : 0);
        }),
      ),
    );
    return { start: Math.max(0, Math.min(earliest, 8)), end: Math.min(24, Math.max(latest, 20)) };
  }, [timedEvents]);

  const nowMinutes = isTodaySel ? new Date().getHours() * 60 + new Date().getMinutes() : null;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.015] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent" />
      <div className="pointer-events-none absolute -right-24 -top-20 h-60 w-60 rounded-full bg-sky-500/10 blur-3xl" />

      {/* Header gigante do dia */}
      <header className="relative border-b border-white/8 bg-[linear-gradient(180deg,rgba(0,114,188,0.08),transparent)] p-6 md:p-7">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Tile-data 3D-ish */}
            <div
              className={cn(
                "relative flex h-24 w-24 flex-col items-center justify-center rounded-2xl border bg-gradient-to-b shadow-[0_10px_28px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)]",
                isTodaySel
                  ? "border-amber-300/40 from-amber-300/15 to-amber-300/5"
                  : "border-white/10 from-white/[0.06] to-white/[0.02]",
              )}
            >
              <span className="text-[9px] font-bold uppercase tracking-[0.32em] text-white/40">
                {format(selectedDate, "EEE", { locale: ptBR })}
              </span>
              <span className="font-heading text-4xl font-bold tabular-nums leading-none text-white">
                {format(selectedDate, "d")}
              </span>
              <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">
                {format(selectedDate, "MMM yyyy", { locale: ptBR })}
              </span>
              {isTodaySel ? (
                <span className="absolute -top-1.5 right-2 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-70" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-300 ring-2 ring-slate-950" />
                </span>
              ) : null}
            </div>

            <div className="min-w-0">
              <p
                className={cn(
                  "text-[11px] font-bold uppercase tracking-[0.28em]",
                  isTodaySel ? "text-amber-300" : isPastDay ? "text-white/35" : "text-sky-300",
                )}
              >
                {relative}
                {isWeekend ? " · Fim de semana" : ""}
              </p>
              <h3 className="mt-1.5 text-2xl font-semibold capitalize tracking-tight text-white md:text-3xl">
                {format(selectedDate, "EEEE", { locale: ptBR })}
              </h3>
              <p className="mt-1 text-sm text-white/50">
                {format(selectedDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>

          {/* Stats verticais à direita */}
          <div className="flex flex-wrap gap-2">
            <SpotlightStat icon={CalendarDays} label="Eventos" value={events.length} color="#3ABEFF" />
            <SpotlightStat icon={ShieldAlert} label="Urgentes" value={urgentCount} color="#F87171" pulse={urgentCount > 0} />
            <SpotlightStat icon={Clock3} label="Horas" value={Math.round(hoursOccupied)} color="#F4C542" suffix="h" />
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      {events.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-white/35">
            <CalendarCheck2 className="h-6 w-6" />
          </div>
          <p className="mt-4 text-base font-medium text-white/65">Nenhum compromisso neste dia.</p>
          <p className="mt-1 text-sm text-white/40">
            {isPastDay
              ? "Dia já registado sem eventos publicados."
              : isTodaySel
              ? "Aproveite para planear, descansar ou rever conteúdo."
              : "Janela livre — perfeita para preparar próximos compromissos."}
          </p>
        </div>
      ) : (
        <div className="grid gap-0 lg:grid-cols-[88px_1fr]">
          {/* Eixo temporal (apenas md+) */}
          <aside className="hidden border-r border-white/8 bg-white/[0.012] py-6 lg:block">
            <ul className="space-y-6 text-right pr-3">
              {Array.from({ length: hourRange.end - hourRange.start + 1 }).map((_, i) => {
                const h = hourRange.start + i;
                const label = `${String(h).padStart(2, "0")}:00`;
                const isCurrent = isTodaySel && new Date().getHours() === h;
                return (
                  <li
                    key={h}
                    className={cn(
                      "font-heading text-[10px] font-bold uppercase tracking-[0.16em] tabular-nums",
                      isCurrent ? "text-amber-300" : "text-white/25",
                    )}
                  >
                    {label}
                  </li>
                );
              })}
            </ul>
          </aside>

          <div className="relative space-y-5 p-6">
            {/* Indicador de "agora" */}
            {nowMinutes !== null ? (
              <div className="absolute left-0 right-6 top-6 hidden items-center gap-2 lg:flex" style={{
                transform: `translateY(${
                  ((nowMinutes / 60 - hourRange.start) / (hourRange.end - hourRange.start)) * 100
                }%)`,
              }}>
                <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(244,197,66,0.8)]" />
                <span className="h-px flex-1 bg-gradient-to-r from-amber-300/60 to-transparent" />
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300/70">agora</span>
              </div>
            ) : null}

            {allDayEvents.length > 0 ? (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Sunrise className="h-3.5 w-3.5 text-amber-300" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/45">Dia inteiro</p>
                  <span className="text-[10px] font-bold tabular-nums text-white/30">{allDayEvents.length}</span>
                </div>
                <ul className="space-y-2.5">
                  {allDayEvents.map(event => (
                    <DayEventRow
                      key={event.id}
                      event={event}
                      mode="all-day"
                      serverTime={serverTime}
                      onOpen={() => onOpenEvent(event.id)}
                      canManage={canManage}
                      onEdit={() => onEdit(event)}
                      onDelete={() => onDelete(event)}
                    />
                  ))}
                </ul>
              </div>
            ) : null}

            {timedEvents.length > 0 ? (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Clock3 className="h-3.5 w-3.5 text-sky-300" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/45">Agenda do dia</p>
                  <span className="text-[10px] font-bold tabular-nums text-white/30">{timedEvents.length}</span>
                </div>
                <ul className="space-y-2.5">
                  {timedEvents.map(event => (
                    <DayEventRow
                      key={event.id}
                      event={event}
                      mode="timed"
                      serverTime={serverTime}
                      onOpen={() => onOpenEvent(event.id)}
                      canManage={canManage}
                      onEdit={() => onEdit(event)}
                      onDelete={() => onDelete(event)}
                    />
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

function SpotlightStat({
  icon: Icon,
  label,
  value,
  color,
  suffix,
  pulse = false,
}: {
  icon: typeof Sparkles;
  label: string;
  value: number;
  color: string;
  suffix?: string;
  pulse?: boolean;
}) {
  return (
    <div className="group/stat relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 backdrop-blur-md transition-all hover:border-white/20 hover:bg-white/[0.06]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "relative flex h-7 w-7 items-center justify-center rounded-lg border border-white/10",
            pulse && "ring-2 ring-offset-0",
          )}
          style={{ background: `${color}22`, color }}
        >
          <Icon className="h-3.5 w-3.5" />
          {pulse ? (
            <span className="absolute inset-0 animate-ping rounded-lg opacity-40" style={{ background: color }} />
          ) : null}
        </span>
        <div className="flex flex-col leading-tight">
          <span className="text-[9px] font-bold uppercase tracking-[0.24em] text-white/45">{label}</span>
          <span className="font-heading text-base font-bold tabular-nums text-white">
            {value}
            {suffix ? <span className="ml-0.5 text-xs font-medium text-white/55">{suffix}</span> : null}
          </span>
        </div>
      </div>
    </div>
  );
}

function DayEventRow({
  event,
  mode,
  serverTime,
  onOpen,
  canManage,
  onEdit,
  onDelete,
}: {
  event: DashboardEvent;
  mode: "all-day" | "timed";
  serverTime: number;
  onOpen: () => void;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const startDate = new Date(event.startsAt);
  const endDate = event.endsAt ? new Date(event.endsAt) : null;
  const startLabel = mode === "timed" ? format(startDate, "HH:mm") : "DIA";
  const endLabel = mode === "timed" && endDate ? format(endDate, "HH:mm") : null;
  const upcoming = event.startsAt > serverTime;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group/event relative flex w-full gap-4 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-white/18 hover:bg-white/[0.05] hover:shadow-[0_12px_28px_-12px_rgba(0,0,0,0.6)]"
      >
        {/* Time tile */}
        <div
          className={cn(
            "flex w-16 shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 px-2 py-2.5 text-center",
            mode === "all-day" && "bg-amber-300/[0.08]",
          )}
        >
          {mode === "timed" ? (
            <>
              <span className="font-heading text-base font-bold tabular-nums leading-none text-white">{startLabel}</span>
              {endLabel ? (
                <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-white/40">
                  → {endLabel}
                </span>
              ) : (
                <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-white/40">início</span>
              )}
            </>
          ) : (
            <>
              <Sunrise className="h-4 w-4 text-amber-300" />
              <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-amber-200">inteiro</span>
            </>
          )}
        </div>

        {/* Color bar */}
        <span
          className="w-1 shrink-0 self-stretch rounded-full"
          style={{
            background: `linear-gradient(180deg, ${event.categoryColor}, ${event.categoryColor}55)`,
            boxShadow: `0 0 10px ${event.categoryColor}55`,
          }}
        />

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ background: `${event.categoryColor}22`, color: event.categoryColor }}
            >
              {event.categoryLabel}
            </span>
            <span
              className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-white/60"
              style={{ borderColor: event.priorityRing }}
            >
              {event.priorityLabel}
            </span>
            {event.isUrgent ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/14 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300">
                <ShieldAlert className="h-2.5 w-2.5" />
                Urgente
              </span>
            ) : null}
            {upcoming ? (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-300/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider tabular-nums text-amber-300">
                <Clock3 className="h-2.5 w-2.5" />
                {countdownLabel(event.startsAt, serverTime)}
              </span>
            ) : null}
          </div>
          <h4 className="mt-2 truncate text-[15px] font-semibold text-white transition-colors group-hover/event:text-amber-200">
            {event.title}
          </h4>
          {event.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/55">{event.description}</p>
          ) : null}
        </div>

        {canManage ? (
          <div className="flex shrink-0 flex-col gap-1.5 opacity-0 transition-opacity group-hover/event:opacity-100">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onEdit();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/55 hover:bg-amber-300/15 hover:text-amber-300"
              aria-label="Editar"
            >
              <PencilLine className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onDelete();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/55 hover:bg-red-500/15 hover:text-red-300"
              aria-label="Remover"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ) : null}
      </button>
    </li>
  );
}

function ProfessorComposer({
  editingEventId,
  formState,
  isBusy,
  onChange,
  onCancel,
  onSubmit,
}: {
  editingEventId: number | null;
  formState: EventFormState;
  isBusy: boolean;
  onChange: (value: EventFormState) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const categoryColor = getCategoryColor(formState.category);
  const priorityMeta: Record<EventPriority, { color: string; label: string; hint: string; icon: typeof Sparkles }> = {
    low: { color: "#22C55E", label: "Baixa", hint: "Pode esperar", icon: Clock3 },
    medium: { color: "#F97316", label: "Média", hint: "Atenção regular", icon: Activity },
    high: { color: "#EF4444", label: "Alta", hint: "Acompanhar de perto", icon: Flame },
    critical: { color: "#9333EA", label: "Crítica", hint: "Resposta imediata", icon: ShieldAlert },
  };
  const priorityColor = priorityMeta[formState.priority]?.color ?? "#F97316";

  const titleLength = formState.title.length;
  const descriptionLength = formState.description.length;
  const TITLE_MAX = 100;
  const DESC_MAX = 500;

  const isReady =
    formState.title.trim().length > 0 &&
    formState.description.trim().length > 0 &&
    !!formState.startsAt;

  // Mini preview da publicação
  const previewActive = formState.title.trim() || formState.description.trim();
  const previewDate = formState.startsAt
    ? formState.allDay
      ? new Date(formState.startsAt + "T12:00:00")
      : new Date(formState.startsAt)
    : null;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.015] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px transition-all"
        style={{ background: `linear-gradient(90deg, transparent, ${categoryColor}, transparent)`, opacity: 0.6 }}
      />
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-25 blur-3xl transition-all"
        style={{ background: categoryColor }}
      />

      {/* HEADER */}
      <header className="relative border-b border-white/8 bg-white/[0.02] px-5 py-4">
        <div className="flex items-center gap-3">
          <div
            className="relative flex h-11 w-11 items-center justify-center rounded-xl border shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),0_8px_22px_-10px_rgba(244,197,66,0.5)]"
            style={{
              borderColor: editingEventId ? "rgba(251,146,60,0.3)" : "rgba(244,197,66,0.3)",
              background: editingEventId
                ? "linear-gradient(180deg,rgba(251,146,60,0.16),rgba(251,146,60,0.05))"
                : "linear-gradient(180deg,rgba(244,197,66,0.16),rgba(244,197,66,0.05))",
              color: editingEventId ? "#FB923C" : "#F4C542",
            }}
          >
            {editingEventId ? <PencilLine className="h-5 w-5" /> : <Wand2 className="h-5 w-5" />}
            {!editingEventId ? (
              <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-300 ring-2 ring-slate-950" />
              </span>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-[10px] font-bold uppercase tracking-[0.28em]",
                editingEventId ? "text-orange-300/85" : "text-amber-300/85",
              )}
            >
              {editingEventId ? `Editando · #${editingEventId}` : "Publicar"}
            </p>
            <h3 className="mt-0.5 text-base font-semibold tracking-tight text-white">
              {editingEventId ? "Atualizar evento" : "Novo evento académico"}
            </h3>
          </div>
          {editingEventId ? (
            <button
              type="button"
              onClick={onCancel}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/45 transition-all hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
              aria-label="Cancelar edição"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {/* Live preview chip */}
        {previewActive ? (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.025] p-2.5">
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.24em] text-white/40">
              <Eye className="h-3 w-3" />
              Pré-visualização
            </div>
            <div className="mt-2 flex items-center gap-2.5">
              <span
                className="h-9 w-1 rounded-full"
                style={{ background: `linear-gradient(180deg,${categoryColor},${categoryColor}55)`, boxShadow: `0 0 10px ${categoryColor}77` }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                    style={{ background: `${categoryColor}22`, color: categoryColor }}
                  >
                    {categoryOptions.find(c => c.value === formState.category)?.label ?? "Categoria"}
                  </span>
                  <span
                    className="rounded-full border px-1.5 py-0.5 text-[9px] font-medium text-white/65"
                    style={{ borderColor: priorityColor + "55" }}
                  >
                    {priorityMeta[formState.priority]?.label ?? "Prioridade"}
                  </span>
                </div>
                <p className="mt-1 truncate text-[12px] font-semibold text-white">
                  {formState.title.trim() || "Título do evento"}
                </p>
                {previewDate ? (
                  <p className="mt-0.5 text-[10px] tabular-nums text-white/45">
                    {format(previewDate, "EEE d MMM", { locale: ptBR })}
                    {!formState.allDay ? <> · {format(previewDate, "HH:mm")}</> : <> · dia inteiro</>}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <div className="space-y-5 p-5">
        {/* TÍTULO */}
        <div>
          <ComposerLabel icon={Type} label="Título" hint={`${titleLength}/${TITLE_MAX}`} hintTone={titleLength > TITLE_MAX ? "danger" : "neutral"} />
          <input
            value={formState.title}
            onChange={e => onChange({ ...formState, title: e.target.value.slice(0, TITLE_MAX) })}
            placeholder="Ex.: Prova de Direito Constitucional"
            className={cn(
              "mt-2 h-11 w-full rounded-xl border bg-white/[0.04] px-4 text-sm text-white placeholder:text-white/30 outline-none transition-all focus:bg-white/[0.06] focus:ring-2",
              formState.title.trim()
                ? "border-white/15 focus:border-amber-300/45 focus:ring-amber-300/15"
                : "border-white/10 focus:border-sky-400/40 focus:ring-sky-400/15",
            )}
          />
        </div>

        {/* CATEGORIA · grade visual 2×2 */}
        <div>
          <ComposerLabel icon={Sparkles} label="Categoria" />
          <div className="mt-2 grid grid-cols-2 gap-2">
            {categoryOptions.map(option => {
              const color = getCategoryColor(option.value);
              const active = formState.category === option.value;
              const Icon = option.icon;
              const shortLabel = option.value === "assignment" ? "Entregas" : option.label;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange({ ...formState, category: option.value })}
                  className={cn(
                    "group/cat relative flex items-center gap-2.5 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all hover:-translate-y-0.5",
                    active ? "border-white/25 bg-white/[0.06]" : "border-white/10 bg-white/[0.025] hover:bg-white/[0.04]",
                  )}
                  style={
                    active
                      ? { boxShadow: `inset 0 0 0 1px ${color}45, 0 8px 22px -10px ${color}80` }
                      : undefined
                  }
                  title={option.label}
                >
                  {active ? (
                    <div
                      className="pointer-events-none absolute inset-x-0 top-0 h-px"
                      style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
                    />
                  ) : null}
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 transition-all"
                    style={{ background: `${color}1F`, color }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 text-[12px] font-semibold leading-tight tracking-tight",
                      active ? "text-white" : "text-white/65",
                    )}
                  >
                    {shortLabel}
                  </span>
                  {active ? (
                    <Check
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color }}
                      strokeWidth={3}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* PRIORIDADE · chips ricos 2×2 */}
        <div>
          <ComposerLabel icon={Target} label="Prioridade" />
          <div className="mt-2 grid grid-cols-2 gap-2">
            {priorityOptions
              .filter(o => o.value !== "all")
              .map(option => {
                const meta = priorityMeta[option.value as EventPriority];
                const active = formState.priority === option.value;
                const Icon = meta.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onChange({ ...formState, priority: option.value as EventPriority })}
                    className={cn(
                      "group/pri relative flex items-center gap-2.5 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all hover:-translate-y-0.5",
                      active ? "border-white/20 bg-white/[0.06]" : "border-white/10 bg-white/[0.025] hover:bg-white/[0.04]",
                    )}
                    style={
                      active
                        ? { boxShadow: `inset 0 0 0 1px ${meta.color}40, 0 6px 16px -8px ${meta.color}80` }
                        : undefined
                    }
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10"
                      style={{ background: `${meta.color}1F`, color: meta.color }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-[12px] font-bold leading-tight tracking-tight",
                          active ? "text-white" : "text-white/65",
                        )}
                      >
                        {meta.label}
                      </p>
                      <p className="text-[10px] leading-tight text-white/40">{meta.hint}</p>
                    </div>
                    {active ? (
                      <Check
                        className="h-3.5 w-3.5 shrink-0"
                        style={{ color: meta.color }}
                        strokeWidth={3}
                      />
                    ) : null}
                  </button>
                );
              })}
          </div>
        </div>

        {/* TEMPO */}
        <div className="space-y-2.5">
          <ComposerLabel icon={CalendarClock} label="Tempo" />

          {/* All-day toggle premium */}
          <button
            type="button"
            onClick={() => onChange({ ...formState, allDay: !formState.allDay, startsAt: "", endsAt: "" })}
            className={cn(
              "flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 transition-all",
              formState.allDay
                ? "border-amber-300/35 bg-amber-300/10"
                : "border-white/10 bg-white/[0.025] hover:bg-white/[0.04]",
            )}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg border transition-all",
                  formState.allDay
                    ? "border-amber-300/40 bg-amber-300/15 text-amber-300"
                    : "border-white/10 bg-white/[0.04] text-white/45",
                )}
              >
                <Sunrise className="h-3.5 w-3.5" />
              </span>
              <div className="text-left">
                <p
                  className={cn(
                    "text-[12px] font-semibold leading-tight",
                    formState.allDay ? "text-amber-200" : "text-white/80",
                  )}
                >
                  Evento de dia inteiro
                </p>
                <p className="text-[10px] text-white/40">
                  {formState.allDay ? "Sem janela específica" : "Definir hora exata"}
                </p>
              </div>
            </div>
            <div
              className={cn(
                "relative h-5 w-9 rounded-full transition-all",
                formState.allDay ? "bg-amber-300 shadow-[0_4px_12px_-4px_rgba(244,197,66,0.6)]" : "bg-white/14",
              )}
            >
              <div
                className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200",
                  formState.allDay ? "left-[18px]" : "left-0.5",
                )}
              />
            </div>
          </button>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Início</span>
              <div className="mt-1">
                <ComposerDatePicker
                  value={formState.startsAt}
                  allDay={formState.allDay}
                  onChange={v => onChange({ ...formState, startsAt: v })}
                  placeholder="Selecione a data"
                />
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Encerramento</span>
              <div className="mt-1">
                <ComposerDatePicker
                  value={formState.endsAt}
                  allDay={formState.allDay}
                  minDate={formState.startsAt}
                  onChange={v => onChange({ ...formState, endsAt: v })}
                  placeholder="Opcional"
                />
              </div>
            </div>
          </div>
        </div>

        {/* DESCRIÇÃO */}
        <div>
          <ComposerLabel
            icon={PencilLine}
            label="Descrição"
            hint={`${descriptionLength}/${DESC_MAX}`}
            hintTone={descriptionLength > DESC_MAX ? "danger" : "neutral"}
          />
          <textarea
            value={formState.description}
            onChange={e => onChange({ ...formState, description: e.target.value.slice(0, DESC_MAX) })}
            placeholder="Conteúdo, materiais necessários, orientações e contexto do evento."
            rows={4}
            className={cn(
              "mt-2 w-full resize-none rounded-xl border bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-white placeholder:text-white/26 outline-none transition-all focus:bg-white/[0.06] focus:ring-2",
              formState.description.trim()
                ? "border-white/15 focus:border-amber-300/40 focus:ring-amber-300/15"
                : "border-white/10 focus:border-sky-400/40 focus:ring-sky-400/15",
            )}
            style={{ colorScheme: "dark" }}
          />
        </div>

        {/* CHECKLIST DE PRONTIDÃO */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">Checklist</p>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                isReady ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.06] text-white/45",
              )}
            >
              {isReady ? <Check className="h-2.5 w-2.5" /> : <Clock3 className="h-2.5 w-2.5" />}
              {isReady ? "Pronto" : "Em progresso"}
            </span>
          </div>
          <ul className="mt-2 space-y-1.5 text-[11px] text-white/55">
            <ChecklistItem ok={!!formState.title.trim()} label="Título preenchido" />
            <ChecklistItem ok={!!formState.description.trim()} label="Descrição informada" />
            <ChecklistItem ok={!!formState.startsAt} label="Data de início definida" />
          </ul>
        </div>
      </div>

      {/* FOOTER */}
      <footer
        className="relative border-t border-white/10 px-5 py-4"
        style={{ background: `linear-gradient(180deg, transparent, ${categoryColor}08)` }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-1.5 text-[10px] text-white/40">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(74,222,128,0.7)]" />
            <span className="font-bold uppercase tracking-[0.18em]">
              {editingEventId ? "Edição em curso" : "Publicação programada para todos"}
            </span>
          </div>

          {editingEventId ? null : (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="h-9 rounded-full border-white/12 bg-white/[0.04] text-xs font-medium text-white/65 hover:bg-white/[0.08] hover:text-white"
            >
              Limpar
            </Button>
          )}
          <Button
            onClick={onSubmit}
            disabled={isBusy || !isReady}
            className={cn(
              "h-9 rounded-full px-5 text-xs font-bold transition-all",
              isReady
                ? "bg-amber-300 text-slate-950 shadow-[0_8px_20px_-8px_rgba(244,197,66,0.6)] hover:bg-amber-200"
                : "border border-white/10 bg-white/[0.04] text-white/35",
            )}
          >
            {isBusy ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-950/20 border-t-slate-950" />
                A publicar…
              </span>
            ) : editingEventId ? (
              <>
                <Check className="mr-1.5 h-3.5 w-3.5" />
                Guardar alterações
              </>
            ) : (
              <>
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Publicar evento
              </>
            )}
          </Button>
        </div>
      </footer>
    </section>
  );
}

function ComposerLabel({
  icon: Icon,
  label,
  hint,
  hintTone = "neutral",
}: {
  icon: typeof Sparkles;
  label: string;
  hint?: string;
  hintTone?: "neutral" | "danger";
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-white/35" />
        <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">{label}</span>
      </div>
      {hint ? (
        <span
          className={cn(
            "font-heading text-[10px] font-bold tabular-nums",
            hintTone === "danger" ? "text-red-300" : "text-white/35",
          )}
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
}

function ChecklistItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={cn(
          "flex h-3.5 w-3.5 items-center justify-center rounded-full border transition-all",
          ok ? "border-emerald-400/40 bg-emerald-500/15" : "border-white/15 bg-white/[0.03]",
        )}
      >
        {ok ? <Check className="h-2 w-2 text-emerald-300" strokeWidth={3} /> : null}
      </span>
      <span className={cn(ok ? "text-white/75" : "text-white/45")}>{label}</span>
    </li>
  );
}

function ComposerField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-[0.18em] text-white/36">{label}</span>
      {children}
    </div>
  );
}

function ComposerDatePicker({
  value,
  allDay,
  onChange,
  placeholder,
  minDate,
}: {
  value: string;
  allDay: boolean;
  onChange: (v: string) => void;
  placeholder: string;
  minDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(new Date()));
  const [timeValue, setTimeValue] = useState("12:00");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [openAbove, setOpenAbove] = useState(false);

  const DROPDOWN_W = 288;

  function recalcPos() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownH = allDay ? 340 : 400;
    const below = window.innerHeight - rect.bottom - 10;
    const above = below >= dropdownH;
    setOpenAbove(!above);

    let left = rect.left + window.scrollX;
    if (left + DROPDOWN_W > window.innerWidth - 8) {
      left = rect.right + window.scrollX - DROPDOWN_W;
    }
    if (left < 8) left = 8;

    setPos({
      top: above ? rect.bottom + 6 + window.scrollY : rect.top - dropdownH - 6 + window.scrollY,
      left,
    });
  }

  useEffect(() => {
    if (!open) return;
    recalcPos();
    const onScroll = () => recalcPos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, allDay]);

  useEffect(() => {
    if (value && !allDay) {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) {
        setTimeValue(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
      }
    }
  }, [value, allDay]);

  const today = startOfDay(new Date());
  const minDateParsed = minDate ? startOfDay(allDay ? new Date(minDate.split("T")[0] + "T12:00:00") : new Date(minDate)) : null;

  const days = useMemo(() => {
    const s = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 });
    const e = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: s, end: e });
  }, [viewMonth]);

  const selectedDate = useMemo(() => {
    if (!value) return null;
    const d = allDay ? new Date(value + "T12:00:00") : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [value, allDay]);

  const displayText = useMemo(() => {
    if (!selectedDate) return "";
    if (allDay) return format(selectedDate, "dd/MM/yyyy");
    return format(selectedDate, "dd/MM/yyyy 'às' HH:mm");
  }, [selectedDate, allDay]);

  function openPicker() {
    setOpen(true);
  }

  function pickDay(day: Date) {
    if (isBefore(day, today)) return;
    if (minDateParsed && isBefore(day, minDateParsed)) return;
    if (allDay) {
      onChange(format(day, "yyyy-MM-dd"));
      setOpen(false);
    } else {
      const [h, m] = timeValue.split(":").map(Number);
      const dt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
      const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000);
      onChange(local.toISOString().slice(0, 16));
    }
  }

  function changeTime(t: string) {
    setTimeValue(t);
    if (selectedDate) {
      const [h, m] = t.split(":").map(Number);
      const dt = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), h, m);
      const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000);
      onChange(local.toISOString().slice(0, 16));
    }
  }

  const disabled = (day: Date) => isBefore(day, today) || (minDateParsed ? isBefore(day, minDateParsed) : false);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => open ? setOpen(false) : openPicker()}
        className={cn(
          "flex h-11 w-full items-center gap-2 rounded-xl border border-white/10 bg-white/6 px-3 text-sm transition hover:bg-white/8",
          displayText ? "text-white" : "text-white/30",
        )}
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-white" strokeWidth={1.8} />
        <span className="flex-1 truncate text-left">{displayText || placeholder}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-white/40 transition-transform", open && "rotate-180")} />
      </button>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[998]" onClick={() => setOpen(false)} />
          <div
            className="absolute z-[999] w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#0a1120] shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
            style={{ top: pos.top, left: pos.left }}
          >
            {/* Month nav */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <button type="button" onClick={() => setViewMonth(subMonths(viewMonth, 1))} className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:bg-white/[0.06] hover:text-white/70">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-[13px] font-semibold capitalize text-white">
                {format(viewMonth, "MMMM yyyy", { locale: ptBR })}
              </span>
              <button type="button" onClick={() => setViewMonth(addMonths(viewMonth, 1))} className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:bg-white/[0.06] hover:text-white/70">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 px-3 pt-2">
              {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => (
                <div key={i} className="py-1.5 text-center text-[10px] font-medium text-white/24">{d}</div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-0.5 px-3 pb-3">
              {days.map(day => {
                const off = disabled(day);
                const sel = selectedDate && isSameDay(day, selectedDate);
                const td = isToday(day);
                const inM = isSameMonth(day, viewMonth);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    disabled={off}
                    onClick={() => pickDay(day)}
                    className={cn(
                      "flex h-9 w-full items-center justify-center rounded-lg text-[13px] font-medium transition-colors",
                      !inM && "opacity-25",
                      off && inM && "cursor-not-allowed text-white/15 line-through",
                      !off && !sel && "text-white/60 hover:bg-white/[0.08] hover:text-white",
                      sel && "bg-amber-300 font-bold text-slate-950",
                      td && !sel && !off && "text-amber-300 ring-1 ring-amber-300/40",
                    )}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>

            {/* Time picker */}
            {!allDay && (
              <div className="flex items-center gap-3 border-t border-white/[0.06] px-4 py-3">
                <Clock3 className="h-4 w-4 text-white/36" strokeWidth={1.8} />
                <span className="text-xs text-white/40">Horário</span>
                <input
                  type="time"
                  value={timeValue}
                  onChange={e => changeTime(e.target.value)}
                  className="ml-auto h-9 rounded-lg border border-white/10 bg-white/6 px-3 text-sm text-white outline-none"
                  style={{ colorScheme: "dark" }}
                />
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2.5">
              <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="text-xs text-white/36 hover:text-white/60">
                Limpar
              </button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-amber-300/14 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-300/22">
                Confirmar
              </button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}

function StudentFocusPanel({
  agenda,
  notifications,
  serverTime,
  onOpenEvent,
}: {
  agenda: DashboardEvent[];
  notifications: NotificationItem[];
  serverTime: number;
  onOpenEvent: (eventId: number) => void;
}) {
  return (
    <Card className="overflow-hidden border-white/10 bg-white/6 shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <CardHeader className="border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent)]">
        <CardTitle className="text-white">Foco do aluno</CardTitle>
        <p className="text-sm text-white/62">Visualização rápida dos próximos compromissos e alertas adicionados pela docência.</p>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        {agenda.slice(0, 3).length ? (
          agenda.slice(0, 3).map(event => (
            <button key={event.id} type="button" onClick={() => onOpenEvent(event.id)} className="w-full rounded-[1.4rem] border border-white/10 bg-white/5 p-4 text-left transition hover:border-white/20 hover:bg-white/8">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{event.title}</p>
                  <p className="mt-1 text-xs text-white/56">{formatEventDate(event.startsAt, event.allDay)}</p>
                </div>
                <PriorityBadge priority={event.priorityLabel} ring={event.priorityRing} glow={event.priorityGlow} />
              </div>
              <p className="mt-3 text-sm text-white/62">{countdownLabel(event.startsAt, serverTime)}</p>
            </button>
          ))
        ) : (
          <EmptyState label="Ainda não existem compromissos futuros para destacar no foco do aluno." compact />
        )}
        <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Notificações recentes</p>
            <Badge className="rounded-full bg-white/10 text-white/82">{notifications.length}</Badge>
          </div>
          <div className="mt-3 space-y-3">
            {notifications.slice(0, 3).length ? (
              notifications.slice(0, 3).map(notification => (
                <div key={notification.id} className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                  <p className="text-sm font-medium text-white">{notification.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/58">{notification.message}</p>
                </div>
              ))
            ) : (
              <EmptyState label="Não há notificações recentes para este aluno neste momento." compact />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UpcomingEventsPanel({
  agenda,
  onEdit,
  onDelete,
  onOpenEvent,
  canManage,
}: {
  agenda: DashboardEvent[];
  onEdit: (event: DashboardEvent) => void;
  onDelete: (event: DashboardEvent) => void;
  onOpenEvent: (eventId: number) => void;
  canManage: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <h3 className="text-[13px] font-semibold text-white">Próximos eventos</h3>
        <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-white/45">{agenda.length}</span>
      </div>
      {agenda.length ? (
        <div className="divide-y divide-white/[0.06]">
          {agenda.map(event => (
            <EventTimelineCard key={event.id} event={event} canManage={canManage} onOpenEvent={onOpenEvent} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <CalendarDays className="h-5 w-5 text-white/18" strokeWidth={1.5} />
          <p className="text-xs text-white/30">Sem eventos futuros.</p>
        </div>
      )}
    </div>
  );
}

function EventTimelineCard({
  event,
  canManage,
  onOpenEvent,
  onEdit,
  onDelete,
}: {
  event: DashboardEvent;
  canManage: boolean;
  onOpenEvent: (eventId: number) => void;
  onEdit: (event: DashboardEvent) => void;
  onDelete: (event: DashboardEvent) => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpenEvent(event.id)}
      className="group flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
      style={{ borderLeft: `3px solid ${event.categoryColor}` }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-white/36">{event.categoryLabel}</span>
          {event.isUrgent && <span className="rounded-full bg-red-500/14 px-1.5 py-px text-[10px] font-medium text-red-300">Urgente</span>}
        </div>
        <h4 className="mt-1 truncate text-[13px] font-semibold text-white">{event.title}</h4>
        <p className="mt-0.5 text-[11px] text-white/36">{formatEventDate(event.startsAt, event.allDay)}</p>
      </div>
      {canManage && (
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <IconCircleButton icon={PencilLine} onClick={() => onEdit(event)} />
          <IconCircleButton icon={Trash2} onClick={() => onDelete(event)} destructive />
        </div>
      )}
    </button>
  );
}

function EventDetailsDialog({
  event,
  canManage,
  serverTime,
  onClose,
  onEdit,
  onDelete,
}: {
  event: DashboardEvent;
  canManage: boolean;
  serverTime: number;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const startDate = new Date(event.startsAt);
  const endDate = event.endsAt ? new Date(event.endsAt) : null;
  const dow = startDate.getDay();
  const isWeekend = dow === 0 || dow === 6;
  const diffMs = event.startsAt - serverTime;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const isPast = event.startsAt < serverTime && (!endDate || endDate.getTime() < serverTime);
  const isHappening = startDate.getTime() <= serverTime && (!endDate || endDate.getTime() >= serverTime);
  const isUpcoming = !isPast && !isHappening;
  const durationMin = endDate ? Math.max(0, (endDate.getTime() - startDate.getTime()) / 60000) : null;

  // Tom da urgência reaproveitado da agenda
  const urgency = urgencyToneFor(event, serverTime);

  // Status badge
  let statusBadge: { label: string; className: string; icon: typeof Sparkles; pulse?: boolean };
  if (isHappening) {
    statusBadge = {
      label: "Acontecendo agora",
      className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30",
      icon: Activity,
      pulse: true,
    };
  } else if (isPast) {
    statusBadge = {
      label: "Já encerrado",
      className: "bg-white/[0.05] text-white/45 ring-1 ring-white/10",
      icon: CalendarCheck2,
    };
  } else if (event.isUrgent) {
    statusBadge = {
      label: "Atenção urgente",
      className: "bg-red-500/15 text-red-300 ring-1 ring-red-400/30",
      icon: ShieldAlert,
      pulse: true,
    };
  } else if (diffDays === 0) {
    statusBadge = {
      label: "Ainda hoje",
      className: "bg-amber-300/15 text-amber-300 ring-1 ring-amber-300/30",
      icon: Zap,
      pulse: true,
    };
  } else if (diffDays === 1) {
    statusBadge = {
      label: "Amanhã",
      className: "bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/30",
      icon: Sunrise,
    };
  } else {
    statusBadge = {
      label: "No horizonte",
      className: "bg-violet-400/12 text-violet-300 ring-1 ring-violet-400/30",
      icon: CalendarDays,
    };
  }

  // Tile do mês com cor da categoria
  const StatusIcon = statusBadge.icon;
  const CategoryIcon = categoryOptions.find(c => c.value === event.category)?.icon ?? CalendarDays;

  return (
    <div className="relative">
      {/* HERO BANNER ───────────────────────────────────────────── */}
      <header className="relative overflow-hidden">
        {/* Gradient banner com a cor da categoria */}
        <div
          className="relative px-7 pb-7 pt-7"
          style={{
            background: `linear-gradient(135deg, ${event.categoryColor}22 0%, rgba(7,13,24,0.5) 50%, ${event.categoryColor}10 100%)`,
          }}
        >
          {/* Glow corners */}
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-40 blur-3xl"
            style={{ background: event.categoryColor }}
          />
          <div className="pointer-events-none absolute -bottom-20 -left-12 h-40 w-40 rounded-full bg-amber-300/15 blur-3xl" />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-80"
            style={{ background: `linear-gradient(90deg, transparent, ${event.categoryColor}, transparent)` }}
          />

          {/* Botão fechar */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-slate-950/60 text-white/55 backdrop-blur transition-all hover:border-white/30 hover:bg-slate-950/80 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative flex items-start gap-5">
            {/* Tile-data 3D */}
            <div
              className="relative flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl border bg-gradient-to-b shadow-[0_10px_28px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)]"
              style={{
                borderColor: `${event.categoryColor}44`,
                background: `linear-gradient(180deg, ${event.categoryColor}22, ${event.categoryColor}08)`,
              }}
            >
              <span
                className="text-[9px] font-bold uppercase tracking-[0.32em]"
                style={{ color: event.categoryColor }}
              >
                {format(startDate, "EEE", { locale: ptBR })}
              </span>
              <span className="font-heading text-4xl font-bold tabular-nums leading-none text-white">
                {format(startDate, "d")}
              </span>
              <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.24em] text-white/55">
                {format(startDate, "MMM yyyy", { locale: ptBR })}
              </span>
              {!event.allDay ? (
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-slate-950/60 px-2 py-0.5 font-heading text-[10px] font-bold tabular-nums text-white">
                  <Clock3 className="h-2.5 w-2.5" />
                  {format(startDate, "HH:mm")}
                </span>
              ) : (
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-300/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                  Dia inteiro
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1 pr-10">
              {/* Status + chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                    statusBadge.className,
                  )}
                >
                  {statusBadge.pulse ? (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-70" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
                    </span>
                  ) : (
                    <StatusIcon className="h-2.5 w-2.5" />
                  )}
                  {statusBadge.label}
                </span>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: `${event.categoryColor}22`, color: event.categoryColor }}
                >
                  <CategoryIcon className="h-2.5 w-2.5" />
                  {event.categoryLabel}
                </span>
                <span
                  className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-white/65"
                  style={{ borderColor: event.priorityRing }}
                >
                  {event.priorityLabel}
                </span>
                {event.isUrgent ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500/14 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300">
                    <ShieldAlert className="h-2.5 w-2.5" />
                    Urgente
                  </span>
                ) : null}
                {isWeekend ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300/85">
                    <Sunrise className="h-2.5 w-2.5" />
                    Fim de semana
                  </span>
                ) : null}
              </div>

              <DialogHeader className="mt-3">
                <DialogTitle className="text-balance text-2xl font-semibold leading-tight tracking-tight text-white md:text-[1.7rem]">
                  {event.title}
                </DialogTitle>
                <DialogDescription className="sr-only">Detalhes do evento {event.title}</DialogDescription>
              </DialogHeader>

              {/* Date long-form + countdown */}
              <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-white/55">
                <span className="inline-flex items-center gap-1.5 capitalize">
                  <CalendarDays className="h-3 w-3 text-white/40" />
                  {format(startDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
                {!event.allDay ? (
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Clock3 className="h-3 w-3 text-white/40" />
                    {format(startDate, "HH:mm")}
                    {endDate ? <> → {format(endDate, "HH:mm")}</> : null}
                  </span>
                ) : null}
                {isUpcoming ? (
                  <span
                    className={cn(
                      "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider tabular-nums",
                      urgency.className,
                    )}
                  >
                    <Hourglass className="h-2.5 w-2.5" />
                    {countdownLabel(event.startsAt, serverTime)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* CORPO ─────────────────────────────────────────────────── */}
      <div className="space-y-5 px-7 pb-6 pt-6">
        {/* Descrição */}
        <section>
          <div className="mb-2 flex items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10"
              style={{ background: `${event.categoryColor}1A`, color: event.categoryColor }}
            >
              <PencilLine className="h-3 w-3" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/45">Descrição</p>
          </div>
          {event.description?.trim() ? (
            <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <p className="whitespace-pre-line text-sm leading-relaxed text-white/75">{event.description}</p>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-white/10 bg-white/[0.015] p-4 text-sm italic text-white/35">
              Sem descrição adicional para este evento.
            </p>
          )}
        </section>

        {/* Grade de detalhes */}
        <section className="grid gap-2.5 sm:grid-cols-3">
          <DetailCell
            icon={CalendarClock}
            label="Início"
            value={event.allDay ? format(startDate, "d MMM yyyy", { locale: ptBR }) : format(startDate, "d MMM, HH:mm", { locale: ptBR })}
            sub={event.allDay ? "Dia inteiro" : format(startDate, "EEEE", { locale: ptBR })}
            color={event.categoryColor}
          />
          <DetailCell
            icon={CalendarCheck2}
            label="Encerramento"
            value={
              endDate
                ? event.allDay
                  ? format(endDate, "d MMM yyyy", { locale: ptBR })
                  : format(endDate, "d MMM, HH:mm", { locale: ptBR })
                : "—"
            }
            sub={endDate ? format(endDate, "EEEE", { locale: ptBR }) : "Sem encerramento"}
            color={event.categoryColor}
            muted={!endDate}
          />
          <DetailCell
            icon={Hourglass}
            label="Duração"
            value={
              event.allDay
                ? "Dia inteiro"
                : durationMin && durationMin > 0
                ? durationMin >= 60
                  ? `${Math.floor(durationMin / 60)}h${durationMin % 60 > 0 ? ` ${Math.round(durationMin % 60)}min` : ""}`
                  : `${Math.round(durationMin)} min`
                : "—"
            }
            sub={durationMin && durationMin > 0 && !event.allDay ? "Bloco de tempo" : event.allDay ? "Sem janela específica" : "Pontual"}
            color="#F4C542"
            muted={!durationMin && !event.allDay}
          />
        </section>

        {/* Linha de meta-info */}
        <section className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-[11px] text-white/55">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: event.categoryColor, boxShadow: `0 0 8px ${event.categoryColor}` }} />
            <span className="font-medium">{event.categoryLabel}</span>
          </span>
          <span className="text-white/15">·</span>
          <span className="inline-flex items-center gap-1.5">
            <Target className="h-3 w-3 text-white/40" />
            Prioridade <span className="font-medium text-white/75">{event.priorityLabel}</span>
          </span>
          <span className="text-white/15">·</span>
          <span className="inline-flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-white/40" />
            ID <span className="font-heading font-medium tabular-nums text-white/75">#{event.id}</span>
          </span>
          <span className="text-white/15">·</span>
          <span className="inline-flex items-center gap-1.5">
            <Hourglass className="h-3 w-3 text-white/40" />
            <span className="font-medium text-white/75">
              {isPast ? "encerrado" : isHappening ? "em andamento" : `em ${countdownLabel(event.startsAt, serverTime)}`}
            </span>
          </span>
        </section>
      </div>

      {/* FOOTER / AÇÕES ────────────────────────────────────────── */}
      <footer
        className="relative border-t border-white/10 px-7 py-4"
        style={{
          background: `linear-gradient(180deg, rgba(7,13,24,0.4), ${event.categoryColor}0A)`,
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-white/40">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
              <span className="font-bold uppercase tracking-[0.2em] text-white/55">sincronizado</span>
            </span>
            {isUpcoming ? (
              <>
                <span className="text-white/15">·</span>
                <span className="font-heading font-bold tabular-nums text-amber-300/85">
                  {countdownLabel(event.startsAt, serverTime)}
                </span>
              </>
            ) : null}
          </div>

          {canManage ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="h-9 rounded-full border-white/12 bg-white/[0.04] text-xs font-medium text-white/65 hover:bg-white/[0.08] hover:text-white"
              >
                Fechar
              </Button>
              <Button
                type="button"
                onClick={onDelete}
                className="h-9 rounded-full border border-red-500/25 bg-red-500/10 text-xs font-bold text-red-300 hover:bg-red-500/20"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Remover
              </Button>
              <Button
                type="button"
                onClick={onEdit}
                className="h-9 rounded-full bg-amber-300 px-5 text-xs font-bold text-slate-950 shadow-[0_8px_20px_-8px_rgba(244,197,66,0.6)] hover:bg-amber-200"
              >
                <PencilLine className="mr-1.5 h-3.5 w-3.5" />
                Editar evento
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              onClick={onClose}
              className="h-9 rounded-full bg-white/[0.06] px-5 text-xs font-bold text-white hover:bg-white/[0.12]"
            >
              Entendi
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

function DetailCell({
  icon: Icon,
  label,
  value,
  sub,
  color,
  muted = false,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string;
  sub?: string;
  color: string;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "group/d relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-3.5 transition-all hover:border-white/20 hover:bg-white/[0.06]",
        muted && "opacity-65",
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-50"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />
      <div className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10"
          style={{ background: `${color}1F`, color }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">{label}</span>
      </div>
      <p className="mt-2.5 truncate font-heading text-[15px] font-bold capitalize text-white">{value}</p>
      {sub ? <p className="mt-0.5 truncate text-[11px] capitalize text-white/45">{sub}</p> : null}
    </div>
  );
}

function DashboardStatCard({
  title,
  value,
  description,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: typeof Sparkles;
  color: string;
}) {
  const numericValue = typeof value === "number" ? value : 0;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.015] p-5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] transition-all hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_16px_44px_-16px_rgba(0,0,0,0.7)]">
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-25 blur-2xl transition-opacity group-hover:opacity-40"
        style={{ background: color }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/45">{title}</p>
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 backdrop-blur-md"
            style={{ background: `${color}1F`, color }}
          >
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <p className="font-heading text-[2.5rem] font-bold leading-none tabular-nums tracking-tight text-white">
            {value}
          </p>
          {numericValue > 0 ? (
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: `${color}20`, color }}>
              ativos
            </span>
          ) : null}
        </div>
        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-white/55">{description}</p>
        {/* mini sparkline-like bar */}
        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/[0.05]">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, numericValue * 16 + (numericValue > 0 ? 12 : 0))}%`,
              background: `linear-gradient(90deg, ${color}99, ${color})`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function SectionHeading({
  kicker,
  title,
  action,
}: {
  kicker: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-[10px] uppercase tracking-[0.32em] text-white/35">{kicker}</p>
        <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-white md:text-xl">{title}</h3>
      </div>
      {action}
    </div>
  );
}

function GlassKpi({ title, value, subvalue, accent }: { title: string; value: string; subvalue: string; accent: string }) {
  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-white/8 p-5 backdrop-blur-xl" style={{ boxShadow: `0 18px 40px ${accent}18` }}>
      <p className="text-sm text-white/56">{title}</p>
      <h3 className="mt-3 text-lg font-semibold text-white">{value}</h3>
      <p className="mt-2 text-sm text-white/62">{subvalue}</p>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-white/10 bg-white/10 px-4 py-2 backdrop-blur-xl">
      <span className="text-white/54">{label}</span>
      <span className="ml-2 font-medium text-white">{value}</span>
    </div>
  );
}

function MiniDigestCard({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4" style={{ boxShadow: `inset 0 0 0 1px ${color}` }}>
      <p className="text-sm text-white/56">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function EventCategoryBadge({ event }: { event: DashboardEvent }) {
  return <Badge className="rounded-full border px-3 py-1 text-xs font-medium text-white" style={{ backgroundColor: event.categorySoftColor, borderColor: event.categoryBorderColor, color: event.categoryColor }}>{event.categoryLabel}</Badge>;
}

function PriorityBadge({ priority, ring, glow }: { priority: string; ring: string; glow: string }) {
  return <Badge className="rounded-full border px-3 py-1 text-xs font-medium text-white" style={{ borderColor: ring, boxShadow: glow, backgroundColor: "rgba(255,255,255,0.04)" }}>{priority}</Badge>;
}

function LegendPill({ label, color }: { label: string; color: string }) {
  return (
    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/74">
      <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </div>
  );
}

function IconCircleButton({ icon: Icon, onClick, destructive = false }: { icon: typeof ChevronLeft; onClick: () => void; destructive?: boolean }) {
  return (
    <Button type="button" size="icon" variant="outline" onClick={onClick} className={`h-10 w-10 rounded-full border ${destructive ? "border-red-500/30 bg-red-500/8 text-red-200 hover:bg-red-500/12 hover:text-red-100" : "border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"}`}>
      <Icon className="h-4 w-4" />
    </Button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-sm text-white/64">{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ label, compact = false }: { label: string; compact?: boolean }) {
  return <div className={`rounded-2xl border border-dashed border-white/14 bg-white/4 text-center text-sm text-white/54 ${compact ? "p-5" : "p-8"}`}>{label}</div>;
}

function FullscreenLoader({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
      <div className="space-y-3 text-center">
        <div className="mx-auto h-14 w-14 animate-spin rounded-full border-2 border-sky-300/30 border-t-amber-300" />
        <p className="text-sm text-white/62">{label}</p>
      </div>
    </div>
  );
}

function FullscreenInlineLoader({ label }: { label: string }) {
  return (
    <div className="space-y-3 text-center">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-sky-300/30 border-t-amber-300" />
      <p className="text-sm text-white/62">{label}</p>
    </div>
  );
}

function categoryLabel(category: EventCategory) {
  return categoryOptions.find(option => option.value === category)?.label ?? "Evento";
}

function getCategoryColor(category: EventCategory) {
  return {
    activity: "#2563EB",
    exam: "#DC2626",
    assignment: "#F97316",
    notice: "#16A34A",
  }[category];
}

function parseLocalDate(value: string, allDay: boolean): number {
  if (allDay) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0).getTime();
  }
  return new Date(value).getTime();
}

function formatEventDate(timestamp: number, allDay = false) {
  return new Date(timestamp).toLocaleString("pt-BR", {
    dateStyle: "full",
    timeStyle: allDay ? undefined : "short",
  });
}

function formatNotificationDate(value: Date | string) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function countdownLabel(target: number, now: number) {
  const diffDays = differenceInCalendarDays(new Date(target), new Date(now));

  if (diffDays < 0) return "Evento já iniciado";
  if (diffDays === 0) return "Acontece hoje";
  if (diffDays === 1) return "Falta 1 dia";
  return `Faltam ${diffDays} dias`;
}

function toInputDateTime(timestamp: number, allDay = false) {
  const date = new Date(timestamp);
  if (allDay) {
    const day = startOfDay(date);
    return format(day, "yyyy-MM-dd");
  }
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function hydrateComposer(
  event: DashboardEvent,
  setFormState: (value: EventFormState) => void,
  setEditingEventId: (value: number | null) => void,
  setLocation: (path: string) => void,
) {
  setEditingEventId(event.id);
  setFormState({
    title: event.title,
    description: event.description,
    category: event.category,
    priority: event.priority,
    startsAt: toInputDateTime(event.startsAt, event.allDay),
    endsAt: event.endsAt ? toInputDateTime(event.endsAt, event.allDay) : "",
    allDay: event.allDay,
  });
  setLocation("/calendario");
  toast.info("Evento carregado no editor do professor.");
}

