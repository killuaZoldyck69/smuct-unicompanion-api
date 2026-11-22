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
  CsvValidationResult,
  ExistingCalendarEventSnapshot,
} from "./calendar.csv";
import { CalendarStatus, Prisma } from "../../../generated/prisma/client";
import {
  SMUCT_FACULTY_ALIASES,
  SMUCT_PROGRAM_CATALOG,
} from "../../constants/smuct-catalog";

export const normalizePagination = (
  page?: number | string,
  limit?: number | string,
) => {
  const pageNumber = Number(page ?? 1);
  const limitNumber = Number(limit ?? 25);

  return {
    page: Number.isFinite(pageNumber) && pageNumber > 0 ? Math.floor(pageNumber) : 1,
    limit:
      Number.isFinite(limitNumber) && limitNumber > 0
        ? Math.min(50, Math.floor(limitNumber))
        : 25,
  };
};

const normalizeAudienceValue = (value?: string | null): string =>
  value?.trim().toLowerCase() ?? "";

const addCaseVariants = (set: Set<string>, value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return;
  set.add(trimmed);
  set.add(trimmed.toLowerCase());
};

export const expandFacultyAliases = (raw?: string | null): string[] => {
  const trimmed = raw?.trim();
  if (!trimmed) return [];

  const lower = trimmed.toLowerCase();
  const terms = new Set<string>([trimmed, lower, trimmed.toUpperCase()]);

  for (const aliases of Object.values(SMUCT_FACULTY_ALIASES)) {
    if (aliases.some((alias) => alias.toLowerCase() === lower)) {
      aliases.forEach((alias) => addCaseVariants(terms, alias));
    }
  }

  return Array.from(terms);
};

export const expandProgramAliases = (
  raw?: string | null,
  expandDepartmentPrograms = false,
  includeDepartmentOnProgramMatch = true,
): string[] => {
  const trimmed = raw?.trim();
  if (!trimmed) return [];

  const lower = trimmed.toLowerCase();
  const terms = new Set<string>([trimmed, lower, trimmed.toUpperCase()]);

  for (const dept of SMUCT_PROGRAM_CATALOG) {
    const matchedProg = dept.programs.find(
      (prog) =>
        prog.name.toLowerCase() === lower || prog.shortName.toLowerCase() === lower,
    );

    if (matchedProg) {
      addCaseVariants(terms, matchedProg.name);
      addCaseVariants(terms, matchedProg.shortName);
      if (includeDepartmentOnProgramMatch) {
        addCaseVariants(terms, dept.deptCode);
        addCaseVariants(terms, dept.deptFull);
        dept.deptAliases?.forEach((alias) => addCaseVariants(terms, alias));
      } else {
        continue;
      }
    }

    const matchedDept =
      dept.deptCode.toLowerCase() === lower ||
      dept.deptFull.toLowerCase() === lower ||
      (dept.deptAliases?.some((alias) => alias.toLowerCase() === lower) ?? false);

    if (matchedDept) {
      addCaseVariants(terms, dept.deptCode);
      addCaseVariants(terms, dept.deptFull);
      dept.deptAliases?.forEach((alias) => addCaseVariants(terms, alias));
      if (expandDepartmentPrograms) {
        dept.programs.forEach((prog) => {
          addCaseVariants(terms, prog.name);
          addCaseVariants(terms, prog.shortName);
        });
      }
    }
  }

  return Array.from(terms);
};

export const resolveUserAudienceTokens = (user: {
  studentProfile?: {
    faculty?: string | null;
    department?: string | null;
    program?: string | null;
  } | null;
  teacherProfile?: {
    faculty?: string | null;
    department?: string | null;
  } | null;
}) => {
  const programTokens = new Set<string>();
  const facultyTokens = new Set<string>();

  if (user.studentProfile) {
    const hasSpecificProgram = Boolean(user.studentProfile.program?.trim());
    expandProgramAliases(user.studentProfile.program, true).forEach((t) => programTokens.add(t));
    expandProgramAliases(user.studentProfile.department, !hasSpecificProgram).forEach((t) =>
      programTokens.add(t),
    );
    expandFacultyAliases(user.studentProfile.faculty).forEach((t) => facultyTokens.add(t));
  } else if (user.teacherProfile) {
    expandProgramAliases(user.teacherProfile.department, true).forEach((t) => programTokens.add(t));
    expandFacultyAliases(user.teacherProfile.faculty).forEach((t) => facultyTokens.add(t));
  }

  return {
    programTokens: Array.from(programTokens),
    facultyTokens: Array.from(facultyTokens),
  };
};

const assertBatchHasProgram = (
  targetBatch?: string | null,
  targetPrograms?: string[] | null,
) => {
  const hasBatch = Boolean(targetBatch && targetBatch.trim().length > 0);
  if (hasBatch && (!targetPrograms || targetPrograms.length === 0)) {
    throw new AppError(
      "A calendar with a targeted batch must specify at least one targeted program.",
      400,
    );
  }
};

