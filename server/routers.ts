import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  buildPendingSummary,
  canManageAcademicEvents,
  createAcademicEvent,
  decorateAcademicEvent,
  deleteAcademicEvent,
  getAcademicEventById,
  getUnreadNotificationCount,
  listAcademicEvents,
  listNotifications,
  listUpcomingAcademicEvents,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  updateAcademicEvent,
} from "./db";
import { dashboardPreviewModes, eventCategories, eventPriorities } from "../shared/academic";

const academicEventInput = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(1).max(4000),
  category: z.enum(eventCategories),
  priority: z.enum(eventPriorities),
  startsAt: z.number().int().positive(),
  endsAt: z.number().int().positive().nullable().optional(),
  allDay: z.boolean().default(false),
});

const categoryFilters = [...eventCategories, "all"] as const;

const calendarFiltersInput = z
  .object({
    from: z.number().int().positive().optional(),
    to: z.number().int().positive().optional(),
    category: z.enum(categoryFilters).optional(),
  })
  .optional();

function getMonthWindow(now: number) {
  const current = new Date(now);
  const start = new Date(current.getFullYear(), current.getMonth(), 1).getTime();
  const end = new Date(current.getFullYear(), current.getMonth() + 2, 0, 23, 59, 59, 999).getTime();
  return { start, end };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  calendar: router({
    dashboard: protectedProcedure
      .input(
        z
          .object({
            previewMode: z.enum(dashboardPreviewModes).optional(),
          })
          .optional(),
      )
      .query(async ({ ctx, input }) => {
        const now = Date.now();
        const { start, end } = getMonthWindow(now);
        const currentUser = ctx.user;
        const canManage = canManageAcademicEvents(currentUser.role);
        const previewMode = currentUser.role === "admin" ? input?.previewMode ?? "professor" : undefined;
        const experience = previewMode ?? (canManage ? "professor" : "student");

        const [monthEvents, upcoming, notifications, unreadCount] = await Promise.all([
          listAcademicEvents({ from: start, to: end }),
          listUpcomingAcademicEvents(24, now),
          listNotifications(currentUser.id, 8),
          getUnreadNotificationCount(currentUser.id),
        ]);

        const decoratedMonthEvents = monthEvents.map(event => decorateAcademicEvent(event, now));
        const decoratedUpcoming = upcoming.map(event => decorateAcademicEvent(event, now));
        const agenda = decoratedUpcoming.slice(0, 10);
        const summary = buildPendingSummary(upcoming, now);
        const nextExam = decoratedUpcoming.find(event => event.category === "exam") ?? null;
        const nextAssignment = decoratedUpcoming.find(event => event.category === "assignment") ?? null;
        const nextNotice = decoratedUpcoming.find(event => event.category === "notice") ?? null;

        return {
          serverTime: now,
          experience,
          canManageEvents: canManage,
          currentUser,
          summary,
          widgets: {
            nextExam,
            nextAssignment,
            nextNotice,
          },
          monthEvents: decoratedMonthEvents,
          upcoming: decoratedUpcoming,
          agenda,
          notifications,
          unreadCount,
        };
      }),

    list: protectedProcedure.input(calendarFiltersInput).query(async ({ input }) => {
      const now = Date.now();
      const events = await listAcademicEvents(input ?? {});
      return events.map(event => decorateAcademicEvent(event, now));
    }),

    getById: protectedProcedure
      .input(z.object({ eventId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const event = await getAcademicEventById(input.eventId);
        if (!event) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Evento não encontrado." });
        }

        return decorateAcademicEvent(event);
      }),

    create: protectedProcedure.input(academicEventInput).mutation(async ({ ctx, input }) => {
      if (!canManageAcademicEvents(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas professores podem criar eventos." });
      }

      const createdEvent = await createAcademicEvent(ctx.user.id, input);
      return decorateAcademicEvent(createdEvent);
    }),

    update: protectedProcedure
      .input(
        z.object({
          eventId: z.number().int().positive(),
          data: academicEventInput,
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (!canManageAcademicEvents(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas professores podem editar eventos." });
        }

        const updatedEvent = await updateAcademicEvent(input.eventId, ctx.user.id, input.data);
        return decorateAcademicEvent(updatedEvent);
      }),

    remove: protectedProcedure
      .input(z.object({ eventId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        if (!canManageAcademicEvents(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas professores podem remover eventos." });
        }

        return deleteAcademicEvent(input.eventId);
      }),

    notifications: protectedProcedure.query(async ({ ctx }) => {
      return listNotifications(ctx.user.id, 16);
    }),

    markNotificationRead: protectedProcedure
      .input(z.object({ notificationId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        return markNotificationAsRead(ctx.user.id, input.notificationId);
      }),

    markAllNotificationsRead: protectedProcedure.mutation(async ({ ctx }) => {
      return markAllNotificationsAsRead(ctx.user.id);
    }),
  }),
});

export type AppRouter = typeof appRouter;
