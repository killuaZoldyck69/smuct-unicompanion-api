import { z } from "zod";
import { BLOOD_GROUP_VALUES } from "../../constants/enums";
import { isSafePublicHttpsUrl, urlSanitizer } from "../../utils/url-validators";

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

export const updateGoogleDriveStatusSchema = z.object({
  body: z.object({
    isConnected: z.boolean(),
    email: z.string().email("Invalid Google Drive email").optional().nullable(),
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

export const deleteMyAccountSchema = z.object({
  body: z.object({
    confirmation: z.literal("DELETE", {
      message: 'Confirmation must be exactly "DELETE".',
    }),
  }),
});

export type DeleteMyAccountPayload = z.infer<
  typeof deleteMyAccountSchema
>["body"];

export const profileImageBodySchema = z.object({
  body: z
    .object({
      image: z.string().max(4_500_000, "Base64 image payload too large").optional(),
      imageUrl: z
        .string()
        .trim()
        .max(500, "Image URL must not exceed 500 characters")
        .refine(
          (val) => !val || isSafePublicHttpsUrl(val),
          "Image URL must be a valid public HTTPS URL.",
        )
        .optional(),
    })
    .optional(),
});

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
