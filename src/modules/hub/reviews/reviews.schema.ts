import { z } from "zod";
import {
  MAX_REVIEW_ANSWER_ENTRIES,
  MAX_REVIEW_ANSWER_KEY_LENGTH,
  MAX_REVIEW_ANSWER_LENGTH,
  MAX_REVIEW_COMMENT_LENGTH,
  MAX_REVIEW_QUESTION_LENGTH,
  MAX_REVIEW_QUESTIONS,
  MAX_REVIEW_RATING,
  MIN_REVIEW_RATING,
} from "./reviews.domain";

const uuidSchema = z.string().uuid("Invalid identifier format");

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const reviewAnswersSchema = z
  .record(
    z
      .string()
      .trim()
      .min(1, "Answer key cannot be empty")
      .max(MAX_REVIEW_ANSWER_KEY_LENGTH, "Answer key is too long"),
    z
      .string()
      .trim()
      .max(
        MAX_REVIEW_ANSWER_LENGTH,
        `Answer must be ${MAX_REVIEW_ANSWER_LENGTH} characters or less`,
      ),
  )
  .refine(
    (obj) => Object.keys(obj).length <= MAX_REVIEW_ANSWER_ENTRIES,
    `Cannot submit more than ${MAX_REVIEW_ANSWER_ENTRIES} custom answers`,
  )
  .refine(
    (obj) => Object.keys(obj).every((k) => !FORBIDDEN_KEYS.has(k)),
    "Invalid answer key",
  );

export const hubIdReviewParamSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const updateReviewSettingsSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    isReviewOpen: z.boolean(),
    reviewQuestions: z
      .array(
        z
          .string()
          .trim()
          .min(1, "Question cannot be empty")
          .max(
            MAX_REVIEW_QUESTION_LENGTH,
            `Question must be ${MAX_REVIEW_QUESTION_LENGTH} characters or less`,
          ),
      )
      .max(
        MAX_REVIEW_QUESTIONS,
        `Cannot configure more than ${MAX_REVIEW_QUESTIONS} questions`,
      )
      .default([]),
  }),
});

export const submitReviewSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    rating: z
      .number()
      .int("Rating must be a whole number")
      .min(MIN_REVIEW_RATING, `Rating must be at least ${MIN_REVIEW_RATING}`)
      .max(MAX_REVIEW_RATING, `Rating cannot exceed ${MAX_REVIEW_RATING}`),
    comment: z
      .string()
      .trim()
      .max(
        MAX_REVIEW_COMMENT_LENGTH,
        `Comment must be ${MAX_REVIEW_COMMENT_LENGTH} characters or less`,
      )
      .optional()
      .nullable(),
    isAnonymous: z.boolean().optional().default(true),
    answers: reviewAnswersSchema.optional().nullable(),
  }),
});

export const editReviewSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    rating: z
      .number()
      .int("Rating must be a whole number")
      .min(MIN_REVIEW_RATING, `Rating must be at least ${MIN_REVIEW_RATING}`)
      .max(MAX_REVIEW_RATING, `Rating cannot exceed ${MAX_REVIEW_RATING}`)
      .optional(),
    comment: z
      .string()
      .trim()
      .max(
        MAX_REVIEW_COMMENT_LENGTH,
        `Comment must be ${MAX_REVIEW_COMMENT_LENGTH} characters or less`,
      )
      .optional()
      .nullable(),
    answers: reviewAnswersSchema.optional().nullable(),
  }),
});

export type UpdateReviewSettingsPayload = z.infer<
  typeof updateReviewSettingsSchema
>["body"];
export type SubmitReviewPayload = z.infer<typeof submitReviewSchema>["body"];
export type EditReviewPayload = z.infer<typeof editReviewSchema>["body"];
