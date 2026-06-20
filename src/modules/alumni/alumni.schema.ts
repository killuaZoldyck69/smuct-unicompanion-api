import { z } from "zod";

const alumniCoreSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").optional().nullable(),
  batch: z.string().min(1, "Batch is required"),
  graduationYear: z.number().int().positive(),
  department: z.string().min(1, "Department is required"),
  degree: z.string().optional().nullable(),
  currentCompany: z.string().optional().nullable(),
  currentPosition: z.string().optional().nullable(),
  skills: z.array(z.string()).default([]),
  linkedInUrl: z
    .string()
    .url({ message: "Invalid URL" })
    .or(z.literal(""))
    .optional()
    .nullable(),
  personalWebsiteUrl: z
    .string()
    .url({ message: "Invalid URL" })
    .or(z.literal(""))
    .optional()
    .nullable(),
  image: z.string().optional().nullable(),
});

export const createAlumniSchema = z.object({ body: alumniCoreSchema });
export const bulkCreateAlumniSchema = z.object({
  body: z.array(alumniCoreSchema).min(1),
});
export const updateAlumniSchema = z.object({
  body: alumniCoreSchema.partial(),
});

export type CreateAlumniPayload = z.infer<typeof createAlumniSchema>["body"];
export type UpdateAlumniPayload = z.infer<typeof updateAlumniSchema>["body"];
