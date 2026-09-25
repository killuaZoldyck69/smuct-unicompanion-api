import { z } from "zod";

export const createMemeSchema = z.object({
  body: z.object({
    imageUrl: z.string().url("A valid image URL is required"),
    caption: z
      .string()
      .max(280, "Caption must not exceed 280 characters")
      .optional()
      .nullable(),
  }),
});

export const reactMemeSchema = z.object({
  body: z.object({
    type: z.enum(["LIKE", "DISLIKE"], {
      message: "Reaction must be either LIKE or DISLIKE",
    }),
  }),
});

export const queryMemesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    filter: z.enum(["latest", "popular", "mine"]).default("latest"),
  }),
});

export const updateMemeSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid meme ID"),
  }),
  body: z.object({
    imageUrl: z.string().url("A valid image URL is required").optional(),
    caption: z
      .string()
      .max(280, "Caption must not exceed 280 characters")
      .optional()
      .nullable(),
  }),
});

export type CreateMemePayload = z.infer<typeof createMemeSchema>["body"];
export type UpdateMemePayload = z.infer<typeof updateMemeSchema>["body"];
export type ReactMemePayload = z.infer<typeof reactMemeSchema>["body"];
export type QueryMemesQuery = z.infer<typeof queryMemesSchema>["query"];
