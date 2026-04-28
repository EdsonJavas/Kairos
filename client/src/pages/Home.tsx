import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BellRing,
  BookMarked,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Eye,
  Filter,
  Flame,
  GraduationCap,
  Hourglass,
  LayoutDashboard,
  LayoutList,
  Megaphone,
  PencilLine,
  Send,
  ShieldAlert,
  Sparkles,
  Sunrise,
  Target,
  Wand2,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
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

const CATEGORY_DETAILS: Array<{
  value: HomeEventCategory;
  label: string;
  short: string;
  color: string;
  icon: typeof BookMarked;
  description: string;
  example: string;
}> = [
  {
    value: "activity",
    label: "Atividades",
    short: "Atividades",
    color: "#3B82F6",
    icon: BookMarked,
    description: "Compromissos académicos planeados, aulas práticas e tarefas regulares.",
    example: "Aula prática · Direito Civil",
  },
  {
    value: "exam",
    label: "Provas",
    short: "Provas",
    color: "#EF4444",
    icon: GraduationCap,
    description: "Avaliações, simulados e testes que exigem preparação prévia.",
    example: "Prova de Direito Constitucional",
  },
  {
    value: "assignment",
    label: "Trabalhos",
    short: "Entregas",
    color: "#F97316",
    icon: ClipboardCheck,
    description: "Prazos para entrega de trabalhos, projetos e portfolios.",
    example: "Entrega · Trabalho de POO",
  },
  {
    value: "notice",
    label: "Avisos",
    short: "Avisos",
    color: "#22C55E",
    icon: Megaphone,
    description: "Comunicações institucionais, alterações de horário e recados gerais.",
    example: "Reunião de colegiado adiada",
  },
];

const FEATURES: Array<{
  icon: typeof Sparkles;
  title: string;
  description: string;
  hint: string;
  color: string;
}> = [
  {
    icon: CalendarRange,
    title: "Calendário mensal denso",
    description:
      "Grade interativa com cells de alto contraste, eventos por categoria, density rail e legenda cromática.",
    hint: "Clique em qualquer dia para abrir o spotlight contextual.",
    color: "#F4C542",
  },
  {
    icon: LayoutList,
    title: "Agenda agrupada por janela",
    description:
      "Eventos divididos em Hoje · Amanhã · Esta semana · Este mês · Mais adiante, com countdown adaptativo.",
    hint: "Tom do countdown muda conforme a urgência.",
    color: "#3ABEFF",
  },
  {
    icon: BellRing,
    title: "Notificações in-app",
    description:
      "Centro de alertas com ícone tematizado por categoria, dot pulsante para não lidas e marcação em massa.",
    hint: "Conta visual no badge da Bell em tempo real.",
    color: "#F87171",
  },
  {
    icon: Activity,
    title: "Heatmap semanal stacked",
    description:
      "Distribuição de eventos por dia, segmentada por categoria, com barras gradientes e tooltips ricos.",
    hint: "Identifica picos de carga em segundos.",
    color: "#A78BFA",
  },
  {
    icon: Wand2,
    title: "Composer visual de eventos",
    description:
      "Pickers em grid com estados ativos, preview ao vivo, checklist de prontidão e contagem de caracteres.",
    hint: "Pré-visualização sincronizada enquanto digita.",
    color: "#34D399",
  },
  {
    icon: ShieldAlert,
    title: "Sinalização de urgência",
    description:
      "Eventos com prioridade crítica destacados em vermelho, com ring, glow e pulse em todos os contextos.",
    hint: "Reconhecimento imediato do que exige resposta.",
    color: "#F97316",
  },
];

const FLOW_STEPS: Array<{
  step: string;
  title: string;
  description: string;
  icon: typeof Sparkles;
  color: string;
}> = [
  {
    step: "01",
    title: "Entre com suas credenciais",
    description: "Use as contas demo pré-configuradas (professor ou aluno) ou seu acesso institucional.",
    icon: LayoutDashboard,
    color: "#3ABEFF",
  },
  {
    step: "02",
    title: "Veja sua semana sincronizada",
    description: "O painel detecta seu perfil e exibe eventos, prioridades e atalhos contextuais.",
    icon: CalendarDays,
    color: "#F4C542",
  },
  {
    step: "03",
    title: "Acompanhe alertas em tempo real",
    description: "Notificações aparecem assim que docentes publicam ou atualizam compromissos.",
    icon: BellRing,
    color: "#F87171",
  },
  {
    step: "04",
    title: "Organize com profundidade",
    description: "Filtre por categoria, prioridade, período e abra o detalhe rico de cada evento.",
    icon: Target,
    color: "#34D399",
  },
];

