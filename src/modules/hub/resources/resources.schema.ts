import { z } from "zod";

export const resourceAttachmentSchema = z.object({
  url: z.string().min(1, "Attachment must have a valid URL"),
  name: z.string().nullish().default("Attachment"),
  type: z.string().nullish(),
  size: z.number().nullish(),
});

export const resourceLinkSchema = z.object({
  url: z.string().min(1, "Must be a valid URL"),
  title: z.string().nullish(),
});

export const createResourceSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Title is required"),
    driveUrl: z.string().min(1, "Must be a valid URL").optional().or(z.literal("")).default("https://drive.google.com"),
    description: z.string().nullish(),
    category: z.string().nullish(),
    fileType: z.string().nullish(),
    fileSize: z.number().nullish(),
    isStudentNote: z.boolean().default(false),
    attachments: z.array(resourceAttachmentSchema).nullish(),
    links: z.array(resourceLinkSchema).nullish(),
  }),
});

export type CreateResourcePayload = z.infer<
  typeof createResourceSchema
>["body"];
