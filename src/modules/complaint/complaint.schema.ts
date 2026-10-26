import { z } from "zod";
import { COMPLAINT_STATUS_VALUES } from "../../constants/enums";

export const complaintIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid complaint ID format"),
  }),
});

export const createComplaintSchema = z.object({
  body: z.object({
    title: z
      .string({ message: "Title is required" })
      .trim()
      .min(3, "Title must be at least 3 characters")
      .max(150, "Title cannot exceed 150 characters"),
    description: z
      .string({ message: "Description is required" })
      .trim()
      .min(10, "Description must be at least 10 characters")
      .max(2000, "Description cannot exceed 2000 characters"),
    category: z
      .string({ message: "Category is required" })
      .trim()
      .min(2, "Category must be at least 2 characters")
      .max(50, "Category cannot exceed 50 characters"),
    isAnonymous: z.boolean().default(false).optional(),
  }),
});

export const updateComplaintSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid complaint ID format"),
  }),
  body: z
    .object({
      title: z
        .string()
        .trim()
        .min(3, "Title must be at least 3 characters")
        .max(150, "Title cannot exceed 150 characters")
        .optional(),
      description: z
        .string()
        .trim()
        .min(10, "Description must be at least 10 characters")
        .max(2000, "Description cannot exceed 2000 characters")
        .optional(),
      category: z
        .string()
        .trim()
        .min(2, "Category must be at least 2 characters")
        .max(50, "Category cannot exceed 50 characters")
        .optional(),
      isAnonymous: z.boolean().optional(),
    })
    .refine(
      (data) => Object.keys(data).length > 0,
      "At least one field must be provided for update",
    ),
});

export const updateComplaintStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid complaint ID format"),
  }),
  body: z.object({
    status: z.enum(COMPLAINT_STATUS_VALUES, {
      message: "Status must be PENDING, ACCEPTED, RESOLVED, or REJECTED",
    }),
    adminRemarks: z
      .string()
      .trim()
      .max(1500, "Remarks cannot exceed 1500 characters")
      .nullable()
      .optional(),
  }),
});

export const getMyComplaintsQuerySchema = z.object({
  query: z.object({
    status: z.enum([...COMPLAINT_STATUS_VALUES, "ALL"]).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
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

export type ComplaintIdParamPayload = z.infer<
  typeof complaintIdParamSchema
>["params"];
export type CreateComplaintPayload = z.infer<
  typeof createComplaintSchema
>["body"];
export type UpdateComplaintPayload = z.infer<
  typeof updateComplaintSchema
>["body"];
export type UpdateComplaintStatusPayload = z.infer<
  typeof updateComplaintStatusSchema
>["body"];
export type GetMyComplaintsQueryPayload = z.infer<
  typeof getMyComplaintsQuerySchema
>["query"];
export type AdminComplaintsQueryPayload = z.infer<
  typeof adminComplaintsQuerySchema
>["query"];

