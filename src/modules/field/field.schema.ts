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
  body: z.object({
    purpose: z.string().min(1, "Purpose is required"),
    bookingDate: datePreprocess,
    startTime: datePreprocess,
    endTime: datePreprocess,
  }),
});

export const updateBookingStatusSchema = z.object({
  body: z.object({
    status: z.enum(["APPROVED", "REJECTED"], {
      message: "Status must be APPROVED or REJECTED",
    }),
  }),
});

export type UpdateFieldSettingsPayload = z.infer<
  typeof updateFieldSettingsSchema
>["body"];
export type BookFieldPayload = z.infer<typeof bookFieldSchema>["body"];
