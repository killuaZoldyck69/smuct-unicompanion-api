import { z } from "zod";

export const eventCategoryEnum = z.enum([
  "CLASS",
  "REGISTRATION",
  "DEADLINE",
  "EXAM",
  "HOLIDAY",
  "MAKEUP_CLASS",
  "RESULT",
  "ACADEMIC",
  "OTHER",
]);

export const calendarStatusEnum = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

// Date string validator: accepts valid YYYY-MM-DD or ISO string
const dateStringSchema = z.string().refine(
  (val) => {
    const trimmed = val.trim();
    const ymd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) {
      const year = parseInt(ymd[1], 10);
      const month = parseInt(ymd[2], 10);
      const day = parseInt(ymd[3], 10);
      const dt = new Date(Date.UTC(year, month - 1, day));
      return (
        dt.getUTCFullYear() === year &&
        dt.getUTCMonth() === month - 1 &&
        dt.getUTCDate() === day
      );
    }
    const d = new Date(trimmed);
    return !isNaN(d.getTime());
  },
  { message: "Date must be a valid date in YYYY-MM-DD format (e.g. 2026-08-22)" },
);

function parseComparableDateMs(value: string): number {
  const trimmed = value.trim();
  const ymd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    return Date.UTC(
      parseInt(ymd[1], 10),
      parseInt(ymd[2], 10) - 1,
      parseInt(ymd[3], 10),
    );
  }
  return new Date(trimmed).getTime();
}

const MAX_CSV_CONTENT_LENGTH = 500_000;

export const calendarIdParamsObject = z.object({
  id: z.string().uuid("Invalid calendar ID format"),
});

export const calendarEventParamsObject = z.object({
  id: z.string().uuid("Invalid calendar ID format"),
  eventId: z.string().uuid("Invalid event ID format"),
});

export const calendarIdParamSchema = z.object({
  params: calendarIdParamsObject,
});

export const calendarEventParamSchema = z.object({
  params: calendarEventParamsObject,
});

const calendarEventBaseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Event title is required")
    .max(200, "Event title cannot exceed 200 characters"),
  description: z
    .string()
    .trim()
    .max(2000, "Description cannot exceed 2000 characters")
    .nullable()
    .optional(),
  category: eventCategoryEnum.default("ACADEMIC"),
  startDate: dateStringSchema,
  endDate: dateStringSchema.nullable().optional(),
  weekNumber: z
    .number()
    .int()
    .min(1, "Week number must be at least 1")
    .max(52, "Week number cannot exceed 52")
    .nullable()
    .optional(),
  isHoliday: z.boolean().default(false),
  isAllDay: z.boolean().default(true),
  remarks: z
    .string()
    .trim()
    .max(500, "Remarks cannot exceed 500 characters")
    .nullable()
    .optional(),
});

export const calendarEventInputSchema = calendarEventBaseSchema.refine(
  (data) => {
    if (!data.endDate) return true;
    return (
      parseComparableDateMs(data.endDate) >=
      parseComparableDateMs(data.startDate)
    );
  },
  {
    message: "End date cannot be earlier than start date",
    path: ["endDate"],
  },
);

export const updateEventInputSchema = calendarEventBaseSchema
  .partial()
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true;
      return (
        parseComparableDateMs(data.endDate) >=
        parseComparableDateMs(data.startDate)
      );
    },
    {
      message: "End date cannot be earlier than start date",
      path: ["endDate"],
    },
  );

export const SMUCT_SEMESTERS = ["Summer", "Winter", "Spring", "Fall"] as const;
export type SmuctSemester = (typeof SMUCT_SEMESTERS)[number];

const nonEmptyAudienceItemSchema = z
  .string()
  .trim()
  .min(1, "Audience target entry cannot be empty")
  .max(150, "Audience target entry cannot exceed 150 characters");

const normalizedOptionalString = (maxLen: number) =>
  z
    .string()
    .trim()
    .max(maxLen)
    .transform((val) => (val.length === 0 ? null : val))
    .nullable()
    .optional();

