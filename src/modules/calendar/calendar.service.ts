import { AppError } from "../../utils/AppError";
import * as calendarRepository from "./calendar.repository";
import {
  CreateCalendarPayload,
  UpdateCalendarPayload,
  CalendarEventInput,
  UpdateCalendarEventInput,
} from "./calendar.schema";
import {
  validateAndParseCsv,
  generateCsvFromEvents,
  generateCsvTemplate,
  CsvValidationResult,
} from "./calendar.csv";
import { CalendarStatus } from "../../../generated/prisma/client";

/**
 * Admin: List all calendars with optional status filter
 */
export const getAdminCalendarsService = async (status?: CalendarStatus) => {
  return await calendarRepository.findAllCalendarsAdmin(status);
};

/**
 * Admin or Student: Get specific calendar details by ID
 */
export const getCalendarByIdService = async (id: string, user: any) => {
  const calendar = await calendarRepository.findCalendarById(id);
  if (!calendar) {
    throw new AppError("Academic calendar not found.", 404);
  }

  // Non-admin can only view PUBLISHED calendars
  if (user.role !== "ADMIN" && calendar.status !== "PUBLISHED") {
    throw new AppError(
      "Access denied. This calendar is currently in draft mode.",
      403,
    );
  }

  return calendar;
};

/**
 * Admin: Create a new calendar (defaults to DRAFT)
 */
export const createCalendarService = async (
  data: CreateCalendarPayload,
  userId: string,
) => {
  return await calendarRepository.createAcademicCalendar(data, userId);
};

/**
 * Admin: Update calendar metadata
 */
export const updateCalendarService = async (
  id: string,
  data: UpdateCalendarPayload,
  userId: string,
) => {
  const existing = await calendarRepository.findCalendarById(id);
  if (!existing) {
    throw new AppError("Academic calendar not found.", 404);
  }
  return await calendarRepository.updateAcademicCalendar(id, data, userId);
};

/**
 * Admin: Update calendar status (DRAFT / PUBLISHED / ARCHIVED)
 */
export const updateCalendarStatusService = async (
  id: string,
  status: CalendarStatus,
  userId: string,
) => {
  const existing = await calendarRepository.findCalendarById(id);
  if (!existing) {
    throw new AppError("Academic calendar not found.", 404);
  }

  if (status === "PUBLISHED" && (!existing.events || existing.events.length === 0)) {
    throw new AppError(
      "Cannot publish an academic calendar without any events. Please import or add events first.",
      400,
    );
  }

  return await calendarRepository.updateCalendarStatus(id, status, userId);
};

/**
 * Admin: Duplicate existing calendar into a new DRAFT
 */
export const duplicateCalendarService = async (
  calendarId: string,
  userId: string,
) => {
  const existing = await calendarRepository.findCalendarById(calendarId);
  if (!existing) {
    throw new AppError("Source academic calendar not found.", 404);
  }
  return await calendarRepository.duplicateAcademicCalendar(calendarId, userId);
};

/**
 * Admin: Delete calendar
 */
export const deleteCalendarService = async (id: string) => {
  const existing = await calendarRepository.findCalendarById(id);
  if (!existing) {
    throw new AppError("Academic calendar not found.", 404);
  }
  return await calendarRepository.deleteAcademicCalendar(id);
};

/**
 * Admin: Add single event manually
 */
export const addEventService = async (
  calendarId: string,
  eventData: CalendarEventInput,
) => {
  const calendar = await calendarRepository.findCalendarById(calendarId);
  if (!calendar) {
    throw new AppError("Academic calendar not found.", 404);
  }
  return await calendarRepository.createCalendarEvent(calendarId, eventData);
};

/**
 * Admin: Update single event manually
 */
export const updateEventService = async (
  calendarId: string,
  eventId: string,
  eventData: UpdateCalendarEventInput,
) => {
  const calendar = await calendarRepository.findCalendarById(calendarId);
  if (!calendar) {
    throw new AppError("Academic calendar not found.", 404);
  }
  const event = calendar.events.find((e) => e.id === eventId);
  if (!event) {
    throw new AppError("Event not found in this calendar.", 404);
  }
  return await calendarRepository.updateCalendarEvent(eventId, eventData);
};

/**
 * Admin: Delete single event
 */
export const deleteEventService = async (
  calendarId: string,
  eventId: string,
) => {
  const calendar = await calendarRepository.findCalendarById(calendarId);
  if (!calendar) {
    throw new AppError("Academic calendar not found.", 404);
  }
  const event = calendar.events.find((e) => e.id === eventId);
  if (!event) {
    throw new AppError("Event not found in this calendar.", 404);
  }
  return await calendarRepository.deleteCalendarEvent(eventId);
};

/**
 * Admin: Dry-run CSV validation with error report & diff
 */
