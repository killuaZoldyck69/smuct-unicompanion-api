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

export const normalizePagination = (
  page?: number | string,
  limit?: number | string,
) => {
  const pageNumber = Number(page ?? 1);
  const limitNumber = Number(limit ?? 25);

  return {
    page: Number.isFinite(pageNumber) && pageNumber > 0 ? Math.floor(pageNumber) : 1,
    limit: Number.isFinite(limitNumber) && limitNumber > 0
      ? Math.min(50, Math.floor(limitNumber))
      : 25,
  };
};

const normalizeAudienceValue = (value?: string | null): string =>
  value?.trim().toLowerCase() ?? "";

interface SmuctDepartmentCatalogEntry {
  deptCode: string;
  deptFull: string;
  deptAliases?: string[];
  programs: Array<{ name: string; shortName: string }>;
}

const SMUCT_FACULTY_ALIASES: Record<string, string[]> = {
  ET: [
    "FACULTY OF ENGINEERING & TECHNOLOGY",
    "Faculty of Engineering & Technology (E&T)",
    "Faculty of Engineering & Technology",
    "Engineering & Technology",
    "Engineering & Tech",
    "E&T",
    "ET",
    "FET",
  ],
  DT: [
    "FACULTY OF DESIGN & TECHNOLOGY",
    "Faculty of Design & Technology (D&T)",
    "Faculty of Design & Technology",
    "Design & Technology",
    "Design & Tech",
    "D&T",
    "DT",
    "FDT",
  ],
  FOB: [
    "FACULTY OF BUSINESS",
    "Faculty of Business (FOB)",
    "Faculty of Business",
    "Business & Management",
    "Business",
    "FOB",
  ],
  HSS: [
    "FACULTY OF HUMANITIES & SOCIAL SCIENCES",
    "Faculty of Humanities & Social Sciences (H&SS)",
    "Faculty of Humanities & Social Sciences",
    "Humanities & Social Sciences",
    "H&SS",
    "HSS",
    "FHSS",
  ],
  FPA: [
    "FACULTY OF FINE & PERFORMING ARTS",
    "Faculty of Fine & Performing Arts (F&PA)",
    "Faculty of Fine & Performing Arts",
    "Fine & Performing Arts",
    "F&PA",
    "FPA",
    "FFPA",
  ],
};

