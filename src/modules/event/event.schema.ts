import { z } from "zod";

export const createEventSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Event title is required"),
    description: z.string().optional(),
    location: z.string().optional(),
    organizer: z.string().optional(),
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

export const updateEventSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Event title cannot be empty").optional(),
    description: z.string().optional(),
    location: z.string().optional(),
    organizer: z.string().optional(),
    eventDate: z
      .preprocess((val) => {
        if (!val) return undefined;
        if (val instanceof Date) return val;
        return new Date(val as string);
      }, z.date())
      .optional(),
  }),
});

export type UpdateEventPayload = z.infer<typeof updateEventSchema>["body"];

export const getEventsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    tab: z.enum(["all", "upcoming", "today", "past"]).optional().default("upcoming"),
    search: z.string().trim().optional(),
    sortBy: z.enum(["eventDate", "createdAt", "title"]).optional().default("eventDate"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("asc"),
  }),
});

export type GetEventsQuery = z.infer<typeof getEventsQuerySchema>["query"];
