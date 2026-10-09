import { z } from "zod";

const datePreprocess = z.preprocess(
  (val) => {
    if (!val) return undefined;
    if (val instanceof Date) return val;
    return new Date(val as string);
  },
  z.date({ message: "Invalid date format" }),
);

export const updateFieldSettingsSchema = z.object({
  body: z.object({
    isBookingOpen: z.boolean(),
    closedNotice: z.string().optional().nullable(),
  }),
});

export const bookFieldSchema = z.object({
  body: z
    .object({
      purpose: z
        .string()
        .trim()
        .min(2, "Purpose must be at least 2 characters")
        .max(250, "Purpose cannot exceed 250 characters"),
      bookingDate: datePreprocess.optional(),
      startTime: datePreprocess,
      endTime: datePreprocess,
    })
    .refine((data) => data.endTime > data.startTime, {
      message: "End time must be after start time",
      path: ["endTime"],
    })
    .refine(
      (data) => {
        // Must not be in the past (allow a 5-minute network latency grace period)
        const nowWithGrace = new Date(Date.now() - 5 * 60 * 1000);
        return data.startTime >= nowWithGrace;
      },
      {
        message: "Cannot book a date or time that has already passed",
        path: ["startTime"],
      },
    )
    .transform((data) => ({
      ...data,
      bookingDate: data.bookingDate ?? data.startTime,
    })),
});

export const updateBookingStatusSchema = z.object({
  body: z.object({
    status: z.enum(["APPROVED", "REJECTED"], {
      message: "Status must be APPROVED or REJECTED",
    }),
  }),
});

export const getAllBookingsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["PENDING", "APPROVED", "REJECTED", "ALL"]).optional(),
    search: z.string().trim().optional(),
    startDate: datePreprocess.optional(),
    endDate: datePreprocess.optional(),
  }),
});

export const getMyBookingsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["PENDING", "APPROVED", "REJECTED", "ALL"]).optional(),
  }),
});

export const getScheduleQuerySchema = z.object({
  query: z.object({
    startDate: datePreprocess.optional(),
    endDate: datePreprocess.optional(),
    limit: z.coerce.number().int().min(1).max(1000).default(500),
  }),
});

export type UpdateFieldSettingsPayload = z.infer<
  typeof updateFieldSettingsSchema
>["body"];
export type BookFieldPayload = z.infer<typeof bookFieldSchema>["body"];
export type GetAllBookingsQuery = z.infer<
  typeof getAllBookingsQuerySchema
>["query"];
export type GetMyBookingsQuery = z.infer<
  typeof getMyBookingsQuerySchema
>["query"];
export type GetScheduleQuery = z.infer<
  typeof getScheduleQuerySchema
>["query"];
