import { z } from "zod";
import { COMPLAINT_STATUS_VALUES } from "../../constants/enums";

export const createComplaintSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),
    category: z.string().min(1, "Category is required"),
    isAnonymous: z.boolean().default(false).optional(),
  }),
});

export const updateComplaintSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Title is required").optional(),
    description: z.string().min(1, "Description is required").optional(),
    category: z.string().min(1, "Category is required").optional(),
    isAnonymous: z.boolean().optional(),
  }),
});

export const updateComplaintStatusSchema = z.object({
  body: z.object({
    status: z.enum(COMPLAINT_STATUS_VALUES, {
      message: "Status must be PENDING, RESOLVED, or REJECTED",
    }),
    adminRemarks: z.string().nullable().optional(),
  }),
});

export type CreateComplaintPayload = z.infer<
  typeof createComplaintSchema
>["body"];
export type UpdateComplaintPayload = z.infer<
  typeof updateComplaintSchema
>["body"];
export type UpdateComplaintStatusPayload = z.infer<
  typeof updateComplaintStatusSchema
>["body"];
