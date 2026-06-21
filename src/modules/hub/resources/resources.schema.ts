import { z } from "zod";

export const createResourceSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Title is required"),
    driveUrl: z.string().url("Must be a valid URL"),
    isStudentNote: z.boolean().default(false),
  }),
});

export type CreateResourcePayload = z.infer<
  typeof createResourceSchema
>["body"];
