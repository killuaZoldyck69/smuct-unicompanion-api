import { z } from "zod";
import { BLOOD_GROUP_VALUES } from "../../constants/enums";

export const registerTeacherSchema = z.object({
  body: z.object({
    teacherId: z.string().min(1, "Teacher ID is required"),
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email format"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    designation: z
      .string()
      .min(1, "Designation is required (e.g., Lecturer, Professor)"),
    department: z.string().min(1, "Department is required"),
    faculty: z.string().min(1, "Faculty is required"),
  }),
});

export type RegisterTeacherPayload = z.infer<
  typeof registerTeacherSchema
>["body"];

export const updateTeacherProfileSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    phoneNumber: z.string().optional(),
    bloodGroup: z.enum(BLOOD_GROUP_VALUES).optional(),
    designation: z.string().optional(),
    department: z.string().optional(),
    faculty: z.string().optional(),
    officeRoom: z.string().optional(),
    consultationHours: z.string().optional(),
    expertiseFields: z.array(z.string()).optional(),
    academicQualifications: z.record(z.string(), z.any()).optional(),
    linkedInUrl: z
      .string()
      .url("Must be a valid URL")
      .or(z.literal(""))
      .optional(),
    personalWebsiteUrl: z
      .string()
      .url("Must be a valid URL")
      .or(z.literal(""))
      .optional(),
  }),
});

export type UpdateTeacherPayload = z.infer<
  typeof updateTeacherProfileSchema
>["body"];

export const updateTeacherImageSchema = z.object({
  body: z.object({
    imageUrl: z.string().url("Must be a valid URL"),
  }),
});

export type UpdateTeacherImagePayload = z.infer<
  typeof updateTeacherImageSchema
>["body"];
