import { z } from "zod";

export const forumIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid forum post ID"),
  }),
});

export const getFeedQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    filter: z.enum(["ALL", "UNRESOLVED", "RESOLVED", "MY_POSTS"]).default("ALL").optional(),
    search: z.string().trim().max(100).optional(),
  }),
});

export const createPostSchema = z.object({
  body: z.object({
    title: z
      .string()
      .trim()
      .min(3, "Title must be at least 3 characters")
      .max(150, "Title cannot exceed 150 characters"),
    description: z
      .string()
      .trim()
      .min(5, "Description must be at least 5 characters")
      .max(3000, "Description cannot exceed 3,000 characters"),
  }),
});

export const createResponseSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid forum post ID"),
  }),
  body: z.object({
    content: z
      .string()
      .trim()
      .min(1, "Response content cannot be empty")
      .max(2000, "Response cannot exceed 2,000 characters"),
  }),
});

export const updatePostSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid forum post ID"),
  }),
  body: z
    .object({
      title: z
        .string()
        .trim()
        .min(3, "Title must be at least 3 characters")
        .max(150, "Title cannot exceed 150 characters")
        .optional(),
      description: z
        .string()
        .trim()
        .min(5, "Description must be at least 5 characters")
        .max(3000, "Description cannot exceed 3,000 characters")
        .optional(),
    })
    .refine((data) => data.title !== undefined || data.description !== undefined, {
      message: "At least one field (title or description) must be provided",
    }),
});

export const updateResponseSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid forum post ID"),
    responseId: z.string().uuid("Invalid response ID"),
  }),
  body: z.object({
    content: z
      .string()
      .trim()
      .min(1, "Response content cannot be empty")
      .max(2000, "Response cannot exceed 2,000 characters"),
  }),
});

export const responseIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid forum post ID"),
    responseId: z.string().uuid("Invalid response ID"),
  }),
});

export type CreatePostPayload = z.infer<typeof createPostSchema>["body"];
export type CreateResponsePayload = z.infer<typeof createResponseSchema>["body"];
export type UpdateResponsePayload = z.infer<typeof updateResponseSchema>["body"];
export type UpdatePostPayload = z.infer<typeof updatePostSchema>["body"];
export type GetFeedQuery = z.infer<typeof getFeedQuerySchema>["query"];
