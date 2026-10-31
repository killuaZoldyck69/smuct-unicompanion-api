import { z } from "zod";

export const NOTICE_CATEGORIES = [
  "ACADEMIC",
  "HOLIDAY",
  "TRANSPORT",
  "GENERAL",
] as const;

export const noticeCategoryEnum = z.enum(NOTICE_CATEGORIES);

export const createNoticeSchema = z.object({
  body: z.object({
    referenceNo: z
      .string()
      .trim()
      .min(1, "Reference / Memo number is required"),
    title: z.string().trim().min(1, "Title is required"),
    category: z
      .preprocess(
        (val) => (typeof val === "string" ? val.trim().toUpperCase() : val),
        noticeCategoryEnum.default("GENERAL"),
      )
      .default("GENERAL"),
    body: z.string().trim().min(1, "Body is required"),
    issuerName: z.string().trim().min(1, "Issuer name is required"),
    issuerDesignation: z.string().trim().min(1, "Issuer designation is required"),
    copyTo: z.array(z.string().trim().min(1)).optional().default([]),
  }),
});

export type CreateNoticePayload = z.infer<typeof createNoticeSchema>["body"];

export const updateNoticeSchema = z.object({
  params: z
    .object({
      id: z.string().uuid("Invalid notice ID format"),
    })
    .optional(),
  body: z.object({
    referenceNo: z
      .string()
      .trim()
      .min(1, "Reference number cannot be empty")
      .optional()
      .nullable(),
    title: z.string().trim().min(1, "Title cannot be empty").optional(),
    category: z
      .preprocess(
        (val) => (typeof val === "string" ? val.trim().toUpperCase() : val),
        noticeCategoryEnum.optional(),
      )
      .optional(),
    body: z.string().trim().min(1, "Body cannot be empty").optional(),
    issuerName: z.string().trim().min(1, "Issuer name cannot be empty").optional(),
    issuerDesignation: z
      .string()
      .trim()
      .min(1, "Issuer designation cannot be empty")
      .optional(),
    copyTo: z.array(z.string().trim().min(1)).optional(),
  }),
});

export type UpdateNoticePayload = z.infer<typeof updateNoticeSchema>["body"];

export const noticeIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid notice ID format"),
  }),
});

export const getNoticesQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().optional(),
    category: z.string().trim().optional(),
    sortBy: z
      .enum(["createdAt", "issueDate", "title"])
      .optional()
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  }),
});

export type GetNoticesQuery = z.infer<typeof getNoticesQuerySchema>["query"];
