import { z } from "zod";
import {
  ASSESSMENT_TYPE_VALUES,
  SUBMISSION_TYPE_VALUES,
} from "../../../constants/enums";

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
    type: z.enum(ASSESSMENT_TYPE_VALUES),
    submissionType: z.enum(SUBMISSION_TYPE_VALUES).optional().default("ONLINE"),
    deadline: datePreprocess,
    totalMarks: z.number().positive(),
  }),
});

export const updateAssessmentSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Title cannot be empty").optional(),
    description: z.string().optional(),
    type: z.enum(ASSESSMENT_TYPE_VALUES).optional(),
    submissionType: z.enum(SUBMISSION_TYPE_VALUES).optional(),
    deadline: datePreprocess.optional(),
    totalMarks: z.number().positive().optional(),
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

export type CreateAssessmentPayload = z.infer<
  typeof createAssessmentSchema
>["body"];
export type UpdateAssessmentPayload = z.infer<
  typeof updateAssessmentSchema
>["body"];
export type SubmitAssessmentPayload = z.infer<
  typeof submitAssessmentSchema
>["body"];
export type GradeSubmissionPayload = z.infer<
  typeof gradeSubmissionSchema
>["body"];
export type BulkGradePayload = z.infer<typeof bulkGradeSchema>["body"];
