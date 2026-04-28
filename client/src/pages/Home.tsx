import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useLocation } from "wouter";

type HomeEventCategory = "activity" | "exam" | "assignment" | "notice";
type HomeEventPriority = "low" | "medium" | "high" | "critical";

type HomeDashboardEvent = {
  id: number;
  title: string;
  description: string;
  category: HomeEventCategory;
  priority: HomeEventPriority;
  startsAt: number;
  endsAt: number | null;
  allDay: boolean;
  categoryLabel: string;
  categoryColor: string;
  priorityLabel: string;
  isUrgent: boolean;
};

const CATEGORY_LEGEND: Array<{ label: string; color: string }> = [
  { label: "Atividades", color: "#2563EB" },
  { label: "Provas", color: "#DC2626" },
  { label: "Trabalhos", color: "#F97316" },
  { label: "Avisos", color: "#16A34A" },
];

export default function Home() {
  const { loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const dashboardQuery = trpc.calendar.dashboard.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const dashboardData = dashboardQuery.data;
  const agenda = (dashboardData?.agenda ?? []) as HomeDashboardEvent[];
  const summary = dashboardData?.summary;
  const widgets = dashboardData?.widgets;
  const serverTime = dashboardData?.serverTime ?? Date.now();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border border-white/15 border-t-amber-300" />
          <p className="text-xs uppercase tracking-[0.28em] text-white/40">A carregar Kairos</p>
        </div>
      </div>
    );
  }

  const primaryCta = isAuthenticated ? "Abrir painel" : "Entrar";
  const primaryAction = () => setLocation(isAuthenticated ? "/app" : "/login");

  return (
    <div className="min-h-screen text-white">
      <header className="sticky top-0 z-40 border-b border-white/6 bg-slate-950/70 backdrop-blur-xl">
        <div className="container flex min-h-20 items-center justify-between gap-4">
          <div>
            <p className="brand-text-gold text-[10px] uppercase tracking-[0.32em]">Calendário académico inteligente</p>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight">Kairos</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              className={isAuthenticated ? "brand-button-blue rounded-full" : "brand-button-gold rounded-full"}
              onClick={primaryAction}
            >
              {primaryCta}
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* HERO — refinado, uma coluna, sem ruído visual */}
        <section className="container pt-16 pb-10 md:pt-24 md:pb-14">
          <div className="max-w-3xl space-y-5">
            <p className="text-[11px] uppercase tracking-[0.32em] text-white/35">
              Calendário académico · Unimar
            </p>
            <h2 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight md:text-[3.4rem]">
              O semestre inteiro em uma única superfície clara.
            </h2>
            <p className="max-w-xl text-base leading-relaxed text-white/55">
              Provas, trabalhos, atividades e avisos com leitura imediata por categoria e prioridade — sem ruído operacional.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <Button className="brand-button-gold rounded-full px-5" onClick={primaryAction}>
                {isAuthenticated ? "Abrir painel" : "Iniciar sessão"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                className="rounded-full px-4 text-white/60 hover:bg-white/5 hover:text-white"
                onClick={() => setLocation(isAuthenticated ? "/agenda" : "/login")}
              >
                Ver agenda
              </Button>
            </div>
          </div>

          {/* Linha-legenda discreta com as 4 cores institucionais */}
          <div className="mt-14 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-white/8 pt-6 text-xs text-white/50">
            <span className="text-[10px] uppercase tracking-[0.28em] text-white/35">Leitura cromática</span>
            {CATEGORY_LEGEND.map(item => (
              <span key={item.label} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="tracking-wide">{item.label}</span>
              </span>
            ))}
          </div>
        </section>

        {/* DADOS — compacto, denso, elegante */}
        <section className="container pb-20 md:pb-28">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
            {/* Coluna esquerda: resumo numérico */}
            <div>
              <SectionHeading kicker="Resumo" title="Estado da sua rotina" />
              <SummaryStrip
                isAuthenticated={isAuthenticated}
                isLoading={dashboardQuery.isLoading}
                isError={dashboardQuery.isError}
                summary={summary}
                widgets={widgets}
                serverTime={serverTime}
              />
            </div>

            {/* Coluna direita: agenda imediata */}
            <div>
              <div className="flex items-end justify-between gap-4">
                <SectionHeading kicker="Agenda" title="Próximos eventos" />
                {isAuthenticated ? (
                  <button
                    onClick={() => setLocation("/agenda")}
                    className="group inline-flex items-center gap-1 text-xs uppercase tracking-[0.24em] text-white/45 transition-colors hover:text-amber-300"
                  >
                    Ver tudo
                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </button>
                ) : null}
              </div>

              <UpcomingList
                isAuthenticated={isAuthenticated}
                isLoading={dashboardQuery.isLoading}
                isError={dashboardQuery.isError}
                agenda={agenda}
                serverTime={serverTime}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

function SectionHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.32em] text-white/35">{kicker}</p>
      <h3 className="mt-2 text-xl font-semibold tracking-tight text-white md:text-2xl">{title}</h3>
    </div>
  );
}

