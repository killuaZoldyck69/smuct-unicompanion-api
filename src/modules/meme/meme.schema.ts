import { z } from "zod";
import {
  buildOptimizedUrl,
  extractPublicIdFromUrl,
  isAllowedAppCloudinaryImageUrl,
} from "../../lib/cloudinary";
import {
  MAX_MEME_CAPTION_LENGTH,
  MAX_MEME_FEED_LIMIT,
  MEME_CLOUDINARY_PREFIX,
  sanitizeMemeCaption,
} from "./meme.domain";

const UGC_REPORT_REASON_VALUES = [
  "SPAM",
  "HARASSMENT",
  "HATE_SPEECH",
  "INAPPROPRIATE",
  "ACADEMIC_MISCONDUCT",
  "OTHER",
] as const;

const memeIdParams = z.object({
  id: z.string().uuid("Invalid meme ID"),
});

const verifiedMemeImageUrl = z
  .string()
  .trim()
  .max(1000, "Image URL exceeds maximum allowed length")
  .url("A valid image URL is required")
  .refine(
    (url) =>
      url.match(/https?:\/\//g)?.length === 1 &&
      isAllowedAppCloudinaryImageUrl(url, [MEME_CLOUDINARY_PREFIX]),
    {
      message:
        "Image URL must be a verified SMUCT UniCompanion Cloudinary Memes asset.",
    },
  )
  .transform((url) => {
    const publicId = extractPublicIdFromUrl(url);
    if (!publicId) return url;
    try {
      const cloudFromUrl = new URL(url).pathname.split("/").filter(Boolean)[0];
      return buildOptimizedUrl(publicId, cloudFromUrl);
    } catch {
      return url;
    }
  });

const sanitizedCaptionField = z
  .string()
  .max(2000, "Caption input exceeds maximum allowed size")
  .nullable()
  .transform((val) => sanitizeMemeCaption(val))
  .refine(
    (val) => val === null || val.length <= MAX_MEME_CAPTION_LENGTH,
    `Caption must not exceed ${MAX_MEME_CAPTION_LENGTH} characters`,
  );

const reportDetailsField = z
  .string()
  .max(1000, "Additional details exceed maximum allowed size")
  .optional()
  .nullable()
  .transform((val) => sanitizeMemeCaption(val) ?? undefined)
  .refine(
    (val) => val === undefined || val.length <= 500,
    "Additional details cannot exceed 500 characters",
  );

export const memeIdParamSchema = z.object({
  params: memeIdParams,
});

export const createMemeSchema = z.object({
  body: z.object({
    imageUrl: verifiedMemeImageUrl,
    caption: sanitizedCaptionField.optional(),
    idempotencyKey: z.string().trim().min(8).max(120).optional(),
  }),
});

export const updateMemeSchema = z.object({
  params: memeIdParams,
  body: z
    .object({
      caption: sanitizedCaptionField,
    })
    .strict(),
});

export const reactMemeSchema = z.object({
  params: memeIdParams,
  body: z.object({
    type: z.enum(["LIKE", "DISLIKE"], {
      message: "Reaction must be either LIKE or DISLIKE",
    }),
  }),
});

export const queryMemesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(MAX_MEME_FEED_LIMIT).default(20),
    filter: z.enum(["latest", "popular", "mine"]).default("latest"),
  }),
});

export const createMemeReportByIdSchema = z.object({
  params: memeIdParams,
  body: z.object({
    reason: z.enum(UGC_REPORT_REASON_VALUES, {
      message: "Invalid report reason",
    }),
    details: reportDetailsField,
  }),
});

export const createMemeReportBodySchema = z.object({
  body: z
    .object({
      targetType: z.literal("MEME_POST").optional(),
      targetId: z.string().uuid("Invalid meme ID").optional(),
      memeId: z.string().uuid("Invalid meme ID").optional(),
      reason: z.enum(UGC_REPORT_REASON_VALUES, {
        message: "Invalid report reason",
      }),
      details: reportDetailsField,
    })
    .refine((data) => Boolean(data.targetId || data.memeId), {
      message: "targetId or memeId is required",
    }),
});

export type CreateMemePayload = z.infer<typeof createMemeSchema>["body"];
export type UpdateMemePayload = z.infer<typeof updateMemeSchema>["body"];
export type ReactMemePayload = z.infer<typeof reactMemeSchema>["body"];
export type QueryMemesQuery = z.infer<typeof queryMemesSchema>["query"];
export type CreateMemeReportByIdPayload = z.infer<
  typeof createMemeReportByIdSchema
>["body"];
export type CreateMemeReportBodyPayload = z.infer<
  typeof createMemeReportBodySchema
>["body"];
