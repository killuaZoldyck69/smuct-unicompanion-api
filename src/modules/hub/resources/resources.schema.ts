import { z } from "zod";
import {
  isSafeResourceHttpUrl,
  MAX_RESOURCE_ATTACHMENTS,
  MAX_RESOURCE_CATEGORY_LENGTH,
  MAX_RESOURCE_DESCRIPTION_LENGTH,
  MAX_RESOURCE_FILE_TYPE_LENGTH,
  MAX_RESOURCE_LINK_TITLE_LENGTH,
  MAX_RESOURCE_LINKS,
  MAX_RESOURCE_TITLE_LENGTH,
} from "./resources.domain";

const safeResourceUrlSchema = z
  .string()
  .trim()
  .max(2048, "URL cannot exceed 2048 characters")
  .refine(isSafeResourceHttpUrl, "Must be a valid http:// or https:// URL");

export const getResourcesQuerySchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Course Hub ID"),
  }),
  query: z.object({
    isStudentNote: z.enum(["true", "false"]).optional(),
    category: z
      .string()
      .trim()
      .max(MAX_RESOURCE_CATEGORY_LENGTH, "Category filter is too long")
      .optional(),
  }),
});

export const resourceParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Course Hub ID"),
    resourceId: z.string().uuid("Invalid resource ID"),
  }),
});

export const resourceAttachmentSchema = z.object({
  url: safeResourceUrlSchema,
  name: z
    .string()
    .trim()
    .max(255, "Attachment name cannot exceed 255 characters")
    .nullish()
    .transform((v) => v || "Attachment"),
  type: z.string().trim().max(100).nullish(),
  size: z
    .number()
    .nonnegative("Attachment size must be non-negative")
    .max(2 * 1024 * 1024 * 1024, "Attachment size exceeds limit")
    .nullish(),
});

export const resourceLinkSchema = z.object({
  url: safeResourceUrlSchema,
  title: z
    .string()
    .trim()
    .max(MAX_RESOURCE_LINK_TITLE_LENGTH, "Link title cannot exceed 200 characters")
    .nullish(),
});

export const createResourceSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Course Hub ID"),
  }),
  body: z.object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .max(MAX_RESOURCE_TITLE_LENGTH, "Title cannot exceed 200 characters"),
    driveUrl: safeResourceUrlSchema
      .optional()
      .or(z.literal(""))
      .default("https://drive.google.com"),
    description: z
      .string()
      .trim()
      .max(
        MAX_RESOURCE_DESCRIPTION_LENGTH,
        "Description cannot exceed 2000 characters",
      )
      .nullish(),
    category: z
      .string()
      .trim()
      .max(MAX_RESOURCE_CATEGORY_LENGTH, "Category cannot exceed 60 characters")
      .nullish(),
    fileType: z
      .string()
      .trim()
      .max(MAX_RESOURCE_FILE_TYPE_LENGTH, "File type cannot exceed 60 characters")
      .nullish(),
    fileSize: z
      .number()
      .nonnegative("File size must be non-negative")
      .max(2 * 1024 * 1024 * 1024, "File size exceeds limit")
      .nullish(),
    isStudentNote: z.boolean().default(false),
    attachments: z
      .array(resourceAttachmentSchema)
      .max(
        MAX_RESOURCE_ATTACHMENTS,
        `At most ${MAX_RESOURCE_ATTACHMENTS} attachments allowed`,
      )
      .nullish(),
    links: z
      .array(resourceLinkSchema)
      .max(MAX_RESOURCE_LINKS, `At most ${MAX_RESOURCE_LINKS} links allowed`)
      .nullish(),
  }),
});

export type CreateResourcePayload = z.infer<
  typeof createResourceSchema
>["body"];
