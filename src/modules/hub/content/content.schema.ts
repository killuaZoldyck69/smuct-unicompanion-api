import { z } from "zod";

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
export type CreateAnnouncementCommentPayload = z.infer<
  typeof createAnnouncementCommentSchema
>["body"];
export type CreateDiscussionPayload = z.infer<
  typeof createDiscussionSchema
>["body"];
export type ReplyDiscussionPayload = z.infer<
  typeof replyDiscussionSchema
>["body"];