const EXPERIENCE_VIEWS: Array<{
  id: "student" | "professor";
  label: string;
  title: string;
  description: string;
  icon: typeof BookMarked;
  color: string;
  bullets: Array<{ icon: typeof Sparkles; label: string }>;
  cta: string;
  ctaIcon: typeof Sparkles;
}> = [
  {
    id: "student",
    label: "Para alunos",
    title: "Tudo que importa no seu semestre.",
    description:
      "Visão clara de provas, prazos e avisos. Filtros por categoria e prioridade, agenda agrupada por janela temporal e countdown adaptativo para cada compromisso.",
    icon: BookMarked,
    color: "#3ABEFF",
    bullets: [
      { icon: CalendarRange, label: "Calendário interativo com filtros visuais" },
      { icon: LayoutList, label: "Agenda futura ordenada por urgência" },
      { icon: BellRing, label: "Centro de notificações com filtro por estado" },
      { icon: Eye, label: "Detalhe rico de cada evento em modal cinematográfico" },
    ],
    cta: "Entrar como aluno",
    ctaIcon: ArrowRight,
  },
  {
    id: "professor",
    label: "Para docentes",
    title: "Publique e gerencie com elegância.",
    description:
      "Composer visual com pickers tematizados, preview ao vivo, checklist de prontidão e atalhos contextuais. Crie, edite e remova eventos sem fricção.",
    icon: GraduationCap,
    color: "#F4C542",
    bullets: [
      { icon: Wand2, label: "Composer com pré-visualização ao vivo" },
      { icon: PencilLine, label: "Edição em modal sem perder contexto" },
      { icon: ShieldAlert, label: "Marcação de prioridades com 4 níveis visuais" },
      { icon: Send, label: "Notificação automática para a turma" },
    ],
    cta: "Entrar como docente",
    ctaIcon: ArrowRight,
  },
];

const STATS_BAR: Array<{ label: string; value: string; hint: string; color: string; icon: typeof Sparkles }> = [
  { label: "Categorias", value: "4", hint: "Cores institucionais", color: "#3B82F6", icon: BookMarked },
  { label: "Prioridades", value: "4", hint: "Baixa → crítica", color: "#F4C542", icon: Target },
  { label: "Buckets temporais", value: "5", hint: "Hoje → futuro distante", color: "#A78BFA", icon: CalendarRange },
  { label: "Latência típica", value: "<50ms", hint: "tRPC + cache", color: "#22C55E", icon: Activity },
];

