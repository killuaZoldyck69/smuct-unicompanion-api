import { z } from "zod";
import { BLOOD_GROUP_VALUES } from "../../constants/enums";

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

const urlSanitizer = z
  .string()
  .trim()
  .max(300, "URL must not exceed 300 characters")
  .transform((val) => {
    if (!val) return "";
    return /^https?:\/\//i.test(val) ? val : `https://${val}`;
  })
  .pipe(
    z
      .string()
      .url("Must be a valid URL")
      .refine(
        (url) => !url || /^https?:\/\//i.test(url),
        "URL must use http or https protocol",
      )
      .or(z.literal("")),
  );

export const adminUpdateStudentProfileSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, "Name cannot be empty").optional(),
    phoneNumber: z.string().trim().nullable().optional(),
    bloodGroup: z.enum(BLOOD_GROUP_VALUES).nullable().optional(),
    studentId: z.string().trim().min(1, "Student ID cannot be empty").optional(),
    faculty: z.string().trim().optional(),
    department: z.string().trim().optional(),
    program: z.string().trim().optional(),
    batch: z.string().trim().optional(),
    currentSemester: z.number().int().min(1).max(12).optional(),
    section: z.string().trim().optional(),
    currentTerm: z.string().trim().nullable().optional(),
    isCR: z.boolean().optional(),
    skills: z.array(z.string()).optional(),
    linkedInUrl: urlSanitizer.optional().nullable(),
    personalWebsiteUrl: urlSanitizer.optional().nullable(),
  }),
});

export type AdminUpdateStudentProfilePayload = z.infer<
  typeof adminUpdateStudentProfileSchema
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
