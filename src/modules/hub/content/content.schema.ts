import { z } from "zod";

export const attachmentSchema = z.object({
  url: z.string().url("Attachment must have a valid URL"),
  name: z.string().optional().default("Attachment"),
  type: z.string().optional(),
  size: z.number().optional(),
});

export const linkSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  title: z.string().optional().nullable(),
});

export const createAnnouncementSchema = z.object({
  body: z.object({
    content: z.string().min(1, "Announcement content cannot be empty"),
    attachedLinkUrl: z
      .string()
      .url("Must be a valid URL")
      .optional()
      .or(z.literal(""))
      .nullable(),
    attachedLinkTitle: z.string().optional().nullable(),
    attachments: z.array(attachmentSchema).optional().nullable(),
    links: z.array(linkSchema).optional().nullable(),
  }),
});

export const updateAnnouncementSchema = z.object({
  body: z.object({
    content: z.string().min(1, "Announcement content cannot be empty").optional(),
    attachedLinkUrl: z
      .string()
      .url("Must be a valid URL")
      .optional()
      .or(z.literal(""))
      .nullable(),
    attachedLinkTitle: z.string().optional().nullable(),
    attachments: z.array(attachmentSchema).optional().nullable(),
    links: z.array(linkSchema).optional().nullable(),
  }),
});

export const createAnnouncementCommentSchema = z.object({
  body: z.object({
    content: z.string().min(1, "Comment cannot be empty"),
  }),
});

export const createDiscussionSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Title is required"),
    content: z.string().min(1, "Discussion content cannot be empty"),
  }),
});

export const replyDiscussionSchema = z.object({
  body: z.object({
    content: z.string().min(1, "Reply content cannot be empty"),
  }),
});

export const commentAnnouncementSchema = z.object({
  body: z.object({
    content: z.string().min(1, "Comment content cannot be empty"),
  }),
});

export type CreateAnnouncementPayload = z.infer<
  typeof createAnnouncementSchema
>["body"];
export type UpdateAnnouncementPayload = z.infer<
  typeof updateAnnouncementSchema
>["body"];
export type CreateAnnouncementCommentPayload = z.infer<
  typeof createAnnouncementCommentSchema
>["body"];
export type CreateDiscussionPayload = z.infer<
  typeof createDiscussionSchema
>["body"];
export type ReplyDiscussionPayload = z.infer<
  typeof replyDiscussionSchema
>["body"];