export const validateCsvService = async (
  csvContent: string,
  calendarId?: string,
): Promise<CsvValidationResult> => {
  let existingEvents: any[] | undefined = undefined;

  if (calendarId) {
    const calendar = await calendarRepository.findCalendarById(calendarId);
    if (calendar) {
      existingEvents = calendar.events;
    }
  }

  return validateAndParseCsv(csvContent, existingEvents);
};

/**
 * Admin: Import CSV into a DRAFT or existing calendar (atomic transaction)
 */
export const importCsvService = async (
  calendarId: string,
  csvContent: string,
  userId: string,
) => {
  const calendar = await calendarRepository.findCalendarById(calendarId);
  if (!calendar) {
    throw new AppError("Academic calendar not found.", 404);
  }

  // Validate CSV
  const validation = validateAndParseCsv(csvContent, calendar.events);
  if (!validation.isValid) {
    const firstError = validation.errors[0];
    throw new AppError(
      `CSV validation failed at Row ${firstError.rowNumber} (${firstError.field}): ${firstError.message}`,
      422,
    );
  }

  // Execute database transaction
  const updatedCalendar =
    await calendarRepository.replaceCalendarEventsTransaction(
      calendarId,
      validation.parsedEvents,
      userId,
    );

  return {
    calendar: updatedCalendar,
    importedCount: validation.parsedEvents.length,
    warnings: validation.warnings,
  };
};

/**
 * Admin: Export calendar events to RFC 4180 CSV
 */
export const exportCsvService = async (calendarId: string) => {
  const calendar = await calendarRepository.findCalendarById(calendarId);
  if (!calendar) {
    throw new AppError("Academic calendar not found.", 404);
  }
  return generateCsvFromEvents(calendar.events);
};

/**
 * Admin: Download standardized CSV template
 */
export const getCsvTemplateService = () => {
  return generateCsvTemplate();
};

/**
 * Student / Teacher: Build audience conditions based on user profile
 */
const buildUserAudienceConditions = async (userId: string) => {
  const user = await calendarRepository.findUserWithAcademicProfiles(userId);
  if (!user) {
    throw new AppError("User account not found.", 404);
  }

  let userFaculty: string | null = null;
  let userDepartment: string | null = null;

  if (user.studentProfile) {
    userFaculty = user.studentProfile.faculty || null;
    userDepartment = user.studentProfile.department;
  } else if (user.teacherProfile) {
    userFaculty = user.teacherProfile.faculty || null;
    userDepartment = user.teacherProfile.department;
  }

  const orConditions: any[] = [{ isGlobal: true }];

  if (userFaculty) {
    orConditions.push({ targetFaculties: { has: userFaculty } });
    orConditions.push({ targetFaculties: { has: userFaculty.toUpperCase() } });
  }

  if (userDepartment) {
    orConditions.push({ targetDepartments: { has: userDepartment } });
    orConditions.push({
      targetDepartments: { has: userDepartment.toUpperCase() },
    });
  }

  return { user, orConditions };
};

/**
 * Student / Teacher: Get relevant active published calendars
 */
export const getRelevantCalendarsService = async (userId: string) => {
  const { user, orConditions } = await buildUserAudienceConditions(userId);

  if (user.role === "ADMIN") {
    return await calendarRepository.findAllCalendarsAdmin();
  }

  return await calendarRepository.findActiveCalendarsFiltered(orConditions);
};

/**
 * Student: Get the current primary published calendar
 */
export const getCurrentPublishedCalendarService = async (userId: string) => {
  const { user, orConditions } = await buildUserAudienceConditions(userId);

  if (user.role === "ADMIN") {
    const adminCalendars = await calendarRepository.findAllCalendarsAdmin();
    return (
      adminCalendars.find((c) => c.status === "PUBLISHED") ||
      adminCalendars[0] ||
      null
    );
  }

  const current =
    await calendarRepository.findCurrentPublishedCalendar(orConditions);
  if (!current) {
    throw new AppError(
      "No published academic calendar found for your department.",
      404,
    );
  }

  return current;
};

/**
 * Student: Get upcoming published events
 */
export const getUpcomingEventsService = async (userId: string) => {
  const { user, orConditions } = await buildUserAudienceConditions(userId);

  const calendars =
    user.role === "ADMIN"
      ? await calendarRepository.findAllCalendarsAdmin()
      : await calendarRepository.findActiveCalendarsFiltered(orConditions);

  const activeCalendar = calendars[0];
  if (!activeCalendar) {
    return [];
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return activeCalendar.events.filter((ev) => {
    const targetDate = ev.endDate ? new Date(ev.endDate) : new Date(ev.startDate);
    targetDate.setUTCHours(23, 59, 59, 999);
    return targetDate >= today;
  });
};