const SMUCT_PROGRAM_CATALOG: SmuctDepartmentCatalogEntry[] = [
  {
    deptCode: "CSE",
    deptFull: "Computer Science and Engineering",
    deptAliases: ["computer science"],
    programs: [
      { name: "B.Sc (Hons) in Computer Science and Engineering", shortName: "B.Sc CSE" },
    ],
  },
  {
    deptCode: "CSIT",
    deptFull: "Computer Science and Information Technology",
    deptAliases: ["information technology"],
    programs: [
      { name: "B.Sc (Hons) in Computer Science and Information Technology", shortName: "B.Sc CSIT" },
    ],
  },
  {
    deptCode: "FDT",
    deptFull: "Fashion Design and Technology",
    deptAliases: ["fashion design"],
    programs: [
      { name: "BA (Hons) in Fashion Design and Technology", shortName: "B.A. FDT" },
      { name: "M.A. in Fashion Design", shortName: "M.A. FD" },
    ],
  },
  {
    deptCode: "AMMT",
    deptFull: "Apparel Manufacturing Management and Technology",
    deptAliases: ["apparel"],
    programs: [
      { name: "BA (Hons) in Apparel Manufacturing Management and Technology", shortName: "B.A. AMMT" },
      { name: "MBA in Product & Fashion Merchandizing", shortName: "MBA (PFM)" },
    ],
  },
  {
    deptCode: "IA",
    deptFull: "Interior Architecture",
    deptAliases: ["interior design"],
    programs: [
      { name: "BA (Hons) in Interior Architecture", shortName: "B.A. IA" },
      { name: "M.A. in Interior Design", shortName: "M.A. ID" },
    ],
  },
  {
    deptCode: "GDM",
    deptFull: "Graphic Design and Multimedia",
    deptAliases: ["graphic design"],
    programs: [
      { name: "BA (Hons) in Graphic Design and Multimedia", shortName: "B.A. GDM" },
      { name: "M.A. in Graphic Design and Multimedia", shortName: "M.A. GDM" },
    ],
  },
  {
    deptCode: "ARCH",
    deptFull: "Architecture",
    programs: [
      { name: "Bachelor of Architecture", shortName: "B.Arch" },
    ],
  },
  {
    deptCode: "BBA",
    deptFull: "Business Administration",
    deptAliases: ["business"],
    programs: [
      { name: "Bachelor of Business Administration (BBA)", shortName: "BBA" },
      { name: "Masters of Business Administration (MBA)", shortName: "MBA" },
      { name: "Executive Master of Business Administration (EMBA)", shortName: "EMBA" },
    ],
  },
  {
    deptCode: "ENG",
    deptFull: "English",
    programs: [
      { name: "BA (Hons) in English (Language & Literature)", shortName: "B.A. ENG" },
      { name: "MA in English", shortName: "M.A. ENG" },
    ],
  },
  {
    deptCode: "LAW",
    deptFull: "Law",
    deptAliases: ["llb", "llm"],
    programs: [
      { name: "Bachelor of Laws (LLB)", shortName: "LL.B" },
      { name: "Master of Laws (LLM)", shortName: "LL.M" },
    ],
  },
  {
    deptCode: "SOC",
    deptFull: "Sociology & Anthropology",
    deptAliases: ["sociology", "anthropology"],
    programs: [
      { name: "BSS (Hons) in Sociology & Anthropology", shortName: "BSS SOC" },
      { name: "MSS in Sociology & Anthropology", shortName: "MSS SOC" },
    ],
  },
  {
    deptCode: "BAN",
    deptFull: "Bangla",
    programs: [
      { name: "BA (Hons) in Bangla", shortName: "B.A. BAN" },
      { name: "MA in Bangla", shortName: "M.A. BAN" },
    ],
  },
  {
    deptCode: "G&P",
    deptFull: "Government & Politics",
    deptAliases: ["government and politics", "gp"],
    programs: [
      { name: "BSS (Hons) in Government & Politics", shortName: "BSS G&P" },
      { name: "MSS in Government & Politics", shortName: "MSS G&P" },
    ],
  },
  {
    deptCode: "IS",
    deptFull: "Islamic Studies",
    programs: [
      { name: "BA (Hons) in Islamic Studies", shortName: "B.A. IS" },
      { name: "MA in Islamic Studies", shortName: "M.A. IS" },
    ],
  },
  {
    deptCode: "FA",
    deptFull: "Fine Arts",
    deptAliases: ["fine art"],
    programs: [
      { name: "Bachelor of Fine Arts (Hons) Drawing & Painting", shortName: "BFA" },
      { name: "Master of Fine Arts", shortName: "MFA" },
    ],
  },
  {
    deptCode: "MUS",
    deptFull: "Music",
    programs: [
      { name: "Bachelor of Music (Hons) Rabindra, Nazrul, Classical", shortName: "B.Mus" },
      { name: "Master of Music in Rabindra, Nazrul, Classical", shortName: "M.Mus" },
    ],
  },
  {
    deptCode: "DAN",
    deptFull: "Dance",
    programs: [
      { name: "Bachelor of Music (Hons) in Dance", shortName: "B.Dance" },
      { name: "Master of Music in Dance", shortName: "M.Dance" },
    ],
  },
];

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
    const matches = aliases.some((alias) => alias.toLowerCase() === lower);
    if (matches) {
      for (const alias of aliases) {
        addCaseVariants(terms, alias);
      }
    }
  }

  return Array.from(terms);
};

export const expandProgramAliases = (
  raw?: string | null,
  expandDepartmentPrograms = false,
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

    const matchedDept =
      dept.deptCode.toLowerCase() === lower ||
      dept.deptFull.toLowerCase() === lower ||
      (dept.deptAliases?.some((alias) => alias.toLowerCase() === lower) ?? false);

    if (matchedProg) {
      addCaseVariants(terms, matchedProg.name);
      addCaseVariants(terms, matchedProg.shortName);
      addCaseVariants(terms, dept.deptCode);
      addCaseVariants(terms, dept.deptFull);
      dept.deptAliases?.forEach((alias) => addCaseVariants(terms, alias));
    }

    if (matchedDept) {
      addCaseVariants(terms, dept.deptCode);
      addCaseVariants(terms, dept.deptFull);
      dept.deptAliases?.forEach((alias) => addCaseVariants(terms, alias));
      if (expandDepartmentPrograms) {
        for (const prog of dept.programs) {
          addCaseVariants(terms, prog.name);
          addCaseVariants(terms, prog.shortName);
        }
      }
    }
  }

  return Array.from(terms);
};

