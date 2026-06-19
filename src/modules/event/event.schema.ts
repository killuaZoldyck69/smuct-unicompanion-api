import { z } from "zod";

export const createEventSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Event title is required"),
    description: z.string().optional(),
    location: z.string().optional(),
    eventDate: z.preprocess(
      (val) => {
        if (!val) return undefined;
        if (val instanceof Date) return val;
        return new Date(val as string);
      },
      z.date({
        message: "Event date is required and must be a valid date",
      }),
    ),
  }),
});

export type CreateEventPayload = z.infer<typeof createEventSchema>["body"];
