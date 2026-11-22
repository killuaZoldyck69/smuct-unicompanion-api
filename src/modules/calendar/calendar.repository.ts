import { prisma } from "../../lib/prisma";
import {
  CalendarStatus,
  EventCategory,
  Prisma,
} from "../../../generated/prisma/client";
import {
  CreateCalendarPayload,
  UpdateCalendarPayload,
  CalendarEventInput,
  UpdateCalendarEventInput,
} from "./calendar.schema";
import { CsvEventRow } from "./calendar.csv";

export function toUtcDate(dateStr: string | Date): Date {
  if (dateStr instanceof Date) return dateStr;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(
      Date.UTC(Number.parseInt(match[1], 10), Number.parseInt(match[2], 10) - 1, Number.parseInt(match[3], 10)),
    );
  }
  return new Date(dateStr);
}

export const findUserWithAcademicProfiles = (userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    include: {
      studentProfile: true,
      teacherProfile: true,
    },
  });

export const findAllCalendarsAdmin = async (
  statusFilter: CalendarStatus | undefined,
  pagination: { page: number; limit: number },
) => {
  const { page, limit } = pagination;
  const skip = (page - 1) * limit;
  const where = statusFilter ? { status: statusFilter } : undefined;

  const [items, total, statusGroups] = await Promise.all([
    prisma.academicCalendar.findMany({
      where,
      include: {
        events: {
          select: {
            id: true,
            calendarId: true,
            title: true,
            category: true,
            startDate: true,
            endDate: true,
            weekNumber: true,
            isHoliday: true,
          },
          orderBy: { startDate: "asc" },
        },
        _count: {
          select: { events: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.academicCalendar.count({ where }),
    prisma.academicCalendar.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const counts = {
    all: 0,
    published: 0,
    draft: 0,
    archived: 0,
  };
  for (const group of statusGroups) {
    const count = group._count._all;
    if (group.status === CalendarStatus.PUBLISHED) counts.published = count;
    else if (group.status === CalendarStatus.DRAFT) counts.draft = count;
    else if (group.status === CalendarStatus.ARCHIVED) counts.archived = count;
  }
  counts.all = counts.published + counts.draft + counts.archived;

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      counts,
    },
  };
};

export const findCalendarById = (id: string) =>
  prisma.academicCalendar.findUnique({
    where: { id },
    include: {
      events: {
        orderBy: { startDate: "asc" },
      },
    },
  });

export const createAcademicCalendar = (
  data: CreateCalendarPayload,
  userId?: string,
) =>
  prisma.academicCalendar.create({
    data: {
      title: data.title,
      semester: data.semester,
      academicYear: data.academicYear ?? new Date().getFullYear(),
      status: data.status || "DRAFT",
      isActive: true,
      targetFaculties: data.targetFaculties || [],
      targetPrograms: data.targetPrograms || [],
      semesterDuration: data.semesterDuration || null,
      targetBatch: data.targetBatch || null,
      createdBy: userId || null,
      publishedAt: data.status === "PUBLISHED" ? new Date() : null,
      events: {
        create: (data.events || []).map((event) => ({
          title: event.title,
          description: event.description || null,
          category: (event.category as EventCategory) || "ACADEMIC",
          startDate: toUtcDate(event.startDate),
          endDate: event.endDate ? toUtcDate(event.endDate) : null,
          weekNumber: event.weekNumber || null,
          isHoliday: event.isHoliday || false,
          isAllDay: event.isAllDay !== false,
          remarks: event.remarks || null,
        })),
      },
    },
    include: {
      events: {
        orderBy: { startDate: "asc" },
      },
    },
  });

export const updateAcademicCalendar = (
  id: string,
  data: UpdateCalendarPayload,
  userId?: string,
) =>
  prisma.academicCalendar.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.semester !== undefined && { semester: data.semester }),
      ...(data.academicYear !== undefined && { academicYear: data.academicYear }),
      ...(data.targetFaculties !== undefined && {
        targetFaculties: data.targetFaculties,
      }),
      ...(data.targetPrograms !== undefined && {
        targetPrograms: data.targetPrograms,
      }),
      ...(data.semesterDuration !== undefined && {
        semesterDuration: data.semesterDuration?.trim() || null,
      }),
      ...(data.targetBatch !== undefined && {
        targetBatch: data.targetBatch?.trim() || null,
      }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      updatedBy: userId || null,
    },
    include: {
      events: {
        orderBy: { startDate: "asc" },
      },
    },
  });

export const updateCalendarStatus = (
  id: string,
  status: CalendarStatus,
  userId?: string,
) =>
  prisma.academicCalendar.update({
    where: { id },
    data: {
      status,
      ...(status === CalendarStatus.PUBLISHED && { publishedAt: new Date() }),
      updatedBy: userId || null,
    },
    include: {
      events: {
        orderBy: { startDate: "asc" },
      },
    },
  });

export const deleteAcademicCalendar = (id: string) =>
  prisma.academicCalendar.delete({
    where: { id },
  });

export const createCalendarEvent = (
  calendarId: string,
  event: CalendarEventInput,
) =>
  prisma.calendarEvent.create({
    data: {
      calendarId,
      title: event.title,
      description: event.description || null,
      category: (event.category as EventCategory) || "ACADEMIC",
      startDate: toUtcDate(event.startDate),
      endDate: event.endDate ? toUtcDate(event.endDate) : null,
      weekNumber: event.weekNumber || null,
      isHoliday: event.isHoliday || false,
      isAllDay: event.isAllDay !== false,
      remarks: event.remarks || null,
    },
  });

export const updateCalendarEvent = (
  eventId: string,
  data: UpdateCalendarEventInput,
) =>
  prisma.calendarEvent.update({
    where: { id: eventId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.category !== undefined && {
        category: data.category as EventCategory,
      }),
      ...(data.startDate !== undefined && {
        startDate: toUtcDate(data.startDate),
      }),
      ...(data.endDate !== undefined && {
        endDate: data.endDate ? toUtcDate(data.endDate) : null,
      }),
      ...(data.weekNumber !== undefined && { weekNumber: data.weekNumber }),
      ...(data.isHoliday !== undefined && { isHoliday: data.isHoliday }),
      ...(data.isAllDay !== undefined && { isAllDay: data.isAllDay }),
      ...(data.remarks !== undefined && { remarks: data.remarks }),
    },
  });

export const deleteCalendarEvent = (eventId: string) =>
  prisma.calendarEvent.delete({
    where: { id: eventId },
  });

export const findEventByIdAndCalendar = (eventId: string, calendarId: string) =>
  prisma.calendarEvent.findFirst({
    where: {
      id: eventId,
      calendarId,
    },
  });

export const findAllPublishedCalendarsForAdmin = (limit = 50) =>
  prisma.academicCalendar.findMany({
    where: {
      status: CalendarStatus.PUBLISHED,
      isActive: true,
    },
    include: {
      events: {
        orderBy: { startDate: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(50, Math.max(1, limit)),
  });

export const findVisibleCalendarSummaries = (
  orConditions?: Prisma.AcademicCalendarWhereInput[],
  isAdmin = false,
) => {
  if (!isAdmin && (!orConditions || orConditions.length === 0)) {
    return Promise.resolve([]);
  }
  return prisma.academicCalendar.findMany({
    where: {
      status: CalendarStatus.PUBLISHED,
      isActive: true,
      ...(isAdmin ? {} : { OR: orConditions }),
    },
    select: {
      id: true,
      status: true,
      isActive: true,
      targetFaculties: true,
      targetPrograms: true,
      targetBatch: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
};

export const findUpcomingEventsForCalendars = (
  calendarIds: string[],
  todayStart: Date,
  limit = 20,
) => {
  if (calendarIds.length === 0) return Promise.resolve([]);
  return prisma.calendarEvent.findMany({
    where: {
      calendarId: { in: calendarIds },
      OR: [
        { endDate: { gte: todayStart } },
        { endDate: null, startDate: { gte: todayStart } },
      ],
    },
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
    take: limit,
  });
};

export const replaceCalendarEventsTransaction = (
  calendarId: string,
  events: CsvEventRow[],
  userId?: string,
) =>
  prisma.$transaction(async (tx) => {
    await tx.calendarEvent.deleteMany({ where: { calendarId } });

    if (events.length > 0) {
      await tx.calendarEvent.createMany({
        data: events.map((ev) => ({
          calendarId,
          title: ev.title,
          description: ev.description || null,
          category: ev.category,
          startDate: toUtcDate(ev.startDate),
          endDate: ev.endDate ? toUtcDate(ev.endDate) : null,
          weekNumber: ev.weekNumber || null,
          isHoliday: ev.isHoliday,
          isAllDay: ev.isAllDay,
          remarks: ev.remarks || null,
        })),
      });
    }

    return tx.academicCalendar.update({
      where: { id: calendarId },
      data: { updatedBy: userId || null },
      include: {
        events: {
          orderBy: { startDate: "asc" },
        },
      },
    });
  });

export const findActiveCalendarsFiltered = (
  orConditions: Prisma.AcademicCalendarWhereInput[],
) => {
  if (orConditions.length === 0) {
    return Promise.resolve([]);
  }

  return prisma.academicCalendar.findMany({
    where: {
      status: "PUBLISHED",
      isActive: true,
      OR: orConditions,
    },
    include: {
      events: {
        orderBy: { startDate: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
};

/**
 * Clamps cloned calendar title within the 200-char Zod bound.
 */
export function formatClonedCalendarTitle(originalTitle: string): string {
  const copySuffix = " (Copy)";
  const maxBaseLen = 200 - copySuffix.length;
  return `${originalTitle.slice(0, maxBaseLen).trimEnd()}${copySuffix}`;
}

export const duplicateAcademicCalendar = async (
  calendarId: string,
  userId?: string,
) => {
  const original = await findCalendarById(calendarId);
  if (!original) return null;

  return prisma.academicCalendar.create({
    data: {
      title: formatClonedCalendarTitle(original.title),
      semester: original.semester,
      academicYear: original.academicYear,
      status: "DRAFT",
      isActive: true,
      targetFaculties: original.targetFaculties,
      targetPrograms: original.targetPrograms,
      semesterDuration: original.semesterDuration,
      targetBatch: original.targetBatch,
      createdBy: userId || null,
      events: {
        create: original.events.map((ev) => ({
          title: ev.title,
          description: ev.description,
          category: ev.category,
          startDate: ev.startDate,
          endDate: ev.endDate,
          weekNumber: ev.weekNumber,
          isHoliday: ev.isHoliday,
          isAllDay: ev.isAllDay,
          remarks: ev.remarks,
        })),
      },
    },
    include: {
      events: {
        orderBy: { startDate: "asc" },
      },
    },
  });
};
