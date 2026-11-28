import { z } from "zod";
import {
  ASSESSMENT_TYPE_VALUES,
  SUBMISSION_TYPE_VALUES,
} from "../../../constants/enums";
import {
  ASSESSMENT_STATUS_VALUES,
  isSafeAssessmentHttpUrl,
  MAX_ASSESSMENT_ATTACHMENTS,
  MAX_ASSESSMENT_DESCRIPTION_LENGTH,
  MAX_ASSESSMENT_LINKS,
  MAX_ASSESSMENT_TITLE_LENGTH,
  MAX_ASSESSMENT_TOTAL_MARKS,
  MAX_ATTACHMENT_NAME_LENGTH,
  MAX_ATTACHMENT_TYPE_LENGTH,
  MAX_BULK_GRADE_ENTRIES,
  MAX_GRADE_FEEDBACK_LENGTH,
  MAX_LINK_TITLE_LENGTH,
  MAX_SUBMISSION_ATTACHMENTS,
  MAX_SUBMISSION_CONTENT_LENGTH,
  MAX_SUBMISSION_LINKS,
  SUBMISSION_REQUEST_STATUS_VALUES,
  validateAssessmentDateWindow,
} from "./assessments.domain";

const uuidSchema = z.string().uuid("Invalid identifier format");

const safeHttpUrlSchema = z
  .string()
  .trim()
  .refine(
    (val) => isSafeAssessmentHttpUrl(val),
    "URL must be a valid http:// or https:// address",
  );

const datePreprocess = z.preprocess(
  (val) => {
    if (!val) return undefined;
    if (val instanceof Date) return val;
    return new Date(val as string);
  },
  z.date({ message: "Invalid date format" }),
);

export const hubAssessmentListSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({
    type: z.enum(ASSESSMENT_TYPE_VALUES).optional(),
    status: z.enum(ASSESSMENT_STATUS_VALUES).optional(),
  }),
});

export const assessmentParamSchema = z.object({
  params: z.object({
    id: uuidSchema,
    assessmentId: uuidSchema,
  }),
});

export const classworkAttachmentSchema = z.object({
  url: safeHttpUrlSchema,
  name: z
    .string()
    .trim()
    .max(MAX_ATTACHMENT_NAME_LENGTH)
    .optional()
    .default("Attachment"),
  type: z.string().trim().max(MAX_ATTACHMENT_TYPE_LENGTH).optional(),
  size: z.number().finite().min(0).optional(),
});

export const classworkLinkSchema = z.object({
  url: safeHttpUrlSchema,
  title: z.string().trim().max(MAX_LINK_TITLE_LENGTH).optional().nullable(),
});

export const createAssessmentSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z
    .object({
      title: z
        .string()
        .trim()
        .min(1, "Title is required")
        .max(
          MAX_ASSESSMENT_TITLE_LENGTH,
          `Title must be ${MAX_ASSESSMENT_TITLE_LENGTH} characters or less`,
        ),
      description: z
        .string()
        .trim()
        .max(
          MAX_ASSESSMENT_DESCRIPTION_LENGTH,
          `Description must be ${MAX_ASSESSMENT_DESCRIPTION_LENGTH} characters or less`,
        )
        .optional()
        .nullable(),
      type: z.enum(ASSESSMENT_TYPE_VALUES),
      submissionType: z.enum(SUBMISSION_TYPE_VALUES).optional().default("ONLINE"),
      status: z.enum(ASSESSMENT_STATUS_VALUES).optional().default("PUBLISHED"),
      deadline: datePreprocess,
      startDate: datePreprocess.optional().nullable(),
      totalMarks: z
        .number()
        .finite("Total marks must be a valid number")
        .positive("Total marks must be greater than zero")
        .max(
          MAX_ASSESSMENT_TOTAL_MARKS,
          `Total marks cannot exceed ${MAX_ASSESSMENT_TOTAL_MARKS}`,
        ),
      allowLateSubmission: z.boolean().optional().default(false),
      attachments: z
        .array(classworkAttachmentSchema)
        .max(
          MAX_ASSESSMENT_ATTACHMENTS,
          `Cannot attach more than ${MAX_ASSESSMENT_ATTACHMENTS} files`,
        )
        .optional()
        .nullable(),
      links: z
        .array(classworkLinkSchema)
        .max(
          MAX_ASSESSMENT_LINKS,
          `Cannot add more than ${MAX_ASSESSMENT_LINKS} links`,
        )
        .optional()
        .nullable(),
    })
    .refine(
      (data) => validateAssessmentDateWindow(data.startDate, data.deadline),
      {
        message: "Start date must be on or before the deadline",
        path: ["startDate"],
      },
    ),
});

