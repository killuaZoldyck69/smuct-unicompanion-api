import { z } from "zod";
import { BLOOD_GROUP_VALUES } from "../../constants/enums";

export const createBloodPostSchema = z.object({
  body: z.object({
    patientName: z
      .string()
      .trim()
      .min(2, "Patient name must be at least 2 characters")
      .max(100, "Patient name cannot exceed 100 characters"),
    patientCondition: z
      .string()
      .trim()
      .min(2, "Patient condition is required")
      .max(150, "Patient condition cannot exceed 150 characters"),
    bloodGroup: z.enum(BLOOD_GROUP_VALUES, {
      message: "Valid blood group is required",
    }),
    bagsNeeded: z
      .coerce
      .number()
      .int()
      .min(1, "At least 1 bag is required")
      .max(50, "Bags cannot exceed 50")
      .default(1)
      .optional(),
    location: z
      .string()
      .trim()
      .min(2, "Location is required")
      .max(300, "Location cannot exceed 300 characters"),
    hospitalName: z.string().trim().max(150).optional(),
    hospitalAddress: z.string().trim().max(300).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    details: z
      .string()
      .trim()
      .max(1000, "Details cannot exceed 1000 characters")
      .optional(),
    urgency: z.string().trim().min(1, "Urgency is required").max(50),
    contactPhone: z
      .string()
      .trim()
      .min(6, "Contact phone must be at least 6 characters")
      .max(25, "Contact phone cannot exceed 25 characters"),
  }),
});

export const respondBloodPostSchema = z.object({
  body: z.object({
    message: z
      .string()
      .trim()
      .max(500, "Message cannot exceed 500 characters")
      .optional(),
  }),
});

export const getBloodFeedQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    bloodGroup: z.enum(BLOOD_GROUP_VALUES).optional(),
    urgency: z.string().optional(),
    isFulfilled: z.enum(["true", "false"]).optional(),
    myPosts: z.enum(["true", "false"]).optional(),
  }).optional(),
});

export type CreateBloodPostPayload = z.infer<
  typeof createBloodPostSchema
>["body"];
export type RespondBloodPostPayload = z.infer<
  typeof respondBloodPostSchema
>["body"];
export type GetBloodFeedQueryParams = z.infer<
  typeof getBloodFeedQuerySchema
>["query"];
