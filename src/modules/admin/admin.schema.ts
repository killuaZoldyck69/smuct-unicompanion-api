import { z } from "zod";

export const adminCourseHubsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  department: z.string().trim().max(100).optional(),
  status: z.enum(["ALL", "ACTIVE", "ARCHIVED"]).default("ALL"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(15),
});

export type AdminCourseHubsQuery = z.infer<typeof adminCourseHubsQuerySchema>;
