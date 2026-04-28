export const academicRoles = ["student", "professor", "admin"] as const;
export type AcademicRole = (typeof academicRoles)[number];

export const eventCategories = ["activity", "exam", "assignment", "notice"] as const;
export type EventCategory = (typeof eventCategories)[number];

export const eventPriorities = ["low", "medium", "high", "critical"] as const;
export type EventPriority = (typeof eventPriorities)[number];

export const UNIMAR_BRAND = {
  primary: "#0072BC",
  secondary: "#0D3B66",
  accent: "#F4C542",
  accentStrong: "#FFB703",
  surface: "#07111F",
  surfaceMuted: "#0F1B2E",
  glow: "#3ABEFF",
} as const;

export const EVENT_CATEGORY_META: Record<
  EventCategory,
  {
    label: string;
    shortLabel: string;
    color: string;
    softColor: string;
    borderColor: string;
  }
> = {
  activity: {
    label: "Atividades",
    shortLabel: "Atividade",
    color: "#2563EB",
    softColor: "rgba(37, 99, 235, 0.15)",
    borderColor: "rgba(96, 165, 250, 0.45)",
  },
  exam: {
    label: "Provas",
    shortLabel: "Prova",
    color: "#DC2626",
    softColor: "rgba(220, 38, 38, 0.15)",
    borderColor: "rgba(248, 113, 113, 0.45)",
  },
  assignment: {
    label: "Entrega de trabalhos",
    shortLabel: "Trabalho",
    color: "#F97316",
    softColor: "rgba(249, 115, 22, 0.15)",
    borderColor: "rgba(251, 146, 60, 0.45)",
  },
  notice: {
    label: "Avisos",
    shortLabel: "Aviso",
    color: "#16A34A",
    softColor: "rgba(22, 163, 74, 0.15)",
    borderColor: "rgba(74, 222, 128, 0.45)",
  },
};

export const EVENT_PRIORITY_META: Record<
  EventPriority,
  {
    label: string;
    value: number;
    ring: string;
    glow: string;
  }
> = {
  low: {
    label: "Baixa",
    value: 1,
    ring: "rgba(148, 163, 184, 0.35)",
    glow: "rgba(148, 163, 184, 0.16)",
  },
  medium: {
    label: "Média",
    value: 2,
    ring: "rgba(56, 189, 248, 0.4)",
    glow: "rgba(56, 189, 248, 0.18)",
  },
  high: {
    label: "Alta",
    value: 3,
    ring: "rgba(245, 158, 11, 0.46)",
    glow: "rgba(245, 158, 11, 0.18)",
  },
  critical: {
    label: "Crítica",
    value: 4,
    ring: "rgba(239, 68, 68, 0.55)",
    glow: "rgba(239, 68, 68, 0.22)",
  },
};

export const dashboardPreviewModes = ["student", "professor"] as const;
export type DashboardPreviewMode = (typeof dashboardPreviewModes)[number];
