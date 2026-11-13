import { z } from "zod";
import {
  LOST_FOUND_TYPE_VALUES,
  LOST_FOUND_STATUS_VALUES,
  LOST_FOUND_CATEGORY_VALUES,
} from "../../constants/enums";
import { isAllowedAppCloudinaryImageUrl } from "../../lib/cloudinary";

const LOST_FOUND_CLOUDINARY_PREFIX = "smuct-unicompanion/campus-hub/lost-found";

const verifiedLostFoundImageUrl = z
  .string()
  .trim()
  .max(1000, "Image URL exceeds maximum allowed length")
  .url("Invalid image URL")
  .refine(
    (url) =>
      url.match(/https?:\/\//g)?.length === 1 &&
      isAllowedAppCloudinaryImageUrl(url, [LOST_FOUND_CLOUDINARY_PREFIX]),
    {
      message:
        "Image URL must be a verified SMUCT UniCompanion Cloudinary Lost & Found asset.",
    },
  );

const postIdParams = z.object({
  id: z.string().uuid("Invalid Lost & Found post ID"),
});

const claimRouteParams = postIdParams.extend({
  claimId: z.string().uuid("Invalid claim ID"),
});

const lostFoundBodyFields = {
  type: z.enum(LOST_FOUND_TYPE_VALUES, {
    message: "Type must be LOST or FOUND",
  }),
  title: z
    .string()
    .trim()
    .min(2, "Title must be at least 2 characters")
    .max(150, "Title cannot exceed 150 characters"),
  description: z.string().trim().max(3000).optional().nullable(),
  category: z.enum(LOST_FOUND_CATEGORY_VALUES, {
    message: "Invalid category selected",
  }),
  location: z.string().trim().max(150).optional().nullable(),
  verificationQuestion: z.string().trim().max(200).optional().nullable(),
  verificationAnswer: z.string().trim().max(200).optional().nullable(),
};

const imagesArraySchema = z
  .array(verifiedLostFoundImageUrl)
  .max(2, "Maximum 2 photos allowed for Lost & Found items");

export const lostFoundIdParamSchema = z.object({
  params: postIdParams,
});

export const lostFoundClaimParamSchema = z.object({
  params: claimRouteParams,
});

export const createLostFoundSchema = z.object({
  body: z.object({
    ...lostFoundBodyFields,
    images: imagesArraySchema.default([]),
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
  }),
});

export const updateLostFoundSchema = z.object({
  params: postIdParams,
  body: z
    .object({
      ...lostFoundBodyFields,
      images: imagesArraySchema,
    })
    .partial()
    .refine(
      (body) => Object.values(body).some((val) => val !== undefined),
      {
        message: "At least one field must be provided for update",
      },
    ),
});

export const getFeedQuerySchema = z.object({
  query: z.object({
    type: z.enum(LOST_FOUND_TYPE_VALUES).optional(),
    status: z.enum(LOST_FOUND_STATUS_VALUES).optional(),
    category: z.enum(LOST_FOUND_CATEGORY_VALUES).optional(),
    search: z.string().trim().max(100).optional(),
    myPosts: z.enum(["true", "false"]).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

export const updateLostFoundStatusSchema = z.object({
  params: postIdParams,
  body: z.object({
    status: z.enum(["ACTIVE", "RESOLVED", "CLOSED"], {
      message: "Status must be ACTIVE, RESOLVED, or CLOSED",
    }),
  }),
});

export const createClaimSchema = z.object({
  params: postIdParams,
  body: z.object({
    message: z
      .string()
      .trim()
      .min(5, "Message must be at least 5 characters")
      .max(1000, "Message cannot exceed 1000 characters"),
    answer: z.string().trim().max(300).optional().nullable(),
    proofImage: z
      .union([verifiedLostFoundImageUrl, z.literal("")])
      .optional()
      .nullable(),
  }),
});

export const createLostFoundReportSchema = z.object({
  params: postIdParams,
  body: z.object({
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

export type GetLostFoundFeedQuery = z.infer<
  typeof getFeedQuerySchema
>["query"];
export type CreateLostFoundPayload = z.infer<
  typeof createLostFoundSchema
>["body"];
export type UpdateLostFoundPayload = z.infer<
  typeof updateLostFoundSchema
>["body"];
export type CreateClaimPayload = z.infer<typeof createClaimSchema>["body"];
export type CreateLostFoundReportPayload = z.infer<
  typeof createLostFoundReportSchema
>["body"];
