import { z } from "zod";
import { COMPLAINT_STATUS_VALUES } from "../../constants/enums";

export const createComplaintSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),
    category: z.string().min(1, "Category is required"),
  }),
});

export const updateComplaintStatusSchema = z.object({
  body: z.object({
    status: z.enum(COMPLAINT_STATUS_VALUES, {
      message: "Status must be PENDING, RESOLVED, or REJECTED",
    }),
  }),
});

export type CreateComplaintPayload = z.infer<
  typeof createComplaintSchema
>["body"];
export type UpdateComplaintStatusPayload = z.infer<
  typeof updateComplaintStatusSchema
>["body"];
