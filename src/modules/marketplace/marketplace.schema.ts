import { z } from "zod";
import {
  ITEM_CONDITION_VALUES,
  LISTING_STATUS_VALUES,
  LISTING_TYPE_VALUES,
  MARKETPLACE_CATEGORY_VALUES,
} from "../../constants/enums";
import {
  buildOptimizedUrl,
  extractPublicIdFromUrl,
  isAllowedAppCloudinaryImageUrl,
} from "../../lib/cloudinary";
import {
  MARKETPLACE_CLOUDINARY_PREFIX,
  MAX_MARKETPLACE_COMMENT_LENGTH,
  MAX_MARKETPLACE_DESCRIPTION_HTML_LENGTH,
  MAX_MARKETPLACE_IMAGES,
  MAX_MARKETPLACE_TITLE_LENGTH,
  MIN_MARKETPLACE_COMMENT_LENGTH,
  MIN_MARKETPLACE_TITLE_LENGTH,
} from "./marketplace.domain";

const BD_PHONE_REGEX = /^\+8801[3-9]\d{8}$/;

const emptyToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
    schema,
  );

const nonNullPriceSchema = z.preprocess(
  (val) => (typeof val === "string" && val.trim() !== "" ? Number(val) : val),
  z
    .number({ message: "Price must be a non-negative number in BDT" })
    .finite("Price must be a finite number")
    .min(0, "Price must be a non-negative number in BDT")
    .max(10000000, "Price exceeds allowable limit"),
);