export const updateAssessmentSchema = z.object({
  params: z.object({
    id: uuidSchema,
    assessmentId: uuidSchema,
  }),
  body: z
    .object({
      title: z
        .string()
        .trim()
        .min(1, "Title cannot be empty")
        .max(
          MAX_ASSESSMENT_TITLE_LENGTH,
          `Title must be ${MAX_ASSESSMENT_TITLE_LENGTH} characters or less`,
        )
        .optional(),
      description: z
        .string()
        .trim()
        .max(
          MAX_ASSESSMENT_DESCRIPTION_LENGTH,
          `Description must be ${MAX_ASSESSMENT_DESCRIPTION_LENGTH} characters or less`,
        )
        .optional()
        .nullable(),
      type: z.enum(ASSESSMENT_TYPE_VALUES).optional(),
      submissionType: z.enum(SUBMISSION_TYPE_VALUES).optional(),
      status: z.enum(ASSESSMENT_STATUS_VALUES).optional(),
      deadline: datePreprocess.optional(),
      startDate: datePreprocess.optional().nullable(),
      totalMarks: z
        .number()
        .finite("Total marks must be a valid number")
        .positive("Total marks must be greater than zero")
        .max(
          MAX_ASSESSMENT_TOTAL_MARKS,
          `Total marks cannot exceed ${MAX_ASSESSMENT_TOTAL_MARKS}`,
        )
        .optional(),
      allowLateSubmission: z.boolean().optional(),
      attachments: z
        .array(classworkAttachmentSchema)
        .max(
          MAX_ASSESSMENT_ATTACHMENTS,
          `Cannot attach more than ${MAX_ASSESSMENT_ATTACHMENTS} files`,
        )
        .optional()
        .nullable(),
      links: z
        .array(classworkLinkSchema)
        .max(
          MAX_ASSESSMENT_LINKS,
          `Cannot add more than ${MAX_ASSESSMENT_LINKS} links`,
        )
        .optional()
        .nullable(),
    })
    .refine(
      (data) => validateAssessmentDateWindow(data.startDate, data.deadline),
      {
        message: "Start date must be on or before the deadline",
        path: ["startDate"],
      },
    ),
});

export const submitAssessmentSchema = z.object({
  params: z.object({
    id: uuidSchema,
    assessmentId: uuidSchema,
  }),
  body: z.object({
    submittedUrl: z
      .union([safeHttpUrlSchema, z.literal("")])
      .optional()
      .nullable(),
    content: z
      .string()
      .trim()
      .max(
        MAX_SUBMISSION_CONTENT_LENGTH,
        `Submission note must be ${MAX_SUBMISSION_CONTENT_LENGTH} characters or less`,
      )
      .optional()
      .nullable(),
    attachments: z
      .array(classworkAttachmentSchema)
      .max(
        MAX_SUBMISSION_ATTACHMENTS,
        `Cannot attach more than ${MAX_SUBMISSION_ATTACHMENTS} files`,
      )
      .optional()
      .nullable(),
    links: z
      .array(classworkLinkSchema)
      .max(
        MAX_SUBMISSION_LINKS,
        `Cannot add more than ${MAX_SUBMISSION_LINKS} links`,
      )
      .optional()
      .nullable(),
    status: z.enum(SUBMISSION_REQUEST_STATUS_VALUES).optional(),
    isLate: z.boolean().optional(),
  }),
});

export const unsubmitAssessmentSchema = z.object({
  params: z.object({
    id: uuidSchema,
    assessmentId: uuidSchema,
  }),
  body: z
    .object({
      clearWork: z.boolean().optional(),
      attachments: z
        .array(classworkAttachmentSchema)
        .max(
          MAX_SUBMISSION_ATTACHMENTS,
          `Cannot attach more than ${MAX_SUBMISSION_ATTACHMENTS} files`,
        )
        .optional()
        .nullable(),
      links: z
        .array(classworkLinkSchema)
        .max(
          MAX_SUBMISSION_LINKS,
          `Cannot add more than ${MAX_SUBMISSION_LINKS} links`,
        )
        .optional()
        .nullable(),
      submittedUrl: z
        .union([safeHttpUrlSchema, z.literal("")])
        .optional()
        .nullable(),
      content: z
        .string()
        .trim()
        .max(
          MAX_SUBMISSION_CONTENT_LENGTH,
          `Submission note must be ${MAX_SUBMISSION_CONTENT_LENGTH} characters or less`,
        )
        .optional()
        .nullable(),
    })
    .optional(),
});

export const gradeSubmissionSchema = z.object({
  params: z.object({
    id: uuidSchema,
    submissionId: uuidSchema,
  }),
  body: z.object({
    marks: z
      .number()
      .finite("Marks must be a valid number")
      .min(0, "Marks cannot be negative")
      .max(
        MAX_ASSESSMENT_TOTAL_MARKS,
        `Marks cannot exceed ${MAX_ASSESSMENT_TOTAL_MARKS}`,
      ),
    feedback: z
      .string()
      .trim()
      .max(
        MAX_GRADE_FEEDBACK_LENGTH,
        `Feedback must be ${MAX_GRADE_FEEDBACK_LENGTH} characters or less`,
      )
      .optional()
      .nullable(),
    studentId: uuidSchema.optional(),
    assessmentId: uuidSchema.optional(),
  }),
});

export const bulkGradeSchema = z.object({
  params: z.object({
    id: uuidSchema,
    assessmentId: uuidSchema,
  }),
  body: z
    .array(
      z.object({
        studentId: uuidSchema,
        marks: z
          .number()
          .finite("Marks must be a valid number")
          .min(0, "Marks cannot be negative")
          .max(
            MAX_ASSESSMENT_TOTAL_MARKS,
            `Marks cannot exceed ${MAX_ASSESSMENT_TOTAL_MARKS}`,
          ),
        feedback: z
          .string()
          .trim()
          .max(
            MAX_GRADE_FEEDBACK_LENGTH,
            `Feedback must be ${MAX_GRADE_FEEDBACK_LENGTH} characters or less`,
          )
          .optional()
          .nullable(),
      }),
    )
    .min(1, "Must provide at least one grade")
    .max(
      MAX_BULK_GRADE_ENTRIES,
      `Cannot bulk grade more than ${MAX_BULK_GRADE_ENTRIES} students per request`,
    ),
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
export type UnsubmitAssessmentPayload = z.infer<
  typeof unsubmitAssessmentSchema
>["body"];
export type GradeSubmissionPayload = z.infer<
  typeof gradeSubmissionSchema
>["body"];
export type BulkGradePayload = z.infer<typeof bulkGradeSchema>["body"];