export const createCalendarBodySchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Calendar title is required")
      .max(200, "Calendar title cannot exceed 200 characters"),
    semester: z.enum(SMUCT_SEMESTERS, {
      message: "Semester must be one of: Summer, Winter, Spring, Fall",
    }),
    academicYear: z.coerce.number().int().min(2000).max(2100).default(2026),
    targetFaculties: z
      .array(nonEmptyAudienceItemSchema)
      .max(20, "Too many target faculties")
      .default([]),
    targetPrograms: z
      .array(nonEmptyAudienceItemSchema)
      .max(50, "Too many target programs")
      .default([]),
    semesterDuration: normalizedOptionalString(50),
    targetBatch: normalizedOptionalString(50),
    status: calendarStatusEnum.default("DRAFT").optional(),
    events: z
      .array(calendarEventInputSchema)
      .max(500, "Cannot create more than 500 events at once")
      .optional()
      .default([]),
  })
  .refine(
    (data) => {
      const hasBatch = Boolean(data.targetBatch && data.targetBatch.trim().length > 0);
      if (hasBatch) {
        return Array.isArray(data.targetPrograms) && data.targetPrograms.length > 0;
      }
      return true;
    },
    {
      message:
        "Targeting a specific batch requires at least one targeted program to be specified.",
      path: ["targetPrograms"],
    },
  );

export const createCalendarSchema = z.object({
  body: createCalendarBodySchema,
});

export const updateCalendarBodySchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Calendar title is required")
      .max(200, "Calendar title cannot exceed 200 characters")
      .optional(),
    semester: z.enum(SMUCT_SEMESTERS).optional(),
    academicYear: z.coerce.number().int().min(2000).max(2100).optional(),
    targetFaculties: z
      .array(nonEmptyAudienceItemSchema)
      .max(20, "Too many target faculties")
      .optional(),
    targetPrograms: z
      .array(nonEmptyAudienceItemSchema)
      .max(50, "Too many target programs")
      .optional(),
    semesterDuration: normalizedOptionalString(50),
    targetBatch: normalizedOptionalString(50),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      const hasBatch = Boolean(data.targetBatch && data.targetBatch.trim().length > 0);
      if (hasBatch && data.targetPrograms !== undefined) {
        return Array.isArray(data.targetPrograms) && data.targetPrograms.length > 0;
      }
      return true;
    },
    {
      message:
        "Targeting a specific batch requires at least one targeted program to be specified.",
      path: ["targetPrograms"],
    },
  );

export const updateCalendarSchema = z.object({
  params: calendarIdParamsObject,
  body: updateCalendarBodySchema,
});

export const updateCalendarStatusSchema = z.object({
  params: calendarIdParamsObject,
  body: z.object({
    status: calendarStatusEnum,
  }),
});

export const duplicateCalendarSchema = z.object({
  params: calendarIdParamsObject,
});

export const createSingleEventSchema = z.object({
  params: calendarIdParamsObject,
  body: calendarEventInputSchema,
});

export const updateSingleEventSchema = z.object({
  params: calendarEventParamsObject,
  body: updateEventInputSchema,
});

export const validateCsvSchema = z.object({
  body: z.object({
    csvContent: z
      .string()
      .min(1, "CSV content is required")
      .max(MAX_CSV_CONTENT_LENGTH, "CSV content cannot exceed 500KB"),
    calendarId: z.string().uuid("Invalid calendar ID format").optional(),
  }),
});

export const calendarListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(25).optional(),
    status: calendarStatusEnum.optional(),
  }),
});

export const upcomingEventsQuerySchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(50).default(20).optional(),
  }),
});

export const importCsvSchema = z.object({
  params: calendarIdParamsObject,
  body: z.object({
    csvContent: z
      .string()
      .min(1, "CSV content is required")
      .max(MAX_CSV_CONTENT_LENGTH, "CSV content cannot exceed 500KB"),
  }),
});

export type CreateCalendarPayload = z.infer<typeof createCalendarSchema>["body"];
export type UpdateCalendarPayload = z.infer<typeof updateCalendarSchema>["body"];
export type CalendarEventInput = z.infer<typeof calendarEventInputSchema>;
export type UpdateCalendarEventInput = z.infer<typeof updateEventInputSchema>;
