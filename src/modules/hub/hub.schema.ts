import { z } from "zod";

export const createHubSchema = z.object({
  body: z.object({
    courseCode: z.string().min(1, "Course code is required"),
    courseName: z.string().min(1, "Course name is required"),
    credit: z.number().positive(),
    termOffer: z.string().min(1, "Term offer is required"),
    weeklyClassSchedule: z
      .array(
        z.object({
          day: z.string(),
          startTime: z.string(),
          endTime: z.string(),
          room: z.string().optional(),
        }),
      )
      .min(1, "At least one class schedule is required"),
    department: z.string().min(1, "Department is required"),
    batch: z.string().min(1, "Batch is required"),
    semesterNumber: z.number().positive(),
    teacherId: z.string().optional(),
  }),
});

export const joinHubSchema = z.object({
  body: z.object({
    joinCode: z
      .string()
      .length(6, { message: "Join code must be exactly 6 characters" }),
  }),
});

export const updateMemberRoleSchema = z.object({
  body: z.object({
    role: z.enum(["TEACHER", "CR", "TA", "STUDENT"]),
  }),
});

export const updateHubSchema = z.object({
  body: z.object({
    courseName: z.string().optional(),
    department: z.string().optional(),
    batch: z.string().optional(),
    termOffer: z.string().optional(),
    classroomNumber: z.string().optional(),
    weeklyClassSchedule: z.any().optional(),

    // 👈 NEW: Validating the JSON array of exams
    termExams: z
      .array(
        z.object({
          type: z
            .string()
            .min(1, "Exam type is required (e.g., Midterm, Final)"),
          date: z.string().optional(),
          time: z.string().optional(),
          room: z.string().optional(),
        }),
      )
      .optional(),
  }),
});

export type UpdateHubPayload = z.infer<typeof updateHubSchema>["body"];

export const archiveHubSchema = z.object({
  body: z.object({
    isArchived: z.boolean(),
  }),
});

export type CreateHubPayload = z.infer<typeof createHubSchema>["body"];