const expandCalendarTargetProgram = (raw?: string | null): string[] => {
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
      continue;
    }

    const matchedDept =
      dept.deptCode.toLowerCase() === lower ||
      dept.deptFull.toLowerCase() === lower ||
      (dept.deptAliases?.some((alias) => alias.toLowerCase() === lower) ?? false);

    if (matchedDept) {
      addCaseVariants(terms, dept.deptCode);
      addCaseVariants(terms, dept.deptFull);
      dept.deptAliases?.forEach((alias) => addCaseVariants(terms, alias));
      for (const prog of dept.programs) {
        addCaseVariants(terms, prog.name);
        addCaseVariants(terms, prog.shortName);
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
    for (const t of expandProgramAliases(user.studentProfile.program, true)) {
      programTokens.add(t);
    }
    for (const t of expandProgramAliases(
      user.studentProfile.department,
      !hasSpecificProgram,
    )) {
      programTokens.add(t);
    }
    for (const t of expandFacultyAliases(user.studentProfile.faculty)) {
      facultyTokens.add(t);
    }
  } else if (user.teacherProfile) {
    for (const t of expandProgramAliases(user.teacherProfile.department, true)) {
      programTokens.add(t);
    }
    for (const t of expandFacultyAliases(user.teacherProfile.faculty)) {
      facultyTokens.add(t);
    }
  }

  return {
    programTokens: Array.from(programTokens),
    facultyTokens: Array.from(facultyTokens),
  };
};

/**
 * Admin: List all calendars with optional status filter
 */
