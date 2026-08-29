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

// Date string validator: accepts YYYY-MM-DD or ISO string and outputs Date or YYYY-MM-DD string
const dateStringSchema = z.string().refine(
  (val) => {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return true;
    const d = new Date(trimmed);
    return !isNaN(d.getTime());
  },
  { message: "Date must be in YYYY-MM-DD format (e.g. 2026-08-22)" },
);

export const calendarEventInputSchema = z.object({
  title: z.string().min(1, "Event title is required"),
  description: z.string().nullable().optional(),
  category: eventCategoryEnum.default("ACADEMIC"),
  startDate: dateStringSchema,
  endDate: dateStringSchema.nullable().optional(),
  weekNumber: z.number().int().positive().nullable().optional(),
  isHoliday: z.boolean().default(false),
  isAllDay: z.boolean().default(true),
  remarks: z.string().nullable().optional(),
});

export const updateEventInputSchema = z.object({
  title: z.string().min(1, "Event title is required").optional(),
  description: z.string().nullable().optional(),
  category: eventCategoryEnum.optional(),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.nullable().optional(),
  weekNumber: z.number().int().positive().nullable().optional(),
  isHoliday: z.boolean().optional(),
  isAllDay: z.boolean().optional(),
  remarks: z.string().nullable().optional(),
});

export const createCalendarSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Calendar title is required"),
    semester: z.string().min(1, "Semester is required (e.g. Winter 2026)"),
    academicYear: z.coerce.number().int().min(2000).max(2100).default(2026),
    isGlobal: z.boolean().default(false),
    targetFaculties: z.array(z.string()).default([]),
    targetDepartments: z.array(z.string()).default([]),
    status: calendarStatusEnum.default("DRAFT").optional(),
    events: z.array(calendarEventInputSchema).optional().default([]),
  }),
});

export const updateCalendarSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Calendar title is required").optional(),
    semester: z.string().min(1, "Semester is required").optional(),
    academicYear: z.coerce.number().int().min(2000).max(2100).optional(),
    isGlobal: z.boolean().optional(),
    targetFaculties: z.array(z.string()).optional(),
    targetDepartments: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const updateCalendarStatusSchema = z.object({
  body: z.object({
    status: calendarStatusEnum,
  }),
});

export const createSingleEventSchema = z.object({
  body: calendarEventInputSchema,
});

export const updateSingleEventSchema = z.object({
  body: updateEventInputSchema,
});

export const validateCsvSchema = z.object({
  body: z.object({
    csvContent: z.string().min(1, "CSV content is required"),
    calendarId: z.string().uuid().optional(),
  }),
});

export const importCsvSchema = z.object({
  body: z.object({
    csvContent: z.string().min(1, "CSV content is required"),
  }),
});

export type CreateCalendarPayload = z.infer<typeof createCalendarSchema>["body"];
export type UpdateCalendarPayload = z.infer<typeof updateCalendarSchema>["body"];
export type CalendarEventInput = z.infer<typeof calendarEventInputSchema>;
export type UpdateCalendarEventInput = z.infer<typeof updateEventInputSchema>;