export default function Home() {
  const { loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [activeView, setActiveView] = useState<"student" | "professor">("student");
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

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

  const greeting = greetingFor(now.getHours());
  const dateLong = now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const timeShort = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const nextEvent = agenda[0] ?? null;
  const goToApp = () => setLocation(isAuthenticated ? "/app" : "/login");

  return (
    <div className="min-h-screen text-white">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-white/8 bg-slate-950/75 backdrop-blur-xl">
        <div className="container flex min-h-20 items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-amber-300/30 bg-gradient-to-b from-amber-300/15 to-amber-300/[0.05] text-amber-300 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),0_8px_22px_-10px_rgba(244,197,66,0.5)]">
              <CalendarRange className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-300 ring-2 ring-slate-950" />
              </span>
            </span>
            <div>
              <p className="brand-text-gold text-[10px] font-bold uppercase tracking-[0.32em]">
                Calendário académico
              </p>
              <h1 className="text-lg font-semibold leading-tight tracking-tight">Kairos</h1>
            </div>
          </a>

          <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 lg:flex">
            <a
              href="#features"
              className="rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              Recursos
            </a>
            <a
              href="#experience"
              className="rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              Experiência
            </a>
            <a
              href="#flow"
              className="rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              Fluxo
            </a>
            {isAuthenticated ? null : (
              <a
                href="#demo"
                className="rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300 transition-colors hover:bg-amber-300/10"
              >
                Demo
              </a>
            )}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 sm:flex">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="font-heading text-xs font-bold tabular-nums text-white">{timeShort}</span>
            </div>
            <Button
              className={cn(
                "rounded-full px-5 text-xs font-bold uppercase tracking-wider transition-all",
                isAuthenticated
                  ? "brand-button-blue shadow-[0_8px_20px_-8px_rgba(0,114,188,0.6)]"
                  : "brand-button-gold shadow-[0_8px_20px_-8px_rgba(244,197,66,0.6)] hover:scale-[1.02]",
              )}
              onClick={goToApp}
            >
              {isAuthenticated ? "Abrir painel" : "Entrar"}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="container relative pb-12 pt-12 md:pb-16 md:pt-16">
          <div className="grid gap-10 xl:grid-cols-[1.15fr_0.85fr] xl:items-center">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold uppercase tracking-[0.24em]">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-emerald-300">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  Operacional
                </span>
                <span className="text-white/35">·</span>
                <span className="capitalize text-white/55">{dateLong}</span>
                {isAuthenticated ? (
                  <>
                    <span className="text-white/35">·</span>
                    <span className="text-amber-300">{greeting}</span>
                  </>
                ) : null}
              </div>

              <div>
                <h2 className="text-balance text-[2.6rem] font-semibold leading-[1.05] tracking-tight md:text-[3.6rem]">
                  Calendário académico repensado{" "}
                  <span className="brand-text-gold">de ponta a ponta.</span>
                </h2>
                <p className="mt-4 max-w-xl text-base leading-relaxed text-white/60 md:text-lg">
                  Provas, trabalhos, atividades e avisos com leitura imediata por categoria e prioridade. Construído para que professores publiquem com elegância e alunos acompanhem sem ruído.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  onClick={goToApp}
                  className="brand-button-gold h-11 rounded-full px-6 text-sm font-bold tracking-tight shadow-[0_12px_32px_-12px_rgba(244,197,66,0.7)] transition-all hover:scale-[1.02]"
                >
                  {isAuthenticated ? "Abrir meu painel" : "Iniciar sessão"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    const el = document.getElementById("features");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="h-11 rounded-full border border-white/12 bg-white/[0.04] px-5 text-sm font-medium text-white/75 hover:bg-white/[0.08] hover:text-white"
                >
                  Explorar recursos
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-4 border-t border-white/8 pt-5 text-xs text-white/45">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  Pronto pra produção
                </span>
                <span className="text-white/15">·</span>
                <span className="flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-sky-300" />
                  tRPC end-to-end tipado
                </span>
                <span className="text-white/15">·</span>
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                  Identidade Unimar
                </span>
              </div>
            </div>

            {/* Hero showcase: card real ao vivo se autenticado, mock visual se visitante */}
            <div className="relative">
              <div className="pointer-events-none absolute -right-10 -top-10 h-72 w-72 rounded-full bg-amber-300/12 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-10 -left-10 h-64 w-64 rounded-full bg-sky-500/14 blur-3xl" />

              {isAuthenticated ? (
                <HeroAuthenticatedCard
                  summary={summary}
                  widgets={widgets}
                  agenda={agenda}
                  serverTime={serverTime}
                  isLoading={dashboardQuery.isLoading}
                  isError={dashboardQuery.isError}
                  onGoToApp={goToApp}
                  onGoToAgenda={() => setLocation("/agenda")}
                  nextEvent={nextEvent}
                />
              ) : (
                <HeroPreviewCard now={now} />
              )}
            </div>
          </div>
        </section>

        {/* STATS BAR */}
        <section className="container pb-12 md:pb-16">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {STATS_BAR.map(item => (
              <StatChip key={item.label} {...item} />
            ))}
          </div>
        </section>

        {/* CATEGORIAS · explainer */}
        <section className="container pb-12 md:pb-20">
          <SectionHeading
            kicker="Leitura cromática"
            title="4 categorias, 4 cores, leitura imediata."
            subtitle="Cada compromisso assume uma cor institucional desde a barra do calendário até a notificação. Você reconhece o tipo do evento sem ler o texto."
          />
          <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {CATEGORY_DETAILS.map(cat => (
              <CategoryShowcase key={cat.value} {...cat} />
            ))}
          </div>
        </section>

        {/* RECURSOS · grid */}
        <section id="features" className="container pb-12 md:pb-20">
          <SectionHeading
            kicker="Recursos"
            title="Construído para densidade real de informação."
            subtitle="Sem placeholders, sem fluff. Cada componente foi desenhado para exibir dados úteis com hierarquia tipográfica firme e estados visuais claros."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {FEATURES.map(feature => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </section>

        {/* EXPERIÊNCIA · split com tabs */}
        <section id="experience" className="container pb-12 md:pb-20">
          <SectionHeading
            kicker="Experiência por perfil"
            title="Dois fluxos, uma identidade visual coerente."
            subtitle="O sistema detecta o seu perfil e mostra exatamente o que importa: ferramentas de criação para docentes, leitura otimizada para alunos."
          />

          <div className="mt-6 flex justify-center">
            <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
              {EXPERIENCE_VIEWS.map(view => (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => setActiveView(view.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] transition-all",
                    activeView === view.id
                      ? "bg-white/[0.12] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                      : "text-white/45 hover:bg-white/[0.06] hover:text-white/80",
                  )}
                >
                  <view.icon
                    className="h-3.5 w-3.5"
                    style={{ color: activeView === view.id ? view.color : undefined }}
                  />
                  {view.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            {EXPERIENCE_VIEWS.map(view =>
              view.id === activeView ? (
                <ExperienceCard key={view.id} view={view} onCta={goToApp} />
              ) : null,
            )}
          </div>
        </section>

        {/* AUTHENTICATED DATA · só para logados */}
        {isAuthenticated ? (
          <section className="container pb-12 md:pb-20">
            <SectionHeading
              kicker="Sua rotina · ao vivo"
              title="O que está acontecendo agora."
              subtitle="Dados em tempo real do seu calendário. Use os atalhos para abrir o painel completo, agenda futura ou central de notificações."
            />
            <AuthenticatedSection
              summary={summary}
              widgets={widgets}
              agenda={agenda}
              serverTime={serverTime}
              isLoading={dashboardQuery.isLoading}
              isError={dashboardQuery.isError}
              onGoToApp={goToApp}
              onGoToAgenda={() => setLocation("/agenda")}
              onGoToNotifications={() => setLocation("/notificacoes")}
            />
          </section>
        ) : null}

        {/* FLUXO · timeline */}
        <section id="flow" className="container pb-12 md:pb-20">
          <SectionHeading
            kicker="Fluxo de uso"
            title="Quatro passos para entrar em ritmo."
            subtitle="Da primeira sessão até a operação fluida da semana — sem etapas escondidas, sem fricção."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {FLOW_STEPS.map((step, idx) => (
              <FlowCard key={step.step} step={step} index={idx} total={FLOW_STEPS.length} />
            ))}
          </div>
        </section>

        {/* DEMO · só para visitantes */}
        {!isAuthenticated ? (
          <section id="demo" className="container pb-12 md:pb-20">
            <SectionHeading
              kicker="Acesso instantâneo"
              title="Teste agora com contas demo."
              subtitle="Duas contas pré-configuradas para você experimentar a perspectiva de docente e de aluno em segundos."
            />
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <DemoAccountCard
                role="professor"
                email="professor@unimar.br"
                password="professor123"
                onUse={() => setLocation("/login")}
              />
              <DemoAccountCard
                role="student"
                email="aluno@unimar.br"
                password="aluno123"
                onUse={() => setLocation("/login")}
              />
            </div>
          </section>
        ) : null}

        {/* CTA FINAL */}
        <section className="container pb-16 md:pb-24">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(0,114,188,0.18),rgba(7,17,31,0.55)_50%,rgba(244,197,66,0.18))] p-8 shadow-[0_28px_80px_-20px_rgba(0,0,0,0.6)] md:p-12">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-300/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

            <div className="relative grid gap-6 xl:grid-cols-[1.4fr_1fr] xl:items-center">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-amber-300/85">
                  Pronto para organizar o semestre
                </p>
                <h3 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-white md:text-[2.4rem]">
                  Acesse o painel e veja sua agenda académica em alta definição.
                </h3>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60 md:text-base">
                  Compromissos categorizados, prioridades sinalizadas, notificações em tempo real e composer visual para docentes — tudo numa única superfície.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                <Button
                  onClick={goToApp}
                  className="brand-button-gold h-12 rounded-full px-7 text-sm font-bold tracking-tight shadow-[0_14px_36px_-14px_rgba(244,197,66,0.7)] transition-all hover:scale-[1.02]"
                >
                  {isAuthenticated ? "Abrir painel" : "Iniciar sessão"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setLocation(isAuthenticated ? "/agenda" : "#features")}
                  className="h-12 rounded-full border border-white/15 bg-white/[0.04] px-5 text-sm font-medium text-white/75 hover:bg-white/[0.08] hover:text-white"
                >
                  {isAuthenticated ? "Ir para agenda" : "Ver recursos"}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-white/8 bg-slate-950/50 backdrop-blur-xl">
          <div className="container grid gap-8 py-10 md:grid-cols-[1.5fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-300/30 bg-amber-300/10 text-amber-300">
                  <CalendarRange className="h-4 w-4" />
                </span>
                <div>
                  <p className="brand-text-gold text-[10px] font-bold uppercase tracking-[0.32em]">
                    Kairos
                  </p>
                  <h4 className="text-sm font-semibold text-white">Calendário académico Unimar</h4>
                </div>
              </div>
              <p className="mt-3 max-w-md text-xs leading-relaxed text-white/50">
                Construído com React 19, tRPC, Drizzle e Tailwind CSS 4. Identidade cromática alinhada à
                Universidade de Marília.
              </p>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">Navegação</p>
              <ul className="mt-3 space-y-1.5 text-xs text-white/65">
                <li>
                  <a href="#features" className="hover:text-amber-300">
                    Recursos
                  </a>
                </li>
                <li>
                  <a href="#experience" className="hover:text-amber-300">
                    Experiência por perfil
                  </a>
                </li>
                <li>
                  <a href="#flow" className="hover:text-amber-300">
                    Fluxo de uso
                  </a>
                </li>
                {isAuthenticated ? null : (
                  <li>
                    <a href="#demo" className="hover:text-amber-300">
                      Contas demo
                    </a>
                  </li>
                )}
              </ul>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">Status</p>
              <div className="mt-3 space-y-2 text-xs text-white/65">
                <p className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.7)]" />
                  Sistema operacional
                </p>
                <p className="inline-flex items-center gap-2">
                  <Clock3 className="h-3 w-3 text-white/45" />
                  Hora local <span className="font-heading font-bold tabular-nums text-white">{timeShort}</span>
                </p>
                <p className="inline-flex items-center gap-2">
                  <Activity className="h-3 w-3 text-white/45" />
                  Build estável
                </p>
              </div>
            </div>
          </div>
          <div className="border-t border-white/8 py-5">
            <div className="container flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/35">
              <span>© {new Date().getFullYear()} Kairos · Universidade de Marília</span>
              <span className="flex items-center gap-2">
                <span className="font-bold uppercase tracking-[0.18em] text-white/45">v1.0</span>
                <span className="text-white/15">·</span>
                <span>feito com café e tipografia tabular</span>
              </span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────
   Helpers e subcomponentes
   ─────────────────────────────────────────────────────────────────────── */

function greetingFor(hour: number) {
  if (hour < 5) return "Boa madrugada";
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function countdownLabel(target: number, reference: number) {
  const diff = target - reference;
  if (diff <= 0) return "Disponível agora";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d${hours > 0 ? ` ${hours}h` : ""}`;
  const minutes = Math.max(1, Math.floor(diff / (1000 * 60)));
  return `${minutes} min`;
}

function formatEventDateShort(timestamp: number, allDay: boolean) {
  const d = new Date(timestamp);
  const dateStr = d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
  if (allDay) return dateStr;
  const timeStr = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dateStr} · ${timeStr}`;
}

function SectionHeading({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-amber-300/85">{kicker}</p>
      <h3 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-white md:text-[2rem]">
        {title}
      </h3>
      {subtitle ? (
        <p className="mt-3 text-sm leading-relaxed text-white/55 md:text-[15px]">{subtitle}</p>
      ) : null}
    </div>
  );
}

/* ─── Hero showcase: visitante ─── */

function HeroPreviewCard({ now }: { now: Date }) {
  const dateNum = now.getDate();
  const monthLabel = now.toLocaleDateString("pt-BR", { month: "short" });
  const weekdayLabel = now.toLocaleDateString("pt-BR", { weekday: "short" });

  const mockEvents = [
    {
      id: 1,
      title: "Prova de Direito Constitucional",
      time: "14:00",
      category: "exam" as const,
      color: "#EF4444",
      label: "Provas",
      priority: "Alta",
      urgent: true,
    },
    {
      id: 2,
      title: "Entrega · Trabalho de POO",
      time: "23:59",
      category: "assignment" as const,
      color: "#F97316",
      label: "Trabalhos",
      priority: "Média",
      urgent: false,
    },
    {
      id: 3,
      title: "Reunião do colegiado",
      time: "10:30",
      category: "notice" as const,
      color: "#22C55E",
      label: "Avisos",
      priority: "Baixa",
      urgent: false,
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.015] p-5 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.7)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent" />
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-amber-300/15 blur-3xl" />

      {/* Header do card */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl border border-amber-300/30 bg-gradient-to-b from-amber-300/15 to-amber-300/[0.04]">
            <span className="text-[8px] font-bold uppercase tracking-[0.32em] text-amber-300/85">
              {weekdayLabel}
            </span>
            <span className="font-heading text-base font-bold tabular-nums leading-none text-white">
              {dateNum}
            </span>
            <span className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.24em] text-white/55">
              {monthLabel}
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-300/85">
              Pré-visualização
            </p>
            <h4 className="text-sm font-semibold text-white">Compromissos do dia</h4>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
          <span className="h-1 w-1 rounded-full bg-emerald-400" />
          Mock
        </span>
      </div>

      {/* Lista mock */}
      <ul className="mt-4 space-y-2">
        {mockEvents.map(ev => (
          <li
            key={ev.id}
            className="relative overflow-hidden rounded-xl border border-white/8 bg-white/[0.025] p-3"
          >
            <span
              className="absolute inset-y-0 left-0 w-1 rounded-r-full"
              style={{
                background: `linear-gradient(180deg, ${ev.color}, ${ev.color}55)`,
                boxShadow: `0 0 12px ${ev.color}66`,
              }}
            />
            <div className="flex items-center gap-3 pl-2">
              <div className="flex w-12 shrink-0 flex-col items-center rounded-lg border border-white/10 bg-white/[0.04] py-1.5">
                <span className="font-heading text-xs font-bold tabular-nums text-white">{ev.time}</span>
                <span className="text-[8px] font-bold uppercase tracking-wider text-white/35">hoje</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                    style={{ background: `${ev.color}22`, color: ev.color }}
                  >
                    {ev.label}
                  </span>
                  {ev.urgent ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-red-500/14 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-300">
                      <ShieldAlert className="h-2 w-2" />
                      Urgente
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-[12px] font-semibold text-white">{ev.title}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Mini-strip de stats */}
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/8 pt-3">
        {[
          { label: "Eventos", value: "12", color: "#3ABEFF" },
          { label: "Urgentes", value: "2", color: "#F87171" },
          { label: "Hoje", value: "3", color: "#F4C542" },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border border-white/8 bg-white/[0.02] px-2 py-1.5 text-center">
            <p className="text-[8px] font-bold uppercase tracking-wider text-white/40">{stat.label}</p>
            <p className="mt-0.5 font-heading text-base font-bold tabular-nums" style={{ color: stat.color }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Hero showcase: autenticado ─── */

function HeroAuthenticatedCard({
  summary,
  widgets,
  agenda,
  serverTime,
  isLoading,
  isError,
  onGoToApp,
  onGoToAgenda,
  nextEvent,
}: {
  summary?: {
    pendingActivities: number;
    upcomingExams: number;
    assignmentDeadlines: number;
    notices: number;
    urgentCount: number;
    totalFuture: number;
  };
  widgets?: {
    nextExam: HomeDashboardEvent | null;
    nextAssignment: HomeDashboardEvent | null;
  };
  agenda: HomeDashboardEvent[];
  serverTime: number;
  isLoading: boolean;
  isError: boolean;
  onGoToApp: () => void;
  onGoToAgenda: () => void;
  nextEvent: HomeDashboardEvent | null;
}) {
  if (isLoading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border border-white/15 border-t-amber-300" />
        <p className="mt-3 text-xs uppercase tracking-[0.28em] text-white/40">Sincronizando dados…</p>
      </div>
    );
  }

  if (isError || !summary) {
    return (
      <div className="rounded-3xl border border-red-400/20 bg-red-500/5 p-8 text-center">
        <p className="text-sm text-red-200/80">Não foi possível carregar dados agora.</p>
      </div>
    );
  }

  const next = nextEvent ?? widgets?.nextExam ?? widgets?.nextAssignment ?? null;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.015] p-5 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.7)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent" />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-400/25 bg-sky-500/12 text-sky-300">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-sky-300/85">Ao vivo</p>
            <h4 className="text-sm font-semibold text-white">Sua rotina sincronizada</h4>
          </div>
        </div>
        <button
          type="button"
          onClick={onGoToApp}
          className="inline-flex items-center gap-1 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-300 transition-all hover:bg-amber-300/20"
        >
          Painel
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {/* Mini KPIs */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Futuros", value: summary.totalFuture, color: "#3ABEFF", icon: CalendarDays },
          { label: "Urgentes", value: summary.urgentCount, color: "#F87171", icon: ShieldAlert },
          { label: "Provas", value: summary.upcomingExams, color: "#F4C542", icon: GraduationCap },
          { label: "Prazos", value: summary.assignmentDeadlines, color: "#F97316", icon: ClipboardCheck },
        ].map(item => (
          <div
            key={item.label}
            className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.025] p-2.5"
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
              <span className="font-heading text-lg font-bold tabular-nums text-white">{item.value}</span>
            </div>
            <p className="mt-1.5 text-[9px] font-bold uppercase tracking-wider text-white/50">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Próximo destaque */}
      {next ? (
        <button
          type="button"
          onClick={onGoToAgenda}
          className="group/next mt-4 block w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] p-3.5 text-left transition-all hover:border-white/20 hover:bg-white/[0.05]"
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/45">
              Próximo destaque
            </span>
            <span
              className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider tabular-nums"
              style={{ background: `${next.categoryColor}22`, color: next.categoryColor }}
            >
              <Clock3 className="h-2.5 w-2.5" />
              {countdownLabel(next.startsAt, serverTime)}
            </span>
          </div>
          <p className="mt-2 truncate text-sm font-semibold text-white transition-colors group-hover/next:text-amber-200">
            {next.title}
          </p>
          <p className="mt-0.5 text-[11px] capitalize text-white/45">
            {formatEventDateShort(next.startsAt, next.allDay)}
          </p>
        </button>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.015] p-3.5 text-center">
          <p className="text-xs text-white/45">Nenhum compromisso futuro publicado.</p>
        </div>
      )}

      {/* Mini lista */}
      {agenda.length > 1 ? (
        <ul className="mt-3 space-y-1.5">
          {agenda.slice(1, 4).map(ev => (
            <li key={ev.id} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5">
              <span
                className="h-6 w-0.5 rounded-full"
                style={{ background: ev.categoryColor, boxShadow: `0 0 6px ${ev.categoryColor}88` }}
              />
              <span className="min-w-0 flex-1 truncate text-[11px] text-white/75">{ev.title}</span>
              <span className="font-heading text-[10px] font-bold tabular-nums text-white/45">
                {countdownLabel(ev.startsAt, serverTime)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ─── Stats chips ─── */

function StatChip({
  label,
  value,
  hint,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  color: string;
  icon: typeof Sparkles;
}) {
  return (
    <div className="group/stat relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.015] p-4 transition-all hover:-translate-y-0.5 hover:border-white/20">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-50"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full opacity-25 blur-2xl transition-opacity group-hover/stat:opacity-40"
        style={{ background: color }}
      />
      <div className="relative flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10"
          style={{ background: `${color}1F`, color }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">{label}</p>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="font-heading text-xl font-bold tabular-nums text-white">{value}</span>
            <span className="truncate text-[11px] text-white/45">{hint}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Categoria showcase ─── */

function CategoryShowcase({
  label,
  color,
  icon: Icon,
  description,
  example,
}: (typeof CATEGORY_DETAILS)[number]) {
  return (
    <div
      className="group/cat relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.01] p-5 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_16px_44px_-16px_rgba(0,0,0,0.6)]"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-30 blur-2xl transition-opacity group-hover/cat:opacity-50"
        style={{ background: color }}
      />
      <div className="relative">
        <span
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10"
          style={{ background: `${color}1F`, color }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <h4 className="mt-4 text-base font-semibold tracking-tight text-white">{label}</h4>
        <p className="mt-1.5 text-xs leading-relaxed text-white/55">{description}</p>

        <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-white/35">Exemplo</p>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className="h-3 w-0.5 rounded-full"
              style={{ background: color, boxShadow: `0 0 6px ${color}AA` }}
            />
            <span className="text-[12px] font-medium text-white/80">{example}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Feature card ─── */

function FeatureCard({
  icon: Icon,
  title,
  description,
  hint,
  color,
}: (typeof FEATURES)[number]) {
  return (
    <div className="group/feat relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-5 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_16px_44px_-16px_rgba(0,0,0,0.6)]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-50"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-25 blur-3xl transition-opacity group-hover/feat:opacity-45"
        style={{ background: color }}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
            style={{ background: `${color}1F`, color }}
          >
            <Icon className="h-5 w-5" />
          </span>
          <ArrowUpRight className="h-4 w-4 text-white/30 transition-all group-hover/feat:-translate-y-0.5 group-hover/feat:translate-x-0.5 group-hover/feat:text-amber-300" />
        </div>
        <h4 className="mt-4 text-base font-semibold tracking-tight text-white">{title}</h4>
        <p className="mt-2 text-xs leading-relaxed text-white/55">{description}</p>
        <div className="mt-4 flex items-center gap-1.5 border-t border-white/8 pt-3 text-[11px] text-white/45">
          <Sparkles className="h-3 w-3" style={{ color }} />
          <span className="italic">{hint}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Experience card ─── */

function ExperienceCard({
  view,
  onCta,
}: {
  view: (typeof EXPERIENCE_VIEWS)[number];
  onCta: () => void;
}) {
  const Icon = view.icon;
  const CtaIcon = view.ctaIcon;
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.015] p-6 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)] md:p-8">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${view.color}, transparent)` }}
      />
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-20 blur-3xl"
        style={{ background: view.color }}
      />
      <div className="relative grid gap-8 md:grid-cols-[1.2fr_0.8fr] md:items-start">
        <div>
          <span
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]"
            style={{ background: `${view.color}1F`, color: view.color }}
          >
            <Icon className="h-6 w-6" />
          </span>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.28em]" style={{ color: view.color }}>
            {view.label}
          </p>
          <h4 className="mt-2 text-balance text-2xl font-semibold tracking-tight text-white md:text-[1.75rem]">
            {view.title}
          </h4>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60">{view.description}</p>
          <Button
            onClick={onCta}
            className="mt-5 h-10 rounded-full px-5 text-xs font-bold uppercase tracking-wider"
            style={{
              background: view.color,
              color: "#070d18",
              boxShadow: `0 12px 28px -12px ${view.color}AA`,
            }}
          >
            {view.cta}
            <CtaIcon className="ml-2 h-3.5 w-3.5" />
          </Button>
        </div>

        <ul className="space-y-2">
          {view.bullets.map((bullet, idx) => (
            <li
              key={idx}
              className="group/b relative flex items-center gap-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] p-3 transition-all hover:border-white/20 hover:bg-white/[0.05]"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10"
                style={{ background: `${view.color}1F`, color: view.color }}
              >
                <bullet.icon className="h-4 w-4" />
              </span>
              <span className="text-[13px] font-medium leading-tight text-white/85">{bullet.label}</span>
              <Check
                className="ml-auto h-3.5 w-3.5 opacity-0 transition-opacity group-hover/b:opacity-100"
                style={{ color: view.color }}
                strokeWidth={3}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─── Authenticated section ─── */

function AuthenticatedSection({
  summary,
  widgets,
  agenda,
  serverTime,
  isLoading,
  isError,
  onGoToApp,
  onGoToAgenda,
  onGoToNotifications,
}: {
  summary?: {
    pendingActivities: number;
    upcomingExams: number;
    assignmentDeadlines: number;
    notices: number;
    urgentCount: number;
    totalFuture: number;
  };
  widgets?: {
    nextExam: HomeDashboardEvent | null;
    nextAssignment: HomeDashboardEvent | null;
  };
  agenda: HomeDashboardEvent[];
  serverTime: number;
  isLoading: boolean;
  isError: boolean;
  onGoToApp: () => void;
  onGoToAgenda: () => void;
  onGoToNotifications: () => void;
}) {
  if (isLoading) {
    return (
      <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border border-white/15 border-t-amber-300" />
        <p className="mt-3 text-xs uppercase tracking-[0.28em] text-white/40">Carregando seus dados…</p>
      </div>
    );
  }

  if (isError || !summary) {
    return (
      <div className="mt-8 rounded-3xl border border-red-400/20 bg-red-500/5 p-10 text-center">
        <p className="text-sm text-red-200/80">Falha ao carregar dados em tempo real.</p>
      </div>
    );
  }

  const upcoming = agenda.slice(0, 4);
  const urgents = agenda.filter(e => e.isUrgent).slice(0, 3);

  return (
    <div className="mt-8 grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
      {/* Próximos */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.015] shadow-[0_16px_44px_-16px_rgba(0,0,0,0.55)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" />
        <header className="flex items-center justify-between gap-3 border-b border-white/8 bg-white/[0.02] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-300/12 text-amber-300">
              <CalendarDays className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/45">Próximos</p>
              <h4 className="text-sm font-semibold text-white">Movimentos da agenda</h4>
            </div>
          </div>
          <button
            type="button"
            onClick={onGoToAgenda}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/65 hover:bg-white/[0.08] hover:text-white"
          >
            Ver agenda
            <ChevronRight className="h-3 w-3" />
          </button>
        </header>

        {upcoming.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-white/30" />
            <p className="mt-2 text-sm text-white/45">Sem eventos futuros agendados.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/6 px-5 py-2">
            {upcoming.map(ev => (
              <li key={ev.id} className="py-3">
                <div className="flex items-center gap-3">
                  <div className="flex w-14 shrink-0 flex-col items-center rounded-lg border border-white/10 bg-white/[0.04] py-1.5">
                    <span className="font-heading text-xs font-bold tabular-nums text-white">
                      {new Date(ev.startsAt).toLocaleDateString("pt-BR", { day: "2-digit" })}
                    </span>
                    <span className="text-[8px] font-bold uppercase tracking-wider text-white/35">
                      {new Date(ev.startsAt).toLocaleDateString("pt-BR", { month: "short" })}
                    </span>
                  </div>
                  <span
                    className="h-10 w-1 shrink-0 rounded-full"
                    style={{
                      background: `linear-gradient(180deg, ${ev.categoryColor}, ${ev.categoryColor}55)`,
                      boxShadow: `0 0 10px ${ev.categoryColor}66`,
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                        style={{ background: `${ev.categoryColor}22`, color: ev.categoryColor }}
                      >
                        {ev.categoryLabel}
                      </span>
                      {ev.isUrgent ? (
                        <span className="rounded-full bg-red-500/14 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-300">
                          Urgente
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-[13px] font-semibold text-white">{ev.title}</p>
                    <p className="mt-0.5 text-[11px] text-white/45">
                      {formatEventDateShort(ev.startsAt, ev.allDay)}
                    </p>
                  </div>
                  <span className="hidden font-heading text-[11px] font-bold tabular-nums text-amber-300 sm:inline">
                    {countdownLabel(ev.startsAt, serverTime)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Sidebar: urgentes + atalhos */}
      <aside className="space-y-5">
        {urgents.length > 0 ? (
          <section className="relative overflow-hidden rounded-2xl border border-red-400/25 bg-gradient-to-br from-red-500/[0.08] to-red-500/[0.02] p-5 shadow-[0_8px_24px_-12px_rgba(239,68,68,0.35)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-400/40 to-transparent" />
            <header className="mb-3 flex items-center gap-2.5">
              <span className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-red-400/30 bg-red-500/15 text-red-300">
                <ShieldAlert className="h-4 w-4" />
                <span className="absolute inset-0 animate-ping rounded-xl bg-red-500/30 opacity-30" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-red-300/80">Atenção</p>
                <h4 className="text-[13px] font-semibold text-white">{urgents.length} urgente(s)</h4>
              </div>
            </header>
            <ul className="space-y-2">
              {urgents.map(ev => (
                <li
                  key={ev.id}
                  className="flex items-center gap-2.5 rounded-xl border border-red-400/15 bg-red-500/[0.04] p-2.5"
                >
                  <span
                    className="h-8 w-1 shrink-0 rounded-full"
                    style={{ background: ev.categoryColor, boxShadow: `0 0 8px ${ev.categoryColor}AA` }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-white">{ev.title}</p>
                    <p className="text-[10px] text-red-300/75">
                      {countdownLabel(ev.startsAt, serverTime)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.015] p-5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/30 to-transparent" />
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/45">Atalhos</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <ShortcutBtn icon={LayoutDashboard} label="Painel" color="#3ABEFF" onClick={onGoToApp} />
            <ShortcutBtn icon={LayoutList} label="Agenda" color="#F4C542" onClick={onGoToAgenda} />
            <ShortcutBtn icon={BellRing} label="Alertas" color="#F87171" onClick={onGoToNotifications} />
          </div>
        </section>
      </aside>
    </div>
  );
}

function ShortcutBtn({
  icon: Icon,
  label,
  color,
  onClick,
}: {
  icon: typeof Sparkles;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/sc flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.025] p-3 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.05]"
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10"
        style={{ background: `${color}1F`, color }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-white/65">{label}</span>
    </button>
  );
}

/* ─── Flow card ─── */

function FlowCard({
  step,
  index,
  total,
}: {
  step: (typeof FLOW_STEPS)[number];
  index: number;
  total: number;
}) {
  const Icon = step.icon;
  const isLast = index === total - 1;
  return (
    <div className="group/flow relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.015] p-5 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_16px_44px_-16px_rgba(0,0,0,0.6)]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${step.color}, transparent)` }}
      />
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-25 blur-2xl transition-opacity group-hover/flow:opacity-45"
        style={{ background: step.color }}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span
            className="font-heading text-2xl font-bold tabular-nums leading-none"
            style={{ color: step.color }}
          >
            {step.step}
          </span>
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10"
            style={{ background: `${step.color}1F`, color: step.color }}
          >
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <h4 className="mt-4 text-[15px] font-semibold leading-tight tracking-tight text-white">
          {step.title}
        </h4>
        <p className="mt-2 text-xs leading-relaxed text-white/55">{step.description}</p>
        {!isLast ? (
          <div className="mt-4 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/30">
            <span>Próximo</span>
            <ChevronRight className="h-3 w-3" />
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300/85">
            <CheckCircle2 className="h-3 w-3" />
            Em ritmo
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Demo account ─── */

function DemoAccountCard({
  role,
  email,
  password,
  onUse,
}: {
  role: "professor" | "student";
  email: string;
  password: string;
  onUse: () => void;
}) {
  const isProfessor = role === "professor";
  const color = isProfessor ? "#F4C542" : "#3ABEFF";
  const Icon = isProfessor ? GraduationCap : BookMarked;
  const title = isProfessor ? "Conta docente" : "Conta aluno";
  const subtitle = isProfessor
    ? "Acesso completo ao composer de eventos, edição e remoção."
    : "Visualização clara da agenda, filtros e notificações.";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.015] p-5 shadow-[0_16px_44px_-16px_rgba(0,0,0,0.55)]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-25 blur-3xl"
        style={{ background: color }}
      />

      <div className="relative">
        <div className="flex items-center justify-between">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10"
            style={{ background: `${color}1F`, color }}
          >
            <Icon className="h-5 w-5" />
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ background: `${color}22`, color }}
          >
            Demo
          </span>
        </div>

        <h4 className="mt-4 text-base font-semibold text-white">{title}</h4>
        <p className="mt-1 text-xs leading-relaxed text-white/55">{subtitle}</p>

        <div className="mt-4 grid gap-2">
          <DemoCredField label="E-mail" value={email} />
          <DemoCredField label="Senha" value={password} mono />
        </div>

        <Button
          onClick={onUse}
          className="mt-4 h-10 w-full rounded-full text-xs font-bold uppercase tracking-wider"
          style={{
            background: color,
            color: "#070d18",
            boxShadow: `0 12px 28px -12px ${color}AA`,
          }}
        >
          Usar esta conta
          <ArrowRight className="ml-2 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function DemoCredField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard?.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="group/cred flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-left transition-all hover:border-white/20 hover:bg-white/[0.05]"
    >
      <span className="text-[9px] font-bold uppercase tracking-[0.24em] text-white/40">{label}</span>
      <span className={cn("flex-1 truncate text-[12px] text-white/85", mono && "font-mono tabular-nums")}>
        {value}
      </span>
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/45 group-hover/cred:text-amber-300">
        {copied ? <Check className="h-3 w-3 text-emerald-300" /> : "copiar"}
      </span>
    </button>
  );
}
