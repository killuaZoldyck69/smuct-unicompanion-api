import { z } from "zod";

const calendarEventSchema = z.object({
  title: z.string().min(1, "Event title is required"),
  description: z.string().nullable().optional(),

  // Use the "message" property instead of "required_error"
  startDate: z.preprocess(
    (val) => {
      if (!val) return undefined; // Pass undefined so z.date() knows it's missing
      if (val instanceof Date) return val;
      return new Date(val as string);
    },
    z.date({
      message: "Start date is required and must be a valid date", // 👈 Fixed here
    }),
  ),

  endDate: z.preprocess(
    (val) => {
      if (!val) return null;
      return new Date(val as string);
    },
    z.date({ message: "Invalid end date" }).nullable().optional(),
  ), // Added safety here too

  isHoliday: z.boolean().default(false),
});

export const createCalendarSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Calendar title is required"),
    semester: z.string().min(1, "Semester identifier is required"),
    isActive: z.boolean().default(true).optional(),
    isGlobal: z.boolean().default(false),
    targetFaculties: z.array(z.string()).default([]),
    targetDepartments: z.array(z.string()).default([]),
    events: z
      .array(calendarEventSchema)
      .min(1, "At least one event is required"),
  }),
});

export type CreateCalendarPayload = z.infer<
  typeof createCalendarSchema
>["body"];
