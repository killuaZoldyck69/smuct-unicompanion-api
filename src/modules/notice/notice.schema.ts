import { z } from "zod";

export const createNoticeSchema = z.object({
  body: z.object({
    referenceNo: z.string().optional(),
    title: z.string().min(1, "Title is required"),
    body: z.string().min(1, "Body is required"),
    issuerName: z.string().min(1, "Issuer name is required"),
    issuerDesignation: z.string().min(1, "Issuer designation is required"),
    copyTo: z.array(z.string()).optional().default([]),
  }),
});

// Export the inferred type for the service layer
export type CreateNoticePayload = z.infer<typeof createNoticeSchema>["body"];
