import { z } from "zod";

export const eventIdParamSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, "Event ID is required"),
  }),
});

export const createEventSchema = z.object({
  body: z.object({
    title: z
      .string()
      .trim()
      .min(3, "Event title must be at least 3 characters")
      .max(200, "Event title must not exceed 200 characters"),
    category: z
      .string()
      .trim()
      .min(1, "Event category is required")
      .max(50, "Event category must not exceed 50 characters")
      .default("GENERAL"),
    description: z
      .string()
      .trim()
      .max(20000, "Description text is too long")
      .optional(),
    location: z
      .string()
      .trim()
      .min(2, "Event location must be at least 2 characters")
      .max(200, "Event location must not exceed 200 characters"),
    organizer: z
      .string()
      .trim()
      .max(150, "Organizer name must not exceed 150 characters")
      .optional(),
    eventDate: z.preprocess(
      (val) => {
        if (!val) return undefined;
        if (val instanceof Date) return val;
        const d = new Date(val as string);
        return isNaN(d.getTime()) ? undefined : d;
      },
      z.date({
        message: "Event date is required and must be a valid date",
      }),
    ),
  }),
});

export type CreateEventPayload = z.infer<typeof createEventSchema>["body"];

export const updateEventSchema = z.object({
  params: z
    .object({
      id: z.string().trim().min(1, "Event ID is required"),
    })
    .optional(),
  body: z.object({
    title: z
      .string()
      .trim()
      .min(3, "Event title must be at least 3 characters")
      .max(200, "Event title must not exceed 200 characters")
      .optional(),
    category: z
      .string()
      .trim()
      .min(1, "Event category cannot be empty")
      .max(50, "Event category must not exceed 50 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .max(20000, "Description text is too long")
      .optional(),
    location: z
      .string()
      .trim()
      .min(2, "Event location must be at least 2 characters")
      .max(200, "Event location must not exceed 200 characters")
      .optional(),
    organizer: z
      .string()
      .trim()
      .max(150, "Organizer name must not exceed 150 characters")
      .optional(),
    eventDate: z
      .preprocess((val) => {
        if (!val) return undefined;
        if (val instanceof Date) return val;
        const d = new Date(val as string);
        return isNaN(d.getTime()) ? undefined : d;
      }, z.date({ message: "Event date must be a valid date" }))
      .optional(),
  }),
});

export type UpdateEventPayload = z.infer<typeof updateEventSchema>["body"];

export const getEventsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    tab: z.enum(["all", "upcoming", "today", "past"]).optional().default("upcoming"),
    category: z.string().trim().optional(),
    search: z.string().trim().optional(),
    sortBy: z.enum(["eventDate", "createdAt", "title"]).optional().default("eventDate"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("asc"),
  }),
});

export type GetEventsQuery = z.infer<typeof getEventsQuerySchema>["query"];
