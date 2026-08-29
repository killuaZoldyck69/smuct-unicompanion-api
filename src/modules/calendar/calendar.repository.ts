import { prisma } from "../../lib/prisma";
import {
  CalendarStatus,
  EventCategory,
} from "../../../generated/prisma/client";
import {
  CreateCalendarPayload,
  UpdateCalendarPayload,
  CalendarEventInput,
  UpdateCalendarEventInput,
} from "./calendar.schema";
import { CsvEventRow } from "./calendar.csv";

/**
 * Helper to convert YYYY-MM-DD or string to UTC midnight Date
 */
export function toUtcDate(dateStr: string | Date): Date {
  if (dateStr instanceof Date) return dateStr;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    return new Date(Date.UTC(year, month - 1, day));
  }
  return new Date(dateStr);
}

export const findUserWithAcademicProfiles = async (userId: string) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    include: {
      studentProfile: true,
      teacherProfile: true,
    },
  });
};

export const findAllCalendarsAdmin = async (statusFilter?: CalendarStatus) => {
  return await prisma.academicCalendar.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    include: {
      events: {
        orderBy: { startDate: "asc" },
      },
      _count: {
        select: { events: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const findCalendarById = async (id: string) => {
  return await prisma.academicCalendar.findUnique({
    where: { id },
    include: {
      events: {
        orderBy: { startDate: "asc" },
      },
    },
  });
};

export const createAcademicCalendar = async (
  data: CreateCalendarPayload,
  userId?: string,
) => {
  return await prisma.academicCalendar.create({
    data: {
      title: data.title,
      semester: data.semester,
      academicYear: data.academicYear || 2026,
      status: data.status || "DRAFT",
      isActive: true,
      isGlobal: data.isGlobal ?? false,
      targetFaculties: data.targetFaculties || [],
      targetDepartments: data.targetDepartments || [],
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
};

export const updateAcademicCalendar = async (
  id: string,
  data: UpdateCalendarPayload,
  userId?: string,
) => {
  return await prisma.academicCalendar.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.semester !== undefined && { semester: data.semester }),
      ...(data.academicYear !== undefined && { academicYear: data.academicYear }),
      ...(data.isGlobal !== undefined && { isGlobal: data.isGlobal }),
      ...(data.targetFaculties !== undefined && {
        targetFaculties: data.targetFaculties,
      }),
      ...(data.targetDepartments !== undefined && {
        targetDepartments: data.targetDepartments,
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
};

export const updateCalendarStatus = async (
  id: string,
  status: CalendarStatus,
  userId?: string,
) => {
  const isPublished = status === "PUBLISHED";
  return await prisma.academicCalendar.update({
    where: { id },
    data: {
      status,
      ...(isPublished && { publishedAt: new Date() }),
      updatedBy: userId || null,
    },
    include: {
      events: {
        orderBy: { startDate: "asc" },
      },
    },
  });
};

export const deleteAcademicCalendar = async (id: string) => {
  return await prisma.academicCalendar.delete({
    where: { id },
  });
};

export const createCalendarEvent = async (
  calendarId: string,
  event: CalendarEventInput,
) => {
  return await prisma.calendarEvent.create({
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
};

export const updateCalendarEvent = async (
  eventId: string,
  data: UpdateCalendarEventInput,
) => {
  return await prisma.calendarEvent.update({
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
};

export const deleteCalendarEvent = async (eventId: string) => {
  return await prisma.calendarEvent.delete({
    where: { id: eventId },
  });
};

/**
 * Atomically replaces all events in a calendar using a database transaction.
 */
export const replaceCalendarEventsTransaction = async (
  calendarId: string,
  events: CsvEventRow[],
  userId?: string,
) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Delete all existing events in this calendar
    await tx.calendarEvent.deleteMany({
      where: { calendarId },
    });

    // 2. Insert new validated events
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

    // 3. Touch calendar updated timestamp & user
    return await tx.academicCalendar.update({
      where: { id: calendarId },
      data: {
        updatedBy: userId || null,
      },
      include: {
        events: {
          orderBy: { startDate: "asc" },
        },
      },
    });
  });
};

/**
 * Finds published calendars filtered by user audience conditions.
 */
export const findActiveCalendarsFiltered = async (orConditions: any[]) => {
  return await prisma.academicCalendar.findMany({
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
  });
};

/**
 * Finds the latest published calendar for a user audience.
 */
export const findCurrentPublishedCalendar = async (orConditions: any[]) => {
  return await prisma.academicCalendar.findFirst({
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
  });
};

/**
 * Duplicates an existing academic calendar into a new DRAFT calendar.
 */
export const duplicateAcademicCalendar = async (
  calendarId: string,
  userId?: string,
) => {
  const original = await prisma.academicCalendar.findUnique({
    where: { id: calendarId },
    include: {
      events: {
        orderBy: { startDate: "asc" },
      },
    },
  });

  if (!original) return null;

  return await prisma.academicCalendar.create({
    data: {
      title: `${original.title} (Copy)`,
      semester: `${original.semester} (Copy)`,
      academicYear: original.academicYear,
      status: "DRAFT",
      isActive: true,
      isGlobal: original.isGlobal,
      targetFaculties: original.targetFaculties,
      targetDepartments: original.targetDepartments,
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
