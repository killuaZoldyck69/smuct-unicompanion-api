import { z } from "zod";
import {
  LISTING_TYPE_VALUES,
  LISTING_STATUS_VALUES,
  ITEM_CONDITION_VALUES,
  MARKETPLACE_CATEGORY_VALUES,
} from "../../constants/enums";

export const createMarketplaceSchema = z.object({
  body: z.object({
    type: z.enum(LISTING_TYPE_VALUES, {
      message: "Type must be SELLING or BUYING",
    }),
    title: z.string().min(2, "Title must be at least 2 characters").max(150),
    description: z.string().min(5, "Description must be at least 5 characters"),
    price: z.coerce
      .number({ message: "Price is required in BDT" })
      .min(0, "Price must be a non-negative number in BDT")
      .max(10000000, "Price exceeds allowable limit"),
    category: z.enum(MARKETPLACE_CATEGORY_VALUES, {
      message: "Invalid category selected",
    }),
    condition: z.enum(ITEM_CONDITION_VALUES).optional().nullable(),
    images: z
      .array(z.string().url("Invalid image URL"))
      .max(4, "Maximum 4 photos allowed for marketplace listings")
      .default([]),
    contactPhone: z
      .string({ message: "Contact phone number is required" })
      .trim()
      .length(
        14,
        "Phone number must be exactly 14 characters (e.g. +8801956014045)"
      )
      .regex(
        /^\+8801[3-9]\d{8}$/,
        "Invalid Bangladeshi phone number. Must start with +8801 followed by 9 digits (e.g. +8801956014045)"
      ),
  }),
});

export const updateMarketplaceStatusSchema = z.object({
  body: z.object({
    status: z.enum(LISTING_STATUS_VALUES, {
      message: "Invalid status",
    }),
  }),
});

export const updateMarketplaceSchema = z.object({
  body: z.object({
    type: z.enum(LISTING_TYPE_VALUES).optional(),
    title: z.string().min(2, "Title must be at least 2 characters").max(150).optional(),
    description: z.string().min(5, "Description must be at least 5 characters").optional(),
    price: z.coerce
      .number()
      .min(0, "Price must be a non-negative number in BDT")
      .max(10000000, "Price exceeds allowable limit")
      .optional()
      .nullable(),
    category: z.enum(MARKETPLACE_CATEGORY_VALUES).optional(),
    condition: z.enum(ITEM_CONDITION_VALUES).optional().nullable(),
    images: z
      .array(z.string().url("Invalid image URL"))
      .max(4, "Maximum 4 photos allowed for marketplace listings")
      .optional(),
    contactPhone: z
      .string()
      .trim()
      .length(
        14,
        "Phone number must be exactly 14 characters (e.g. +8801956014045)"
      )
      .regex(
        /^\+8801[3-9]\d{8}$/,
        "Invalid Bangladeshi phone number. Must start with +8801 followed by 9 digits (e.g. +8801956014045)"
      )
      .optional(),
  }),
});

export const createMarketplaceCommentSchema = z.object({
  body: z.object({
    content: z.string().min(1, "Comment content cannot be empty").max(1000),
    parentId: z.string().optional().nullable(),
  }),
});

export const updateMarketplaceCommentSchema = z.object({
  body: z.object({
    content: z.string().min(1, "Comment content cannot be empty").max(1000),
  }),
});

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
