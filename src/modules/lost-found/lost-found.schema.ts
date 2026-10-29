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
    description: z.string().max(3000).optional().nullable(),
    category: z.enum(LOST_FOUND_CATEGORY_VALUES, {
      message: "Invalid category selected",
    }),
    location: z.string().max(150).optional().nullable(),
    images: z
      .array(z.string().url("Invalid image URL"))
      .max(2, "Maximum 2 photos allowed for Lost & Found items")
      .default([]),
    verificationQuestion: z.string().max(200).optional().nullable(),
    verificationAnswer: z.string().max(200).optional().nullable(),
  }),
});

export const updateLostFoundSchema = z.object({
  body: z.object({
    type: z.enum(LOST_FOUND_TYPE_VALUES, {
      message: "Type must be LOST or FOUND",
    }).optional(),
    title: z.string().min(2, "Title must be at least 2 characters").max(150).optional(),
    description: z.string().max(3000).optional().nullable(),
    category: z.enum(LOST_FOUND_CATEGORY_VALUES, {
      message: "Invalid category selected",
    }).optional(),
    location: z.string().max(150).optional().nullable(),
    images: z
      .array(z.string().url("Invalid image URL"))
      .max(2, "Maximum 2 photos allowed for Lost & Found items")
      .optional(),
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
    proofImage: z
      .string()
      .max(1000)
      .refine(
        (val) => {
          if (!val || !val.trim()) return true;
          const trimmed = val.trim();
          const matches = trimmed.match(/https?:\/\//g);
          if (!matches || matches.length !== 1) return false;
          try {
            const parsed = new URL(trimmed);
            return parsed.protocol === "http:" || parsed.protocol === "https:";
          } catch {
            return false;
          }
        },
        { message: "Invalid proof image URL. Exactly 1 proof photo is allowed." }
      )
      .optional()
      .nullable(),
  }),
});

export type CreateLostFoundPayload = z.infer<
  typeof createLostFoundSchema
>["body"];
export type UpdateLostFoundPayload = z.infer<
  typeof updateLostFoundSchema
>["body"];
export type UpdateLostFoundStatusPayload = z.infer<
  typeof updateLostFoundStatusSchema
>["body"];
export type CreateClaimPayload = z.infer<typeof createClaimSchema>["body"];

