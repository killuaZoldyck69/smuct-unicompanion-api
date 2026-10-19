import { z } from "zod";

export const updateRoleSchema = z.object({
  body: z.object({
    action: z.enum(["MAKE_CR", "REMOVE_ROLE"], {
      message: "Invalid action. Must be MAKE_CR or REMOVE_ROLE",
    }),
  }),
});

export const restrictUserSchema = z.object({
  body: z.object({
    isRestricted: z.boolean().default(true),
  }),
});

export type RestrictUserPayload = z.infer<typeof restrictUserSchema>["body"];

export type UpdateRolePayload = z.infer<typeof updateRoleSchema>["body"];

export const updateTeacherPositionSchema = z.object({
  body: z.object({
    designation: z
      .string()
      .trim()
      .min(2, "Designation must be at least 2 characters")
      .optional(),
    administrativeRole: z.string().trim().nullable().optional(),
  }),
});

export type UpdateTeacherPositionPayload = z.infer<
  typeof updateTeacherPositionSchema
>["body"];

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
