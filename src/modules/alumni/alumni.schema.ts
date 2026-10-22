import { z } from "zod";

export const alumniCoreSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z
    .string()
    .email("Invalid email")
    .or(z.literal(""))
    .optional()
    .nullable(),
  batch: z.string().min(1, "Batch is required"),
  graduationYear: z.coerce.number().int().positive("Valid graduation year is required"),
  department: z.string().min(1, "Department is required"),
  degree: z.string().optional().nullable(),
  currentCompany: z.string().optional().nullable(),
  currentPosition: z.string().optional().nullable(),
  skills: z
    .array(z.string())
    .or(z.string().transform((s) => s.split(/[,;]/).map((item) => item.trim()).filter(Boolean)))
    .default([]),
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
  body: z.union([
    z.array(alumniCoreSchema).min(1, "At least 1 alumni record required"),
    z
      .object({
        alumni: z.array(alumniCoreSchema).min(1, "At least 1 alumni record required"),
      })
      .transform((val) => val.alumni),
  ]),
});

export const updateAlumniSchema = z.object({
  body: alumniCoreSchema.partial(),
});

export type CreateAlumniPayload = z.infer<typeof createAlumniSchema>["body"];
export type UpdateAlumniPayload = z.infer<typeof updateAlumniSchema>["body"];

