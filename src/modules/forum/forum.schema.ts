import { z } from "zod";

export const createPostSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),
  }),
});

export const createResponseSchema = z.object({
  body: z.object({
    content: z.string().min(1, "Response content cannot be empty"),
  }),
});

// NEW: Schema for editing a post
export const updatePostSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Title cannot be empty").optional(),
    description: z.string().min(1, "Description cannot be empty").optional(),
  }),
});

// Export inferred types for the service layer
export type CreatePostPayload = z.infer<typeof createPostSchema>["body"];
export type CreateResponsePayload = z.infer<
  typeof createResponseSchema
>["body"];
export type UpdatePostPayload = z.infer<typeof updatePostSchema>["body"]; // NEW