function SummaryStrip({
  isAuthenticated,
  isLoading,
  isError,
  summary,
  widgets,
  serverTime,
}: {
  isAuthenticated: boolean;
  isLoading: boolean;
  isError: boolean;
  summary:
    | {
        pendingActivities: number;
        upcomingExams: number;
        assignmentDeadlines: number;
        notices: number;
        urgentCount: number;
      }
    | undefined;
  widgets:
    | {
        nextExam: HomeDashboardEvent | null;
        nextAssignment: HomeDashboardEvent | null;
      }
    | undefined;
  serverTime: number;
}) {
  if (!isAuthenticated) {
    return (
      <EmptyMessage>
        Inicie sessão para ver o resumo real de pendências e a contagem regressiva da próxima prova.
      </EmptyMessage>
    );
  }

  if (isLoading) {
    return <EmptyMessage>A carregar widgets…</EmptyMessage>;
  }

  if (isError || !summary || !widgets) {
    return <EmptyMessage tone="error">Não foi possível carregar os dados agora.</EmptyMessage>;
  }

  const items: Array<{ label: string; value: number; hint: string; color: string }> = [
    {
      label: "Atividades",
      value: summary.pendingActivities,
      hint: "Compromissos publicados.",
      color: "#2563EB",
    },
    {
      label: "Provas",
      value: summary.upcomingExams,
      hint: widgets.nextExam ? countdownLabel(widgets.nextExam.startsAt, serverTime) : "Sem prova agendada.",
      color: "#DC2626",
    },
    {
      label: "Trabalhos",
      value: summary.assignmentDeadlines,
      hint: widgets.nextAssignment
        ? countdownLabel(widgets.nextAssignment.startsAt, serverTime)
        : "Sem entregas próximas.",
      color: "#F97316",
    },
    {
      label: "Urgentes",
      value: summary.urgentCount,
      hint: summary.urgentCount ? "Atenção prioritária." : "Sem urgências.",
      color: "#F4C542",
    },
  ];

  return (
    <div className="mt-6 divide-y divide-white/8 border-y border-white/8">
      {items.map(item => (
        <div key={item.label} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-4">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">{item.label}</p>
            <p className="mt-0.5 truncate text-xs text-white/45">{item.hint}</p>
          </div>
          <span className="font-heading text-2xl font-semibold tabular-nums text-white">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function UpcomingList({
  isAuthenticated,
  isLoading,
  isError,
  agenda,
  serverTime,
}: {
  isAuthenticated: boolean;
  isLoading: boolean;
  isError: boolean;
  agenda: HomeDashboardEvent[];
  serverTime: number;
}) {
  if (!isAuthenticated) {
    return (
      <EmptyMessage className="mt-6">
        Entre na aplicação para desbloquear a lista real de eventos futuros, ordenada por data e prioridade.
      </EmptyMessage>
    );
  }

  if (isLoading) {
    return <EmptyMessage className="mt-6">A sincronizar agenda…</EmptyMessage>;
  }

  if (isError) {
    return (
      <EmptyMessage className="mt-6" tone="error">
        Os eventos futuros não puderam ser carregados.
      </EmptyMessage>
    );
  }

  if (!agenda.length) {
    return (
      <EmptyMessage className="mt-6">
        Ainda não existem eventos futuros publicados.
      </EmptyMessage>
    );
  }

  return (
    <ul className="mt-6 divide-y divide-white/8 border-y border-white/8">
      {agenda.slice(0, 5).map(event => (
        <li key={event.id} className="group grid grid-cols-[3px_1fr_auto] gap-4 py-4">
          <span
            className="rounded-full"
            style={{ backgroundColor: event.categoryColor, opacity: event.isUrgent ? 1 : 0.55 }}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.24em] text-white/40">
                {event.categoryLabel}
              </span>
              {event.isUrgent ? (
                <span className="text-[10px] uppercase tracking-[0.24em] text-red-300/80">
                  · Urgente
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-sm font-medium text-white">{event.title}</p>
            <p className="mt-0.5 text-xs text-white/45">
              {formatEventDate(event.startsAt)} · {countdownLabel(event.startsAt, serverTime)}
            </p>
          </div>
          <span className="self-center text-[11px] font-medium uppercase tracking-[0.16em] text-white/45">
            {event.priorityLabel}
          </span>
        </li>
      ))}
    </ul>
  );
}

function EmptyMessage({
  children,
  className = "",
  tone = "neutral",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "neutral" | "error";
}) {
  const toneClass =
    tone === "error" ? "text-red-200/70 border-red-400/20" : "text-white/45 border-white/10";
  return (
    <p className={`mt-6 border-t border-dashed py-6 text-sm leading-relaxed ${toneClass} ${className}`}>
      {children}
    </p>
  );
}

function countdownLabel(target: number, reference: number) {
  const diff = target - reference;

  if (diff <= 0) return "Disponível agora";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return `Faltam ${days}d${hours > 0 ? ` ${hours}h` : ""}`;
  }

  const minutes = Math.max(1, Math.floor(diff / (1000 * 60)));
  return `Faltam ${minutes} min`;
}

function formatEventDate(timestamp: number) {
  return new Date(timestamp).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
