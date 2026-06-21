import { z } from "zod";

const datePreprocess = z.preprocess(
  (val) => {
    if (!val) return undefined;
    if (val instanceof Date) return val;
    return new Date(val as string);
  },
  z.date({ message: "Invalid date format" }),
);

export const createAssessmentSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    type: z.enum(["ASSIGNMENT", "QUIZ", "PRESENTATION"]),
    deadline: datePreprocess,
    totalMarks: z.number().positive(),
  }),
});

export const submitAssessmentSchema = z.object({
  body: z.object({ submittedUrl: z.string().url("Must provide a valid URL") }),
});

export const gradeSubmissionSchema = z.object({
  body: z.object({ marks: z.number().min(0) }),
});

export const bulkGradeSchema = z.object({
  body: z
    .array(
      z.object({
        studentId: z.string(),
        marks: z.number().min(0),
      }),
    )
    .min(1, "Must provide at least one grade"),
});
