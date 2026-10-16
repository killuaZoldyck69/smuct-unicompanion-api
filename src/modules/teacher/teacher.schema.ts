import { z } from "zod";
import { BLOOD_GROUP_VALUES } from "../../constants/enums";

export const registerTeacherSchema = z.object({
  body: z.object({
    teacherId: z
      .string()
      .trim()
      .min(1, "Teacher ID is required")
      .regex(/^\d+$/, "Teacher ID must be a valid numeric integer"),
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .transform((val) =>
        val.replace(/\s+/g, " ").replace(/(?:^|\s)\S/g, (c) => c.toUpperCase())
      ),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Must be a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter (A-Z)")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter (a-z)")
      .regex(/[0-9]/, "Password must contain at least one number (0-9)")
      .regex(
        /[^A-Za-z0-9]/,
        "Password must contain at least one special character (e.g. !@#$%^&*)",
      ),
    designation: z
      .string()
      .trim()
      .min(1, "Designation is required (e.g., Lecturer, Professor)"),
    department: z.string().trim().min(1, "Department is required"),
    faculty: z.string().trim().min(1, "Faculty is required"),
    officeRoom: z
      .string()
      .trim()
      .regex(/^\d*$/, "Office room must contain numbers only")
      .optional()
      .nullable(),
    dayOff: z.string().trim().nullable().optional(),
    consultationHours: z.string().nullable().optional(),
    advisoryBatch: z
      .union([z.number(), z.string().regex(/^\d+$/).transform(Number)])
      .nullable()
      .optional(),
    consultationSlots: z
      .array(
        z.object({
          day: z.string(),
          startTime: z.string(),
          endTime: z.string(),
        }),
      )
      .nullable()
      .optional(),
    expertiseFields: z.array(z.string()).optional(),
    academicQualifications: z.any().optional(),
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
    faculty: z.string().trim().optional(),
    officeRoom: z
      .string()
      .trim()
      .regex(/^\d*$/, "Office room must contain numbers only")
      .optional()
      .nullable(),
    consultationHours: z.string().nullable().optional(),
    advisoryBatch: z
      .union([z.number(), z.string().regex(/^\d+$/).transform(Number)])
      .nullable()
      .optional(),
    dayOff: z.string().trim().nullable().optional(),
    consultationSlots: z
      .array(
        z.object({
          day: z.string(),
          startTime: z.string(),
          endTime: z.string(),
        }),
      )
      .nullable()
      .optional(),
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
