import { z } from "zod";
import { BLOOD_GROUP_VALUES } from "../../constants/enums";
import { urlSanitizer } from "../../utils/url-validators";

export const onboardStudentSchema = z.object({
  body: z.object({
    studentId: z.string().min(1, "Student ID is required"),
    faculty: z.string().min(1, "Faculty is required"),
    department: z.string().min(1, "Department is required"),
    program: z.string().min(1, "Program is required"),
    batch: z.string().min(1, "Batch is required"),
    currentSemester: z
      .number()
      .min(1)
      .max(12, "Semester must be between 1 and 12"),
    section: z.string().min(1, "Section is required"),
    currentTerm: z.string().optional(),
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
    phoneNumber: z.string().trim().max(25).nullable().optional(),
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
