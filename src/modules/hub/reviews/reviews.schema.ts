import { z } from "zod";

export const updateReviewSettingsSchema = z.object({
  body: z.object({
    isReviewOpen: z.boolean(),
    reviewQuestions: z.array(z.string()),
  }),
});

export const submitReviewSchema = z.object({
  body: z.object({
    rating: z.number().min(1).max(5),
    comment: z.string().optional(),
    isAnonymous: z.boolean().default(true),
    answers: z.any(), // JSON mapping to custom questions
  }),
});
