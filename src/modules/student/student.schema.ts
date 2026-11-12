import { z } from "zod";
import { BLOOD_GROUP_VALUES } from "../../constants/enums";
import { phoneNumberSanitizer, urlSanitizer } from "../../utils/url-validators";

export const onboardStudentSchema = z.object({
  body: z.object({
    studentId: z
      .string()
      .trim()
      .regex(/^\d{9}$/, "Student ID must be exactly 9 digits"),
    faculty: z.string().trim().min(2, "Faculty is required").max(120),
    department: z.string().trim().min(2, "Department is required").max(120),
    program: z.string().trim().min(2, "Program is required").max(150),
    batch: z
      .string()
      .trim()
      .regex(/^\d{1,3}$/, "Batch must be 1 to 3 digits"),
    currentSemester: z
      .number()
      .int()
      .min(1)
      .max(12, "Semester must be between 1 and 12"),
    section: z
      .string()
      .trim()
      .min(1, "Section is required")
      .max(10, "Section cannot exceed 10 characters")
      .transform((val) => val.toUpperCase()),
    currentTerm: z.string().trim().max(40).optional(),
    phoneNumber: phoneNumberSanitizer.optional().nullable(),
    bloodGroup: z.enum(BLOOD_GROUP_VALUES).nullable().optional(),
  }),
});

export const updateProfileImageSchema = z.object({
  body: z.object({
    imageUrl: z.string().url("Must be a valid URL"),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    phoneNumber: phoneNumberSanitizer.optional().nullable(),
    batch: z.string().trim().max(20).optional(),
    currentSemester: z.number().int().min(1).max(12).optional(),
    section: z.string().trim().min(1).max(10).optional(),
    currentTerm: z.string().trim().max(40).nullable().optional(),
    bloodGroup: z.enum(BLOOD_GROUP_VALUES).nullable().optional(),
    faculty: z.string().trim().max(120).optional(),
    program: z.string().trim().max(150).optional(),
    skills: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
    linkedInUrl: urlSanitizer.optional().nullable(),
    personalWebsiteUrl: urlSanitizer.optional().nullable(),
  }),
});

export type OnboardStudentPayload = z.infer<typeof onboardStudentSchema>["body"];
export type UpdateProfileImagePayload = z.infer<typeof updateProfileImageSchema>["body"];
export type UpdateProfilePayload = z.infer<typeof updateProfileSchema>["body"];