export const getAdminCalendarsService = (
  status?: CalendarStatus,
  pagination?: { page?: number | string; limit?: number | string },
) => {
  const options = normalizePagination(pagination?.page, pagination?.limit);
  return calendarRepository.findAllCalendarsAdmin(status, options);
};

export const getCalendarByIdService = async (
  id: string,
  user: { id: string; role: string },
) => {
  const calendar = await calendarRepository.findCalendarById(id);
  if (!calendar) {
    throw new AppError("Academic calendar not found.", 404);
  }
  if (user.role === "ADMIN") {
    return calendar;
  }

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

  return calendar;
};

export const createCalendarService = async (
  data: CreateCalendarPayload,
  userId: string,
) => {
  if (data.status === "PUBLISHED" && (!data.events || data.events.length === 0)) {
    throw new AppError(
      "Cannot publish an academic calendar without any events. Please import or add events first.",
      400,
    );
  }
  assertBatchHasProgram(data.targetBatch, data.targetPrograms);
  return calendarRepository.createAcademicCalendar(data, userId);
};

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

  assertBatchHasProgram(effectiveBatch, effectivePrograms);
  return calendarRepository.updateAcademicCalendar(id, data, userId);
};

export const updateCalendarStatusService = async (
  id: string,
  status: CalendarStatus,
  userId: string,
) => {
  const existing = await calendarRepository.findCalendarById(id);
  if (!existing) {
    throw new AppError("Academic calendar not found.", 404);
  }

  if (status === "PUBLISHED" && existing.events.length === 0) {
    throw new AppError(
      "Cannot publish an academic calendar without any events. Please import or add events first.",
      400,
    );
  }

  return calendarRepository.updateCalendarStatus(id, status, userId);
};

export const duplicateCalendarService = async (
  calendarId: string,
  userId: string,
) => {
  const existing = await calendarRepository.findCalendarById(calendarId);
  if (!existing) {
    throw new AppError("Source academic calendar not found.", 404);
  }
  return calendarRepository.duplicateAcademicCalendar(calendarId, userId);
};

export const deleteCalendarService = async (id: string) => {
  const existing = await calendarRepository.findCalendarById(id);
  if (!existing) {
    throw new AppError("Academic calendar not found.", 404);
  }
  return calendarRepository.deleteAcademicCalendar(id);
};

export const addEventService = async (
  calendarId: string,
  eventData: CalendarEventInput,
) => {
  const calendar = await calendarRepository.findCalendarById(calendarId);
  if (!calendar) {
    throw new AppError("Academic calendar not found.", 404);
  }
  return calendarRepository.createCalendarEvent(calendarId, eventData);
};

export const updateEventService = async (
  calendarId: string,
  eventId: string,
  eventData: UpdateCalendarEventInput,
) => {
  const event = await calendarRepository.findEventByIdAndCalendar(eventId, calendarId);
  if (!event) {
    const calendar = await calendarRepository.findCalendarById(calendarId);
    throw new AppError(
      calendar ? "Event not found in this calendar." : "Academic calendar not found.",
      404,
    );
  }

  const effectiveStart =
    eventData.startDate !== undefined
      ? calendarRepository.toUtcDate(eventData.startDate)
      : event.startDate;
  const effectiveEnd =
    eventData.endDate !== undefined
      ? eventData.endDate
        ? calendarRepository.toUtcDate(eventData.endDate)
        : null
      : event.endDate;

  if (effectiveEnd && effectiveEnd.getTime() < effectiveStart.getTime()) {
    throw new AppError("Event endDate cannot be earlier than startDate.", 400);
  }

  return calendarRepository.updateCalendarEvent(eventId, eventData);
};

export const deleteEventService = async (
  calendarId: string,
  eventId: string,
) => {
  const event = await calendarRepository.findEventByIdAndCalendar(eventId, calendarId);
  if (!event) {
    const calendar = await calendarRepository.findCalendarById(calendarId);
    throw new AppError(
      calendar ? "Event not found in this calendar." : "Academic calendar not found.",
      404,
    );
  }
  return calendarRepository.deleteCalendarEvent(eventId);
};

export const validateCsvService = async (
  csvContent: string,
  calendarId?: string,
): Promise<CsvValidationResult> => {
  let existingEvents: ExistingCalendarEventSnapshot[] | undefined;

  if (calendarId) {
    const calendar = await calendarRepository.findCalendarById(calendarId);
    if (calendar) {
      existingEvents = calendar.events;
    }
  }

  return validateAndParseCsv(csvContent, existingEvents);
};

