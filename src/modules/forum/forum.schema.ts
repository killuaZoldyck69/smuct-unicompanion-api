import { z } from "zod";
import {
  MAX_FORUM_DESCRIPTION_HTML_LENGTH,
  MAX_FORUM_RESPONSE_LENGTH,
  MAX_FORUM_TITLE_LENGTH,
  MIN_FORUM_DESCRIPTION_PLAIN_LENGTH,
  MIN_FORUM_TITLE_LENGTH,
} from "./forum.sanitizer";

const postTitleField = z
  .string()
  .trim()
  .min(
    MIN_FORUM_TITLE_LENGTH,
    `Title must be at least ${MIN_FORUM_TITLE_LENGTH} characters`,
  )
  .max(
    MAX_FORUM_TITLE_LENGTH,
    `Title cannot exceed ${MAX_FORUM_TITLE_LENGTH} characters`,
  );

const postDescriptionField = z
  .string()
  .trim()
  .min(
    MIN_FORUM_DESCRIPTION_PLAIN_LENGTH,
    `Description must be at least ${MIN_FORUM_DESCRIPTION_PLAIN_LENGTH} characters`,
  )
  .max(
    MAX_FORUM_DESCRIPTION_HTML_LENGTH,
    "Description markup cannot exceed 12,000 characters",
  );

const responseContentField = z
  .string()
  .trim()
  .min(1, "Response content cannot be empty")
  .max(
    MAX_FORUM_RESPONSE_LENGTH * 2,
    "Response input exceeds maximum allowed size",
  );

const postIdParams = z.object({
  id: z.string().uuid("Invalid forum post ID"),
});

const responseRouteParams = z.object({
  id: z.string().uuid("Invalid forum post ID"),
  responseId: z.string().uuid("Invalid response ID"),
});

export const forumIdParamSchema = z.object({
  params: postIdParams,
});

export const getFeedQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(15),
    filter: z
      .enum(["ALL", "UNRESOLVED", "RESOLVED", "MY_POSTS"])
      .default("ALL")
      .optional(),
    search: z.string().trim().max(100).optional(),
  }),
});

export const createPostSchema = z.object({
  body: z.object({
    title: postTitleField,
    description: postDescriptionField,
  }),
});

export const createResponseSchema = z.object({
  params: postIdParams,
  body: z.object({
    content: responseContentField,
    parentId: z
      .string()
      .uuid("Invalid parent response ID")
      .optional()
      .nullable(),
  }),
});

export const updatePostSchema = z.object({
  params: postIdParams,
  body: z
    .object({
      title: postTitleField.optional(),
      description: postDescriptionField.optional(),
    })
    .refine(
      (data) => data.title !== undefined || data.description !== undefined,
      {
        message: "At least one field (title or description) must be provided",
      },
    ),
});

export const resolvePostSchema = z.object({
  params: postIdParams,
  body: z
    .object({
      isResolved: z.boolean().optional(),
    })
    .optional(),
});

export const updateResponseSchema = z.object({
  params: responseRouteParams,
  body: z.object({
    content: responseContentField,
  }),
});

export const responseIdParamSchema = z.object({
  params: responseRouteParams,
});

export const reactResponseSchema = z.object({
  params: responseRouteParams,
  body: z.object({
    type: z.enum(["LIKE", "DISLIKE"], {
      message: "Reaction type must be LIKE or DISLIKE",
    }),
  }),
});

export const createForumReportSchema = z.object({
  body: z.object({
    targetType: z.enum(["FORUM_POST", "FORUM_RESPONSE"], {
      message: "Report targetType must be FORUM_POST or FORUM_RESPONSE",
    }),
    targetId: z.string().uuid("Invalid target content ID"),
    reason: z.enum(
      [
        "SPAM",
        "HARASSMENT",
        "HATE_SPEECH",
        "INAPPROPRIATE",
        "ACADEMIC_MISCONDUCT",
        "OTHER",
      ],
      {
        message: "Invalid report reason",
      },
    ),
    details: z
      .string()
      .trim()
      .max(500, "Additional details cannot exceed 500 characters")
      .optional(),
  }),
});

export type CreatePostPayload = z.infer<typeof createPostSchema>["body"];
export type CreateResponsePayload = z.infer<
  typeof createResponseSchema
>["body"];
export type UpdateResponsePayload = z.infer<
  typeof updateResponseSchema
>["body"];
export type UpdatePostPayload = z.infer<typeof updatePostSchema>["body"];
export type ResolvePostPayload = z.infer<typeof resolvePostSchema>["body"];
export type GetFeedQuery = z.infer<typeof getFeedQuerySchema>["query"];
export type ReactResponsePayload = z.infer<typeof reactResponseSchema>["body"];
export type CreateForumReportPayload = z.infer<
  typeof createForumReportSchema
>["body"];
