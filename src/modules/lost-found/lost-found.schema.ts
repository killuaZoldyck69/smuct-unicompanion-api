import { z } from "zod";
import {
  LOST_FOUND_TYPE_VALUES,
  LOST_FOUND_STATUS_VALUES,
  LOST_FOUND_CATEGORY_VALUES,
} from "../../constants/enums";

export const createLostFoundSchema = z.object({
  body: z.object({
    type: z.enum(LOST_FOUND_TYPE_VALUES, {
      message: "Type must be LOST or FOUND",
    }),
    title: z.string().min(2, "Title must be at least 2 characters").max(150),
    description: z.string().min(5, "Description must be at least 5 characters"),
    category: z.enum(LOST_FOUND_CATEGORY_VALUES, {
      message: "Invalid category selected",
    }),
    location: z.string().min(2, "Location is required").max(150),
    images: z.array(z.string().url("Invalid image URL")).default([]),
  }),
});

export const updateLostFoundStatusSchema = z.object({
  body: z.object({
    status: z.enum(LOST_FOUND_STATUS_VALUES, {
      message: "Invalid status",
    }),
  }),
});

export const createLostFoundCommentSchema = z.object({
  body: z.object({
    content: z.string().min(1, "Comment content cannot be empty").max(1000),
    parentId: z.string().optional().nullable(),
  }),
});

export type CreateLostFoundPayload = z.infer<
  typeof createLostFoundSchema
>["body"];
export type UpdateLostFoundStatusPayload = z.infer<
  typeof updateLostFoundStatusSchema
>["body"];
export type CreateLostFoundCommentPayload = z.infer<
  typeof createLostFoundCommentSchema
>["body"];
