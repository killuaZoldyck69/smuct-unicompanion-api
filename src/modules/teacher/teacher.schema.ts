import { z } from "zod";
import { BLOOD_GROUP_VALUES } from "../../constants/enums";

export const academicQualificationItemSchema = z.object({
  id: z.string().optional(),
  degree: z.string().trim().max(100).optional(),
  field: z.string().trim().max(150).optional().nullable(),
  institution: z.string().trim().max(200).optional().nullable(),
  passingYear: z.union([z.string().trim().max(10), z.number()]).optional().nullable(),
  year: z.union([z.string().trim().max(10), z.number()]).optional().nullable(),
  honors: z.string().optional().nullable(),
});

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

export const registerTeacherSchema = z.object({
  body: z.object({
    teacherId: z
      .string()
      .trim()
      .min(1, "Teacher ID is required")
      .max(20, "Teacher ID must not exceed 20 characters")
      .regex(/^\d+$/, "Teacher ID must be a valid numeric integer"),
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters long")
      .max(100, "Name must not exceed 100 characters")
      .transform((val) =>
        val.replace(/\s+/g, " ").replace(/(?:^|\s)\S/g, (c) => c.toUpperCase())
      ),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Must be a valid email address")
      .max(150, "Email must not exceed 150 characters"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .max(100, "Password must not exceed 100 characters")
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
      .min(1, "Designation is required (e.g., Lecturer, Professor)")
      .max(100, "Designation must not exceed 100 characters"),
    department: z
      .string()
      .trim()
      .min(1, "Department is required")
      .max(100, "Department must not exceed 100 characters"),
    faculty: z
      .string()
      .trim()
      .min(1, "Faculty is required")
      .max(100, "Faculty must not exceed 100 characters"),
    officeRoom: z
      .string()
      .trim()
      .max(20, "Office room must not exceed 20 characters")
      .regex(/^\d*$/, "Office room must contain numbers only")
      .optional()
      .nullable(),
    dayOff: z.string().trim().max(50).nullable().optional(),
    consultationHours: z.string().max(250).nullable().optional(),
    advisoryBatch: z
      .union([
        z.number().int().positive().max(99999),
        z
          .string()
          .trim()
          .regex(/^\d+$/)
          .transform(Number)
          .pipe(z.number().int().positive().max(99999)),
      ])
      .nullable()
      .optional(),
    consultationSlots: z
      .array(
        z.object({
          day: z.string().trim().max(30),
          startTime: z.string().trim().max(20),
          endTime: z.string().trim().max(20),
        }),
      )
      .max(50, "Maximum 50 consultation slots allowed")
      .nullable()
      .optional(),
    expertiseFields: z
      .array(z.string().trim().min(1).max(100))
      .max(50, "Maximum 50 expertise fields allowed")
      .optional(),
    academicQualifications: z
      .array(academicQualificationItemSchema)
      .max(20, "Maximum 20 academic qualifications allowed")
      .optional()
      .nullable(),
    linkedInUrl: urlSanitizer.optional().nullable(),
    personalWebsiteUrl: urlSanitizer.optional().nullable(),
  }),
});

export type RegisterTeacherPayload = z.infer<
  typeof registerTeacherSchema
>["body"];

export const updateTeacherProfileSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    phoneNumber: z.string().trim().max(25).nullable().optional(),
    bloodGroup: z.enum(BLOOD_GROUP_VALUES).nullable().optional(),
    designation: z.string().trim().max(100).optional(),
    administrativeRole: z.string().trim().max(100).nullable().optional(),
    department: z.string().trim().max(100).optional(),
    faculty: z.string().trim().max(100).optional(),
    officeRoom: z
      .string()
      .trim()
      .max(20)
      .regex(/^\d*$/, "Office room must contain numbers only")
      .optional()
      .nullable(),
    consultationHours: z.string().max(250).nullable().optional(),
    advisoryBatch: z
      .union([
        z.number().int().positive().max(99999),
        z
          .string()
          .trim()
          .regex(/^\d+$/)
          .transform(Number)
          .pipe(z.number().int().positive().max(99999)),
      ])
      .nullable()
      .optional(),
    dayOff: z.string().trim().max(50).nullable().optional(),
    consultationSlots: z
      .array(
        z.object({
          day: z.string().trim().max(30),
          startTime: z.string().trim().max(20),
          endTime: z.string().trim().max(20),
        }),
      )
      .max(50)
      .nullable()
      .optional(),
    expertiseFields: z
      .array(z.string().trim().min(1).max(100))
      .max(50)
      .optional(),
    academicQualifications: z
      .array(academicQualificationItemSchema)
      .max(20)
      .optional()
      .nullable(),
    linkedInUrl: urlSanitizer.optional().nullable(),
    personalWebsiteUrl: urlSanitizer.optional().nullable(),
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