export const importCsvService = async (
  calendarId: string,
  csvContent: string,
  userId: string,
) => {
  const calendar = await calendarRepository.findCalendarById(calendarId);
  if (!calendar) {
    throw new AppError("Academic calendar not found.", 404);
  }

  const validation = validateAndParseCsv(csvContent, calendar.events);
  if (!validation.isValid) {
    const firstError = validation.errors[0];
    throw new AppError(
      `CSV validation failed at Row ${firstError.rowNumber} (${firstError.field}): ${firstError.message}`,
      422,
    );
  }

  const updatedCalendar = await calendarRepository.replaceCalendarEventsTransaction(
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

export const exportCsvService = async (calendarId: string) => {
  const calendar = await calendarRepository.findCalendarById(calendarId);
  if (!calendar) {
    throw new AppError("Academic calendar not found.", 404);
  }
  return generateCsvFromEvents(calendar.events);
};

/**
 * Normalizes a batch label ("Batch 22", "batch-64") down to the lowercase token ("22", "64").
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

export const isCalendarVisibleToUser = (
  calendar: {
    status: CalendarStatus | string;
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
  if (user.role === "ADMIN") return true;
  if (calendar.status !== "PUBLISHED" || !calendar.isActive) return false;

  const rawCalendarBatch = calendar.targetBatch?.trim() || "";
  const hasTargetBatch = rawCalendarBatch.length > 0;
  const normCalendarBatch = normalizeBatch(rawCalendarBatch);

  const targetPrograms = (calendar.targetPrograms || [])
    .map(normalizeAudienceValue)
    .filter(Boolean);
  const targetFaculties = (calendar.targetFaculties || [])
    .map(normalizeAudienceValue)
    .filter(Boolean);
  const isGlobal = targetPrograms.length === 0 && targetFaculties.length === 0;

  const { programTokens, facultyTokens } = resolveUserAudienceTokens(user);
  const userProgramSet = new Set(programTokens.map(normalizeAudienceValue));
  const userFacultySet = new Set(facultyTokens.map(normalizeAudienceValue));

  const matchesProgram = targetPrograms.some(
    (tp) =>
      userProgramSet.has(tp) ||
      expandProgramAliases(tp, true, false).some((alias) =>
        userProgramSet.has(normalizeAudienceValue(alias)),
      ),
  );
  const matchesFaculty = targetFaculties.some(
    (tf) =>
      userFacultySet.has(tf) ||
      expandFacultyAliases(tf).some((alias) =>
        userFacultySet.has(normalizeAudienceValue(alias)),
      ),
  );

  if (user.studentProfile) {
    if (hasTargetBatch) {
      if (!matchesProgram) return false;
      const rawStudentBatch = user.studentProfile.batch?.trim() || "";
      const normStudentBatch = normalizeBatch(rawStudentBatch);
      return (
        Boolean(normStudentBatch && normCalendarBatch && normStudentBatch === normCalendarBatch) ||
        normalizeAudienceValue(rawStudentBatch) === normalizeAudienceValue(rawCalendarBatch)
      );
    }
    return matchesProgram || matchesFaculty || isGlobal;
  }

  if (user.teacherProfile) {
    if (hasTargetBatch) {
      if (!user.teacherProfile.advisoryBatch) return false;
      const normAdvisory = normalizeBatch(String(user.teacherProfile.advisoryBatch));
      if (!normAdvisory || normAdvisory !== normCalendarBatch) return false;
      return matchesProgram || matchesFaculty || isGlobal;
    }
    return matchesProgram || matchesFaculty || isGlobal;
  }

  return false;
};

const buildBatchEqualsOr = (
  rawInput: string,
  includeSpacedRaw = false,
): Prisma.AcademicCalendarWhereInput[] => {
  const raw = rawInput.trim();
  const norm = normalizeBatch(raw);
  const values = Array.from(
    new Set(
      [
        raw,
        norm,
        `Batch ${norm}`,
        `Batch-${norm}`,
        ...(includeSpacedRaw ? [`Batch ${raw}`] : []),
      ].filter(Boolean),
    ),
  );
  return values.map((b) => ({
    targetBatch: { equals: b, mode: "insensitive" as const },
  }));
};

export const buildUserAudienceConditions = async (userId: string) => {
  const user = await calendarRepository.findUserWithAcademicProfiles(userId);
  if (!user) {
    throw new AppError("User account not found.", 404);
  }

  if (user.role === "ADMIN") {
    return { user, orConditions: [] as Prisma.AcademicCalendarWhereInput[] };
  }

  const userBatch = user.studentProfile?.batch || null;
  const { programTokens, facultyTokens } = resolveUserAudienceTokens(user);
  const orConditions: Prisma.AcademicCalendarWhereInput[] = [];

  if (user.studentProfile && userBatch && programTokens.length > 0) {
    orConditions.push({
      AND: [
        { targetBatch: { not: null } },
        { targetBatch: { not: "" } },
        { OR: buildBatchEqualsOr(userBatch, true) },
        { targetPrograms: { hasSome: programTokens } },
      ],
    });
  }

  if (user.teacherProfile?.advisoryBatch) {
    const advisoryAudienceOr: Prisma.AcademicCalendarWhereInput[] = [
      {
        AND: [
          { targetFaculties: { equals: [] } },
          { targetPrograms: { equals: [] } },
        ],
      },
    ];
    if (programTokens.length > 0) {
      advisoryAudienceOr.push({ targetPrograms: { hasSome: programTokens } });
    }
    if (facultyTokens.length > 0) {
      advisoryAudienceOr.push({ targetFaculties: { hasSome: facultyTokens } });
    }

    orConditions.push({
      AND: [
        { targetBatch: { not: null } },
        { targetBatch: { not: "" } },
        { OR: buildBatchEqualsOr(String(user.teacherProfile.advisoryBatch)) },
        { OR: advisoryAudienceOr },
      ],
    });
  }

  const nonBatchAudience: Prisma.AcademicCalendarWhereInput[] = [
    {
      AND: [
        { targetFaculties: { equals: [] } },
        { targetPrograms: { equals: [] } },
      ],
    },
  ];
  if (programTokens.length > 0) {
    nonBatchAudience.push({ targetPrograms: { hasSome: programTokens } });
  }
  if (facultyTokens.length > 0) {
    nonBatchAudience.push({ targetFaculties: { hasSome: facultyTokens } });
  }

  orConditions.push({
    AND: [
      { OR: [{ targetBatch: null }, { targetBatch: "" }] },
      { OR: nonBatchAudience },
    ],
  });

  return { user, orConditions };
};

const paginateItems = <T>(items: T[], page: number, limit: number) => {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, limit);
  const start = (safePage - 1) * safeLimit;
  return {
    items: items.slice(start, start + safeLimit),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: items.length,
      totalPages: Math.max(1, Math.ceil(items.length / safeLimit)),
    },
  };
};

const getUserVisibleCalendars = async (userId: string) => {
  const { user, orConditions } = await buildUserAudienceConditions(userId);

  if (user.role === "ADMIN") {
    const calendars = await calendarRepository.findAllPublishedCalendarsForAdmin();
    return { user, calendars };
  }

  const rawCalendars = await calendarRepository.findActiveCalendarsFiltered(orConditions);
  const calendars = rawCalendars.filter((calendar) =>
    isCalendarVisibleToUser(calendar, user),
  );
  return { user, calendars };
};

export const getRelevantCalendarsService = async (
  userId: string,
  pagination?: { page?: number | string; limit?: number | string },
) => {
  const { calendars } = await getUserVisibleCalendars(userId);
  if (!pagination) {
    return { items: calendars, pagination: null };
  }

  const { page, limit } = normalizePagination(pagination.page, pagination.limit);
  return paginateItems(calendars, page, limit);
};

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

export const getDhakaTodayStartUtc = (nowMs: number = Date.now()): Date => {
  const dhakaNow = new Date(nowMs + DHAKA_OFFSET_MS);
  return new Date(
    Date.UTC(
      dhakaNow.getUTCFullYear(),
      dhakaNow.getUTCMonth(),
      dhakaNow.getUTCDate(),
    ),
  );
};

export const getCurrentPublishedCalendarService = async (userId: string) => {
  const { user, orConditions } = await buildUserAudienceConditions(userId);
  const summaries = await calendarRepository.findVisibleCalendarSummaries(
    orConditions,
    user.role === "ADMIN",
  );
  const visible = summaries.filter((cal) => isCalendarVisibleToUser(cal, user));
  if (visible.length === 0) return null;

  const winner = [...visible].sort((a, b) => {
    const aHasBatch = Boolean(a.targetBatch && a.targetBatch.trim().length > 0);
    const bHasBatch = Boolean(b.targetBatch && b.targetBatch.trim().length > 0);
    if (aHasBatch !== bHasBatch) return aHasBatch ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  })[0];

  return calendarRepository.findCalendarById(winner.id);
};

export const getUpcomingEventsService = async (
  userId: string,
  limit = 20,
) => {
  const { user, orConditions } = await buildUserAudienceConditions(userId);
  const summaries = await calendarRepository.findVisibleCalendarSummaries(
    orConditions,
    user.role === "ADMIN",
  );
  const calendarIds = summaries
    .filter((cal) => isCalendarVisibleToUser(cal, user))
    .map((cal) => cal.id);

  if (calendarIds.length === 0) return [];

  const parsedLimit = Number(limit);
  const safeLimit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(50, Math.floor(parsedLimit))
      : 20;

  return calendarRepository.findUpcomingEventsForCalendars(
    calendarIds,
    getDhakaTodayStartUtc(),
    safeLimit,
  );
};