const verifiedMarketplaceImageUrl = z
  .string()
  .trim()
  .max(1000, "Image URL exceeds maximum allowed length")
  .url("Invalid image URL")
  .refine(
    (url) =>
      url.match(/https?:\/\//g)?.length === 1 &&
      isAllowedAppCloudinaryImageUrl(url, [MARKETPLACE_CLOUDINARY_PREFIX]),
    {
      message:
        "Image URL must be a verified SMUCT UniCompanion Cloudinary Marketplace asset.",
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

const postIdParams = z.object({
  id: z.string().uuid("Invalid Marketplace listing ID"),
});

const commentRouteParams = postIdParams.extend({
  commentId: z.string().uuid("Invalid comment ID"),
});

const phoneField = z
  .string({ message: "Contact phone number is required" })
  .trim()
  .length(
    14,
    "Phone number must be exactly 14 characters (e.g. +8801956014045)",
  )
  .regex(
    BD_PHONE_REGEX,
    "Invalid Bangladeshi phone number. Must start with +8801 followed by 9 digits (e.g. +8801956014045)",
  );

export const marketplaceIdParamSchema = z.object({
  params: postIdParams,
});

export const marketplaceCommentParamSchema = z.object({
  params: commentRouteParams,
});

export const getMarketplaceFeedQuerySchema = z.object({
  query: z.object({
    type: emptyToUndefined(z.enum(LISTING_TYPE_VALUES).optional()),
    status: emptyToUndefined(z.enum(LISTING_STATUS_VALUES).optional()),
    category: emptyToUndefined(z.enum(MARKETPLACE_CATEGORY_VALUES).optional()),
    search: emptyToUndefined(z.string().trim().max(100).optional()),
    myPosts: emptyToUndefined(z.enum(["true", "false"]).optional()),
    cursor: emptyToUndefined(z.string().uuid("Invalid cursor ID").optional()),
    limit: emptyToUndefined(z.coerce.number().int().min(1).max(50).optional()),
  }),
});

export const createMarketplaceSchema = z.object({
  body: z.object({
    type: z.enum(LISTING_TYPE_VALUES, {
      message: "Type must be SELLING or BUYING",
    }),
    title: z
      .string()
      .trim()
      .min(
        MIN_MARKETPLACE_TITLE_LENGTH,
        `Title must be at least ${MIN_MARKETPLACE_TITLE_LENGTH} characters`,
      )
      .max(MAX_MARKETPLACE_TITLE_LENGTH),
    description: z
      .string()
      .trim()
      .min(1, "Description is required")
      .max(
        MAX_MARKETPLACE_DESCRIPTION_HTML_LENGTH,
        "Description payload exceeds maximum allowed size",
      ),
    price: nonNullPriceSchema.optional().default(0),
    category: z.enum(MARKETPLACE_CATEGORY_VALUES, {
      message: "Invalid category selected",
    }),
    condition: z.enum(ITEM_CONDITION_VALUES).optional().nullable(),
    images: z
      .array(verifiedMarketplaceImageUrl)
      .max(
        MAX_MARKETPLACE_IMAGES,
        `Maximum ${MAX_MARKETPLACE_IMAGES} photos allowed for marketplace listings`,
      )
      .optional()
      .default([]),
    contactPhone: phoneField,
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
  }),
});

export const updateMarketplaceStatusSchema = z.object({
  params: postIdParams,
  body: z.object({
    status: z.enum(LISTING_STATUS_VALUES, {
      message: "Status must be ACTIVE, SOLD, or CLOSED",
    }),
  }),
});

export const updateMarketplaceSchema = z.object({
  params: postIdParams,
  body: z
    .object({
      type: z.enum(LISTING_TYPE_VALUES).optional(),
      title: z
        .string()
        .trim()
        .min(
          MIN_MARKETPLACE_TITLE_LENGTH,
          `Title must be at least ${MIN_MARKETPLACE_TITLE_LENGTH} characters`,
        )
        .max(MAX_MARKETPLACE_TITLE_LENGTH)
        .optional(),
      description: z
        .string()
        .trim()
        .min(1, "Description cannot be empty")
        .max(
          MAX_MARKETPLACE_DESCRIPTION_HTML_LENGTH,
          "Description payload exceeds maximum allowed size",
        )
        .optional(),
      price: nonNullPriceSchema.optional(),
      category: z.enum(MARKETPLACE_CATEGORY_VALUES).optional(),
      condition: z.enum(ITEM_CONDITION_VALUES).optional().nullable(),
      images: z
        .array(verifiedMarketplaceImageUrl)
        .max(
          MAX_MARKETPLACE_IMAGES,
          `Maximum ${MAX_MARKETPLACE_IMAGES} photos allowed for marketplace listings`,
        )
        .optional(),
      contactPhone: phoneField.optional(),
    })
    .refine((body) => Object.values(body).some((val) => val !== undefined), {
      message: "At least one field must be provided for update",
    }),
});

export const createMarketplaceCommentSchema = z.object({
  params: postIdParams,
  body: z.object({
    content: z
      .string()
      .trim()
      .min(MIN_MARKETPLACE_COMMENT_LENGTH, "Comment content cannot be empty")
      .max(
        MAX_MARKETPLACE_COMMENT_LENGTH,
        `Comment cannot exceed ${MAX_MARKETPLACE_COMMENT_LENGTH} characters`,
      ),
    parentId: emptyToUndefined(
      z.string().uuid("Invalid parent comment ID").optional().nullable(),
    ),
  }),
});

export const updateMarketplaceCommentSchema = z.object({
  params: commentRouteParams,
  body: z.object({
    content: z
      .string()
      .trim()
      .min(MIN_MARKETPLACE_COMMENT_LENGTH, "Comment content cannot be empty")
      .max(
        MAX_MARKETPLACE_COMMENT_LENGTH,
        `Comment cannot exceed ${MAX_MARKETPLACE_COMMENT_LENGTH} characters`,
      ),
  }),
});

export const createMarketplaceReportSchema = z.object({
  body: z.object({
    targetType: z.enum(["MARKETPLACE_POST", "MARKETPLACE_COMMENT"], {
      message: "targetType must be MARKETPLACE_POST or MARKETPLACE_COMMENT",
    }),
    targetId: z.string().uuid("Invalid target ID"),
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

export type GetMarketplaceFeedQuery = z.infer<
  typeof getMarketplaceFeedQuerySchema
>["query"];
export type CreateMarketplacePayload = z.infer<
  typeof createMarketplaceSchema
>["body"];
export type UpdateMarketplacePayload = z.infer<
  typeof updateMarketplaceSchema
>["body"];
export type UpdateMarketplaceStatusPayload = z.infer<
  typeof updateMarketplaceStatusSchema
>["body"];
export type CreateMarketplaceCommentPayload = z.infer<
  typeof createMarketplaceCommentSchema
>["body"];
export type UpdateMarketplaceCommentPayload = z.infer<
  typeof updateMarketplaceCommentSchema
>["body"];
export type CreateMarketplaceReportPayload = z.infer<
  typeof createMarketplaceReportSchema
>["body"];
