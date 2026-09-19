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
    verificationQuestion: z.string().max(200).optional().nullable(),
    verificationAnswer: z.string().max(200).optional().nullable(),
  }),
});

export const updateLostFoundStatusSchema = z.object({
  body: z.object({
    status: z.enum(LOST_FOUND_STATUS_VALUES, {
      message: "Invalid status",
    }),
  }),
});

export const createClaimSchema = z.object({
  body: z.object({
    message: z
      .string()
      .min(5, "Message must be at least 5 characters")
      .max(1000, "Message cannot exceed 1000 characters"),
    answer: z.string().max(300).optional().nullable(),
    proofImage: z.string().url("Invalid proof image URL").optional().nullable(),
  }),
});

export type CreateLostFoundPayload = z.infer<
  typeof createLostFoundSchema
>["body"];
export type UpdateLostFoundStatusPayload = z.infer<
  typeof updateLostFoundStatusSchema
>["body"];
export type CreateClaimPayload = z.infer<typeof createClaimSchema>["body"];

