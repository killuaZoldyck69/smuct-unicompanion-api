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

  // Non-admin can only view PUBLISHED calendars and must match audience
  if (user.role !== "ADMIN") {
    if (calendar.status !== "PUBLISHED") {
      throw new AppError(
        "Access denied. This calendar is currently in draft mode.",
        403,
      );
    }

    const fullUser = await calendarRepository.findUserWithAcademicProfiles(user.id);
    if (!fullUser || !isCalendarVisibleToUser(calendar, fullUser)) {
      throw new AppError(
        "Access denied. This academic calendar is not available for your program or batch.",
        403,
      );
    }
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
  const hasBatch = Boolean(data.targetBatch && data.targetBatch.trim().length > 0);
  if (hasBatch && (!data.targetPrograms || data.targetPrograms.length === 0)) {
    throw new AppError(
      "A calendar with a targeted batch must specify at least one targeted program.",
      400,
    );
  }
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

  const effectiveBatch =
    data.targetBatch !== undefined ? data.targetBatch : existing.targetBatch;
  const effectivePrograms =
    data.targetPrograms !== undefined ? data.targetPrograms : existing.targetPrograms;

  const hasBatch = Boolean(effectiveBatch && effectiveBatch.trim().length > 0);
  if (hasBatch && (!effectivePrograms || effectivePrograms.length === 0)) {
    throw new AppError(
      "A calendar with a targeted batch must specify at least one targeted program.",
      400,
    );
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
 * Normalizes a batch identifier for reliable comparison.
 * Trims whitespace, removes non-essential prefixes like "batch", "intake", "cohort", or "#",
 * and returns the lowercase trimmed token.
 * Examples:
 *   "Batch 22" -> "22"
 *   "batch-64" -> "64"
 *   " 22 "     -> "22"
 *   "64th"     -> "64th"
 */
export const normalizeBatch = (raw?: string | null): string => {
  if (!raw) return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/^(batch|intake|cohort)\s*[-:#]?\s*/i, "")
    .replace(/\s*(batch|intake|cohort)\s*$/i, "")
    .trim();
};

/**
 * Pure visibility and authorization predicate.
 * Enforces audience targeting rules:
 * - ADMIN: Sees everything.
 * - Non-admin: Only PUBLISHED & active calendars.
 * - Calendar with targetBatch:
 *     MUST match student's target program AND student's target batch.
 *     No other batches of that program are allowed to see it.
 * - Calendar without targetBatch (null or empty):
 *     Shown to all students of the targeted department / program / faculty / global.
 */
export const isCalendarVisibleToUser = (
  calendar: {
    status: string;
    isActive: boolean;
    targetFaculties: string[];
    targetPrograms: string[];
    targetBatch?: string | null;
  },
  user: {
    role: string;
    studentProfile?: {
      faculty?: string | null;
      department?: string | null;
      program?: string | null;
      batch?: string | null;
    } | null;
    teacherProfile?: {
      faculty?: string | null;
      department?: string | null;
      advisoryBatch?: number | null;
    } | null;
  },
): boolean => {
  // 1. Admins have unrestricted access
  if (user.role === "ADMIN") {
    return true;
  }

  // 2. Non-admins can only see active and published calendars
  if (calendar.status !== "PUBLISHED" || !calendar.isActive) {
    return false;
  }

  const rawCalendarBatch = calendar.targetBatch?.trim() || "";
  const hasTargetBatch = rawCalendarBatch.length > 0;
  const normCalendarBatch = normalizeBatch(rawCalendarBatch);

  const targetProgramsLower = (calendar.targetPrograms || []).map((p) =>
    p.trim().toLowerCase(),
  );
  const targetFacultiesLower = (calendar.targetFaculties || []).map((f) =>
    f.trim().toLowerCase(),
  );
  const isGlobal =
    targetProgramsLower.length === 0 && targetFacultiesLower.length === 0;

  // 3. Student resolution
  if (user.studentProfile) {
    const student = user.studentProfile;
    const studentProgram = student.program?.trim().toLowerCase();
    const studentDepartment = student.department?.trim().toLowerCase();
    const studentFaculty = student.faculty?.trim().toLowerCase();
    const rawStudentBatch = student.batch?.trim() || "";
    const normStudentBatch = normalizeBatch(rawStudentBatch);

    const matchesProgram =
      (Boolean(studentProgram) && targetProgramsLower.includes(studentProgram!)) ||
      (Boolean(studentDepartment) && targetProgramsLower.includes(studentDepartment!));

    const matchesFaculty =
      Boolean(studentFaculty) && targetFacultiesLower.includes(studentFaculty!);

    // CONSTRAINT 1: If calendar has a targetBatch
    // Must match targeted program AND match targeted batch
    if (hasTargetBatch) {
      if (!matchesProgram) {
        return false;
      }

      const matchesBatch =
        Boolean(normStudentBatch && normCalendarBatch && normStudentBatch === normCalendarBatch) ||
        rawStudentBatch.toLowerCase() === rawCalendarBatch.toLowerCase();

      return matchesBatch;
    }

    // CONSTRAINT 2: If calendar DOES NOT have a targetBatch
    // Show to all students of the targeted department / program / faculty / global
    return Boolean(matchesProgram || matchesFaculty || isGlobal);
  }

  // 4. Teacher resolution
  if (user.teacherProfile) {
    const teacher = user.teacherProfile;
    const teacherDept = teacher.department?.trim().toLowerCase();
    const teacherFaculty = teacher.faculty?.trim().toLowerCase();

    const matchesDept =
      Boolean(teacherDept) && targetProgramsLower.includes(teacherDept!);
    const matchesFaculty =
      Boolean(teacherFaculty) && targetFacultiesLower.includes(teacherFaculty!);

    if (hasTargetBatch) {
      if (teacher.advisoryBatch) {
        const normAdvisory = normalizeBatch(String(teacher.advisoryBatch));
        if (normAdvisory && normAdvisory === normCalendarBatch) {
          return Boolean(matchesDept || matchesFaculty || isGlobal);
        }
      }
      return false;
    }

    return Boolean(matchesDept || matchesFaculty || isGlobal);
  }

  return false;
};

/**
 * Student / Teacher: Build audience conditions based on user profile
 */
export const buildUserAudienceConditions = async (userId: string) => {
  const user = await calendarRepository.findUserWithAcademicProfiles(userId);
  if (!user) {
    throw new AppError("User account not found.", 404);
  }

  if (user.role === "ADMIN") {
    return { user, orConditions: [] };
  }

  let userFaculty: string | null = null;
  let userDepartment: string | null = null;
  let userProgram: string | null = null;
  let userBatch: string | null = null;

  if (user.studentProfile) {
    userFaculty = user.studentProfile.faculty || null;
    userDepartment = user.studentProfile.department;
    userProgram = user.studentProfile.program || null;
    userBatch = user.studentProfile.batch || null;
  } else if (user.teacherProfile) {
    userFaculty = user.teacherProfile.faculty || null;
    userDepartment = user.teacherProfile.department;
  }

  const candidatePrograms = Array.from(
    new Set([userProgram, userDepartment].filter(Boolean)),
  ) as string[];

  const orConditions: any[] = [];

  // 1. Batch-specific calendars (ONLY for students with a batch and candidate program)
  if (user.studentProfile && userBatch && candidatePrograms.length > 0) {
    const rawBatch = userBatch.trim();
    const normBatch = normalizeBatch(rawBatch);
    const batchValues = Array.from(
      new Set(
        [
          rawBatch,
          normBatch,
          `Batch ${normBatch}`,
          `Batch-${normBatch}`,
          `Batch ${rawBatch}`,
        ].filter(Boolean),
      ),
    );

    orConditions.push({
      AND: [
        { targetBatch: { not: null } },
        { targetBatch: { not: "" } },
        {
          OR: batchValues.map((b) => ({
            targetBatch: { equals: b, mode: "insensitive" as const },
          })),
        },
        {
          OR: candidatePrograms.map((p) => ({
            targetPrograms: { has: p },
          })),
        },
      ],
    });
  }

  // Teacher advisory batch calendars
  if (user.teacherProfile && user.teacherProfile.advisoryBatch) {
    const advisory = String(user.teacherProfile.advisoryBatch);
    const normAdvisory = normalizeBatch(advisory);
    const batchValues = Array.from(
      new Set([advisory, normAdvisory, `Batch ${normAdvisory}`].filter(Boolean)),
    );

    orConditions.push({
      AND: [
        { targetBatch: { not: null } },
        { targetBatch: { not: "" } },
        {
          OR: batchValues.map((b) => ({
            targetBatch: { equals: b, mode: "insensitive" as const },
          })),
        },
        ...(userDepartment ? [{ targetPrograms: { has: userDepartment } }] : []),
      ],
    });
  }

  // 2. Department / Program / Faculty / Global calendars WITHOUT any targeted batch
  // Shown to all students of the targeted department / program
  const nonBatchAudience: any[] = [
    // Universal / Global
    {
      AND: [
        { targetFaculties: { equals: [] } },
        { targetPrograms: { equals: [] } },
      ],
    },
  ];

  if (candidatePrograms.length > 0) {
    candidatePrograms.forEach((prog) => {
      nonBatchAudience.push({ targetPrograms: { has: prog } });
    });
  }

  if (userFaculty) {
    nonBatchAudience.push({ targetFaculties: { has: userFaculty } });
    nonBatchAudience.push({ targetFaculties: { has: userFaculty.toUpperCase() } });
  }

  orConditions.push({
    AND: [
      {
        OR: [{ targetBatch: null }, { targetBatch: "" }],
      },
      {
        OR: nonBatchAudience,
      },
    ],
  });

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

  const raw = await calendarRepository.findActiveCalendarsFiltered(orConditions);
  return raw.filter((c) => isCalendarVisibleToUser(c, user));
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

  const raw = await calendarRepository.findActiveCalendarsFiltered(orConditions);
  const visible = raw.filter((c) => isCalendarVisibleToUser(c, user));

  if (visible.length === 0) {
    throw new AppError(
      "No published academic calendar found for your program or batch.",
      404,
    );
  }

  // Prioritize batch-specific calendar if one matches, else latest published
  const sorted = [...visible].sort((a, b) => {
    const aHasBatch = Boolean(a.targetBatch && a.targetBatch.trim().length > 0);
    const bHasBatch = Boolean(b.targetBatch && b.targetBatch.trim().length > 0);
    if (aHasBatch && !bHasBatch) return -1;
    if (!aHasBatch && bHasBatch) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return sorted[0];
};

/**
 * Student: Get upcoming published events
 */
export const getUpcomingEventsService = async (userId: string) => {
  const { user, orConditions } = await buildUserAudienceConditions(userId);

  let activeCalendar: any = null;
  if (user.role === "ADMIN") {
    const adminCalendars = await calendarRepository.findAllCalendarsAdmin();
    activeCalendar =
      adminCalendars.find((c) => c.status === "PUBLISHED") ||
      adminCalendars[0] ||
      null;
  } else {
    const raw = await calendarRepository.findActiveCalendarsFiltered(orConditions);
    const visible = raw.filter((c) => isCalendarVisibleToUser(c, user));
    const sorted = [...visible].sort((a, b) => {
      const aHasBatch = Boolean(a.targetBatch && a.targetBatch.trim().length > 0);
      const bHasBatch = Boolean(b.targetBatch && b.targetBatch.trim().length > 0);
      if (aHasBatch && !bHasBatch) return -1;
      if (!aHasBatch && bHasBatch) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    activeCalendar = sorted[0] || null;
  }

  if (!activeCalendar) {
    return [];
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return activeCalendar.events.filter((ev: any) => {
    const targetDate = ev.endDate ? new Date(ev.endDate) : new Date(ev.startDate);
    targetDate.setUTCHours(23, 59, 59, 999);
    return targetDate >= today;
  });
};
