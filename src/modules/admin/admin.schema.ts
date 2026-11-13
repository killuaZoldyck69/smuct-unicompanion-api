import { z } from "zod";

export const adminCourseHubsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  department: z.string().trim().max(100).optional(),
  status: z.enum(["ALL", "ACTIVE", "ARCHIVED"]).default("ALL"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(15),
});

export type AdminCourseHubsQuery = z.infer<typeof adminCourseHubsQuerySchema>;

export const adminForumReportsQuerySchema = z.object({
  query: z.object({
    status: z
      .enum(["PENDING", "DISMISSED", "ACTIONED", "ALL"])
      .default("PENDING"),
    targetType: z
      .enum(["ALL", "FORUM_POST", "FORUM_RESPONSE", "LOST_FOUND_POST"])
      .default("ALL"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
});

export const adminResolveReportSchema = z.object({
  params: z.object({
    reportId: z.string().uuid("Invalid report ID"),
  }),
  body: z.object({
    action: z.enum(
      ["DISMISS", "HIDE_CONTENT", "DELETE_CONTENT", "RESTRICT_USER"],
      {
        message:
          "Action must be DISMISS, HIDE_CONTENT, DELETE_CONTENT, or RESTRICT_USER",
      },
    ),
    adminNote: z
      .string()
      .trim()
      .max(500, "Admin note cannot exceed 500 characters")
      .optional(),
  }),
});

export type AdminForumReportsQuery = z.infer<
  typeof adminForumReportsQuerySchema
>["query"];
export type AdminResolveReportPayload = z.infer<
  typeof adminResolveReportSchema
>["body"];
