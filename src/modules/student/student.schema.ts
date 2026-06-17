import { z } from "zod";

export const onboardStudentSchema = z.object({
  body: z.object({
    studentId: z.string().min(1, "Student ID is required"),
    department: z.string().min(1, "Department is required"),
    batch: z.string().min(1, "Batch is required"),
    currentSemester: z
      .number()
      .min(1)
      .max(12, "Semester must be between 1 and 12"),
    section: z.string().optional(),
  }),
});

export const updateProfileImageSchema = z.object({
  body: z.object({
    imageUrl: z.string().url("Must be a valid URL"),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    phoneNumber: z.string().optional(),
    batch: z.string().optional(),
    currentSemester: z.number().min(1).max(12).optional(),
    section: z.string().optional(),
    bloodGroup: z
      .enum([
        "A_POSITIVE",
        "A_NEGATIVE",
        "B_POSITIVE",
        "B_NEGATIVE",
        "AB_POSITIVE",
        "AB_NEGATIVE",
        "O_POSITIVE",
        "O_NEGATIVE",
      ])
      .optional(),
  }),
});
