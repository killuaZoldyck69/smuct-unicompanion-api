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
    price: z.number().min(0, "Price must be non-negative").optional().nullable(),
    category: z.enum(MARKETPLACE_CATEGORY_VALUES, {
      message: "Invalid category selected",
    }),
    condition: z.enum(ITEM_CONDITION_VALUES).optional().nullable(),
    images: z.array(z.string().url("Invalid image URL")).default([]),
    contactPhone: z.string().max(20).optional().nullable(),
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
    price: z.number().min(0, "Price must be non-negative").optional().nullable(),
    category: z.enum(MARKETPLACE_CATEGORY_VALUES).optional(),
    condition: z.enum(ITEM_CONDITION_VALUES).optional().nullable(),
    images: z.array(z.string().url("Invalid image URL")).optional(),
    contactPhone: z.string().max(20).optional().nullable(),
  }),
});

export const createMarketplaceCommentSchema = z.object({
  body: z.object({
    content: z.string().min(1, "Comment content cannot be empty").max(1000),
    parentId: z.string().optional().nullable(),
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
