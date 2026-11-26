import { z } from "zod";
import {
  isSafeHttpUrl,
  MAX_ANNOUNCEMENT_ATTACHMENTS,
  MAX_ANNOUNCEMENT_HTML_LENGTH,
  MAX_ANNOUNCEMENT_LINKS,
  MAX_COMMENT_LENGTH,
  MAX_DISCUSSION_CONTENT_LENGTH,
  MAX_DISCUSSION_REPLY_LENGTH,
  MAX_DISCUSSION_TITLE_LENGTH,
  MAX_LINK_TITLE_LENGTH,
  MAX_ANNOUNCEMENTS_LIMIT,
} from "./content.domain";

const safeHttpUrlSchema = z
  .string()
  .trim()
  .max(2048, "URL cannot exceed 2048 characters")
  .refine(isSafeHttpUrl, "Must be a valid http:// or https:// URL");

export const hubContentParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Course Hub ID"),
  }),
});

export const getAnnouncementsQuerySchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Course Hub ID"),
  }),
  query: z.object({
    page: z.coerce
      .number()
      .int("Page must be a whole number")
      .min(1, "Page must be at least 1")
      .max(1000, "Page cannot exceed 1000")
      .optional(),
    limit: z.coerce
      .number()
      .int("Limit must be a whole number")
      .min(1, "Limit must be at least 1")
      .max(
        MAX_ANNOUNCEMENTS_LIMIT,
        `Limit cannot exceed ${MAX_ANNOUNCEMENTS_LIMIT}`,
      )
      .optional(),
  }),
});

export const announcementParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Course Hub ID"),
    announcementId: z.string().uuid("Invalid announcement ID"),
  }),
});

export const commentParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Course Hub ID"),
    announcementId: z.string().uuid("Invalid announcement ID"),
    commentId: z.string().uuid("Invalid comment ID"),
  }),
});

export const attachmentSchema = z.object({
  url: safeHttpUrlSchema,
  name: z
    .string()
    .trim()
    .min(1, "Attachment name cannot be empty")
    .max(255, "Attachment name cannot exceed 255 characters")
    .optional()
    .default("Attachment"),
  type: z.string().trim().max(100).optional(),
  size: z
    .number()
    .nonnegative("Attachment size must be non-negative")
    .max(1024 * 1024 * 1024, "Attachment size exceeds limit")
    .optional(),
});

export const linkSchema = z.object({
  url: safeHttpUrlSchema,
  title: z
    .string()
    .trim()
    .max(MAX_LINK_TITLE_LENGTH, "Link title cannot exceed 200 characters")
    .optional()
    .nullable(),
});

export const createAnnouncementSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Course Hub ID"),
  }),
  body: z.object({
    content: z
      .string()
      .trim()
      .min(1, "Announcement content cannot be empty")
      .max(MAX_ANNOUNCEMENT_HTML_LENGTH, "Announcement payload is too large"),
    attachedLinkUrl: safeHttpUrlSchema
      .optional()
      .or(z.literal(""))
      .nullable(),
    attachedLinkTitle: z
      .string()
      .trim()
      .max(MAX_LINK_TITLE_LENGTH, "Link title cannot exceed 200 characters")
      .optional()
      .nullable(),
    attachments: z
      .array(attachmentSchema)
      .max(
        MAX_ANNOUNCEMENT_ATTACHMENTS,
        `At most ${MAX_ANNOUNCEMENT_ATTACHMENTS} attachments allowed`,
      )
      .optional()
      .nullable(),
    links: z
      .array(linkSchema)
      .max(
        MAX_ANNOUNCEMENT_LINKS,
        `At most ${MAX_ANNOUNCEMENT_LINKS} links allowed`,
      )
      .optional()
      .nullable(),
  }),
});

export const updateAnnouncementSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Course Hub ID"),
    announcementId: z.string().uuid("Invalid announcement ID"),
  }),
  body: z.object({
    content: z
      .string()
      .trim()
      .min(1, "Announcement content cannot be empty")
      .max(MAX_ANNOUNCEMENT_HTML_LENGTH, "Announcement payload is too large")
      .optional(),
    attachedLinkUrl: safeHttpUrlSchema
      .optional()
      .or(z.literal(""))
      .nullable(),
    attachedLinkTitle: z
      .string()
      .trim()
      .max(MAX_LINK_TITLE_LENGTH, "Link title cannot exceed 200 characters")
      .optional()
      .nullable(),
    attachments: z
      .array(attachmentSchema)
      .max(
        MAX_ANNOUNCEMENT_ATTACHMENTS,
        `At most ${MAX_ANNOUNCEMENT_ATTACHMENTS} attachments allowed`,
      )
      .optional()
      .nullable(),
    links: z
      .array(linkSchema)
      .max(
        MAX_ANNOUNCEMENT_LINKS,
        `At most ${MAX_ANNOUNCEMENT_LINKS} links allowed`,
      )
      .optional()
      .nullable(),
  }),
});

export const commentAnnouncementSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Course Hub ID"),
    announcementId: z.string().uuid("Invalid announcement ID"),
  }),
  body: z.object({
    content: z
      .string()
      .trim()
      .min(1, "Comment content cannot be empty")
      .max(MAX_COMMENT_LENGTH, `Comment cannot exceed ${MAX_COMMENT_LENGTH} characters`),
    parentId: z.string().uuid("Invalid parent comment ID").optional().nullable(),
  }),
});

export const updateAnnouncementCommentSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Course Hub ID"),
    announcementId: z.string().uuid("Invalid announcement ID"),
    commentId: z.string().uuid("Invalid comment ID"),
  }),
  body: z.object({
    content: z
      .string()
      .trim()
      .min(1, "Comment content cannot be empty")
      .max(MAX_COMMENT_LENGTH, `Comment cannot exceed ${MAX_COMMENT_LENGTH} characters`),
  }),
});

export type UpdateAnnouncementCommentPayload = z.infer<
  typeof updateAnnouncementCommentSchema
>["body"];

export const createDiscussionSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Course Hub ID"),
  }),
  body: z.object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .max(MAX_DISCUSSION_TITLE_LENGTH, "Discussion title is too long"),
    content: z
      .string()
      .trim()
      .min(1, "Discussion content cannot be empty")
      .max(MAX_DISCUSSION_CONTENT_LENGTH, "Discussion content is too long"),
  }),
});

export const replyDiscussionSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Course Hub ID"),
    discussionId: z.string().uuid("Invalid discussion ID"),
  }),
  body: z.object({
    content: z
      .string()
      .trim()
      .min(1, "Reply content cannot be empty")
      .max(MAX_DISCUSSION_REPLY_LENGTH, "Reply content is too long"),
  }),
});

export type CreateAnnouncementPayload = z.infer<
  typeof createAnnouncementSchema
>["body"];
export type UpdateAnnouncementPayload = z.infer<
  typeof updateAnnouncementSchema
>["body"];
export type CreateDiscussionPayload = z.infer<
  typeof createDiscussionSchema
>["body"];
export type ReplyDiscussionPayload = z.infer<
  typeof replyDiscussionSchema
>["body"];
