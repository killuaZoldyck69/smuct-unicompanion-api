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
      message: "Status must be PENDING, ACCEPTED, RESOLVED, or REJECTED",
    }),
    adminRemarks: z.string().trim().max(1500, "Remarks cannot exceed 1500 characters").nullable().optional(),
  }),
});

export const adminComplaintsQuerySchema = z.object({
  query: z.object({
    status: z.enum([...COMPLAINT_STATUS_VALUES, "ALL"]).optional(),
    search: z.string().trim().optional(),
    category: z.string().trim().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
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
export type AdminComplaintsQueryPayload = z.infer<
  typeof adminComplaintsQuerySchema
>["query"];

