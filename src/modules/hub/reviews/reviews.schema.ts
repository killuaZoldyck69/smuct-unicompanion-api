import { z } from "zod";

export const updateReviewSettingsSchema = z.object({
  body: z.object({
    isReviewOpen: z.boolean(),
    reviewQuestions: z.array(z.string()).default([]),
  }),
});

export const submitReviewSchema = z.object({
  body: z.object({
    rating: z.number().min(1).max(5),
    comment: z.string().optional(),
    isAnonymous: z.boolean().default(true),
    answers: z.any().optional(), // JSON mapping to custom optional questions
  }),
});

export const editReviewSchema = z.object({
  body: z.object({
    rating: z.number().min(1).max(5).optional(),
    comment: z.string().optional(),
    answers: z.any().optional(),
  }),
});

export type UpdateReviewSettingsPayload = z.infer<
  typeof updateReviewSettingsSchema
>["body"];
export type SubmitReviewPayload = z.infer<typeof submitReviewSchema>["body"];
export type EditReviewPayload = z.infer<typeof editReviewSchema>["body"];

