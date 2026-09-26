import { z } from "zod";

export const resourceAttachmentSchema = z.object({
  url: z.string().url("Attachment must have a valid URL"),
  name: z.string().optional().default("Attachment"),
  type: z.string().optional(),
  size: z.number().optional(),
});

export const resourceLinkSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  title: z.string().optional().nullable(),
});

export const createResourceSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Title is required"),
    driveUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")).default("https://drive.google.com"),
    description: z.string().optional().nullable(),
    category: z.string().optional().nullable(),
    fileType: z.string().optional().nullable(),
    fileSize: z.number().optional().nullable(),
    isStudentNote: z.boolean().default(false),
    attachments: z.array(resourceAttachmentSchema).optional().nullable(),
    links: z.array(resourceLinkSchema).optional().nullable(),
  }),
});

export type CreateResourcePayload = z.infer<
  typeof createResourceSchema
>["body"];