export const getAdminCalendarsService = async (
  status?: CalendarStatus,
  pagination?: { page?: number | string; limit?: number | string },
) => {
  const options = pagination ? normalizePagination(pagination.page, pagination.limit) : undefined;
  const result = await calendarRepository.findAllCalendarsAdmin(status, options);

  if (Array.isArray(result)) {
    return {
      items: result,
      pagination: {
        page: options?.page ?? 1,
        limit: options?.limit ?? (result.length || 25),
        total: result.length,
        totalPages: Math.max(1, Math.ceil(result.length / (options?.limit ?? Math.max(1, result.length || 1)))),
      },
    };
  }

  return result;
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
  const event = await calendarRepository.findEventByIdAndCalendar(
    eventId,
    calendarId,
  );
  if (!event) {
    const calendar = await calendarRepository.findCalendarById(calendarId);
    if (!calendar) {
      throw new AppError("Academic calendar not found.", 404);
    }
    throw new AppError("Event not found in this calendar.", 404);
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

  return await calendarRepository.updateCalendarEvent(eventId, eventData);
};

/**
 * Admin: Delete single event
 */
export const deleteEventService = async (
  calendarId: string,
  eventId: string,
) => {
  const event = await calendarRepository.findEventByIdAndCalendar(
    eventId,
    calendarId,
  );
  if (!event) {
    const calendar = await calendarRepository.findCalendarById(calendarId);
    if (!calendar) {
      throw new AppError("Academic calendar not found.", 404);
    }
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

  const matchesProgram = targetPrograms.some((tp) =>
    userProgramSet.has(tp) ||
    expandCalendarTargetProgram(tp).some((alias) =>
      userProgramSet.has(normalizeAudienceValue(alias)),
    ),
  );
  const matchesFaculty = targetFaculties.some((tf) =>
    userFacultySet.has(tf) ||
    expandFacultyAliases(tf).some((alias) =>
      userFacultySet.has(normalizeAudienceValue(alias)),
    ),
  );

  // 3. Student resolution
  if (user.studentProfile) {
    const rawStudentBatch = user.studentProfile.batch?.trim() || "";
    const normStudentBatch = normalizeBatch(rawStudentBatch);

    // CONSTRAINT 1: If calendar has a targetBatch
    // Must match targeted program AND match targeted batch
    if (hasTargetBatch) {
      if (!matchesProgram) {
        return false;
      }

      const matchesBatch =
        Boolean(normStudentBatch && normCalendarBatch && normStudentBatch === normCalendarBatch) ||
        normalizeAudienceValue(rawStudentBatch) === normalizeAudienceValue(rawCalendarBatch);

      return matchesBatch;
    }

    // CONSTRAINT 2: If calendar DOES NOT have a targetBatch
    // Show to all students of the targeted department / program / faculty / global
    return Boolean(matchesProgram || matchesFaculty || isGlobal);
  }

  // 4. Teacher resolution
  if (user.teacherProfile) {
    if (hasTargetBatch) {
      if (user.teacherProfile.advisoryBatch) {
        const normAdvisory = normalizeBatch(String(user.teacherProfile.advisoryBatch));
        if (normAdvisory && normAdvisory === normCalendarBatch) {
          return Boolean(matchesProgram || matchesFaculty || isGlobal);
        }
      }
      return false;
    }

    return Boolean(matchesProgram || matchesFaculty || isGlobal);
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

  const userBatch = user.studentProfile?.batch || null;
  const { programTokens, facultyTokens } = resolveUserAudienceTokens(user);

  const orConditions: any[] = [];

  // 1. Batch-specific calendars (ONLY for students with a batch and candidate program)
  if (user.studentProfile && userBatch && programTokens.length > 0) {
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
        { targetPrograms: { hasSome: programTokens } },
      ],
    });
  }

  // Teacher advisory batch calendars
  if (user.teacherProfile && user.teacherProfile.advisoryBatch) {
    const advisory = String(user.teacherProfile.advisoryBatch);
    const normAdvisory = normalizeBatch(advisory);
    const batchValues = Array.from(
      new Set(
        [
          advisory,
          normAdvisory,
          `Batch ${normAdvisory}`,
          `Batch-${normAdvisory}`,
        ].filter(Boolean),
      ),
    );

    const advisoryAudienceOr: any[] = [
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
        {
          OR: batchValues.map((b) => ({
            targetBatch: { equals: b, mode: "insensitive" as const },
          })),
        },
        { OR: advisoryAudienceOr },
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

  if (programTokens.length > 0) {
    nonBatchAudience.push({ targetPrograms: { hasSome: programTokens } });
  }

  if (facultyTokens.length > 0) {
    nonBatchAudience.push({ targetFaculties: { hasSome: facultyTokens } });
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
const paginateItems = <T>(items: T[], page?: number, limit?: number) => {
  if (!page || !limit) {
    return { items, pagination: null };
  }

  const safePage = Math.max(1, Number(page));
  const safeLimit = Math.max(1, Number(limit));
  const start = (safePage - 1) * safeLimit;
  const pagedItems = items.slice(start, start + safeLimit);

  return {
    items: pagedItems,
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
    const adminCalendars =
      await calendarRepository.findAllPublishedCalendarsForAdmin();
    return {
      user,
      calendars: adminCalendars,
    };
  }

  const rawCalendars = await calendarRepository.findActiveCalendarsFiltered(orConditions);
  const calendars = (Array.isArray(rawCalendars) ? rawCalendars : rawCalendars.items).filter((calendar) =>
    isCalendarVisibleToUser(calendar, user),
  );

  return { user, calendars };
};

export const getRelevantCalendarsService = async (
  userId: string,
  pagination?: { page?: number | string; limit?: number | string },
) => {
  const { user, calendars } = await getUserVisibleCalendars(userId);
  const pageOptions = pagination ? normalizePagination(pagination.page, pagination.limit) : undefined;

  if (user.role === "ADMIN" && pageOptions) {
    return paginateItems(calendars, pageOptions.page, pageOptions.limit);
  }

  if (!pageOptions) {
    return { items: calendars, pagination: null };
  }

  return paginateItems(calendars, pageOptions.page, pageOptions.limit);
};

/**
 * Student: Get the current primary published calendar
 */
export const getCurrentPublishedCalendarService = async (userId: string) => {
  const { calendars } = await getUserVisibleCalendars(userId);

  if (calendars.length === 0) {
    return null;
  }

  return [...calendars].sort((a, b) => {
    const aHasBatch = Boolean(a.targetBatch && a.targetBatch.trim().length > 0);
    const bHasBatch = Boolean(b.targetBatch && b.targetBatch.trim().length > 0);
    if (aHasBatch && !bHasBatch) return -1;
    if (!aHasBatch && bHasBatch) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  })[0];
};

/**
 * Student: Get upcoming published events
 */
export const getUpcomingEventsService = async (
  userId: string,
  limit = 20,
) => {
  const { calendars } = await getUserVisibleCalendars(userId);
  if (calendars.length === 0) {
    return [];
  }

  const calendarIds = calendars.map((calendar) => calendar.id);
  const parsedLimit = Number(limit);
  const safeLimit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(100, Math.floor(parsedLimit))
      : 20;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  return await calendarRepository.findUpcomingEventsForCalendars(
    calendarIds,
    todayStart,
    safeLimit,
  );
};
