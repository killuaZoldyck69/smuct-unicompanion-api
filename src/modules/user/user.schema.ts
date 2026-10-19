import { z } from "zod";

export const updateRoleSchema = z.object({
  body: z.object({
    action: z.enum(["MAKE_CR", "REMOVE_ROLE"], {
      message: "Invalid action. Must be MAKE_CR or REMOVE_ROLE",
    }),
  }),
});

export type UpdateRolePayload = z.infer<typeof updateRoleSchema>["body"];

export const getUsersQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    role: z.enum(["ADMIN", "STUDENT", "TEACHER"]).optional(),
    department: z.string().trim().optional(),
    tag: z.enum(["ALL", "CR"]).optional(),
    search: z.string().trim().optional(),
  }),
});

export type GetUsersQuery = z.infer<typeof getUsersQuerySchema>["query"];
