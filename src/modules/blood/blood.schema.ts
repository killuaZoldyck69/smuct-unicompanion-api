import { z } from "zod";
import { BLOOD_GROUP_VALUES } from "../../constants/enums";

export const createBloodPostSchema = z.object({
  body: z.object({
    patientName: z.string().min(1, "Patient name is required"),
    patientCondition: z.string().min(1, "Patient condition is required"),
    bloodGroup: z.enum(BLOOD_GROUP_VALUES, {
      message: "Valid blood group is required",
    }),
    location: z.string().min(1, "Location is required"),
    urgency: z.string().min(1, "Urgency is required"),
    contactPhone: z.string().min(1, "Contact phone is required"),
  }),
});

export const respondBloodPostSchema = z.object({
  body: z.object({
    message: z.string().optional(),
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
