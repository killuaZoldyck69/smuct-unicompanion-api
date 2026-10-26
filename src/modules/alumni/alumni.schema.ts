import { z } from "zod";

const sanitizeUrl = (val: string | null | undefined): string | null | undefined => {
  if (!val) return val;
  const trimmed = val.trim();
  if (!trimmed) return "";
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return `https://${trimmed}`;
  }
  return trimmed;
};

export const alumniCoreSchema = z.object({
  studentId: z
    .string()
    .trim()
    .transform((val) => (val ? val.replace(/\s+/g, "") : val))
    .optional()
    .nullable(),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .transform((val) => val.replace(/\s+/g, " ")),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email address")
    .or(z.literal(""))
    .optional()
    .nullable(),
  phone: z
    .string()
    .trim()
    .optional()
    .nullable(),
  batch: z
    .string()
    .trim()
    .min(1, "Batch is required"),
  graduationYear: z.coerce
    .number()
    .int()
    .min(1990, "Graduation year must be at least 1990")
    .max(2035, "Graduation year cannot exceed 2035"),
  department: z
    .string()
    .trim()
    .min(1, "Department is required")
    .transform((val) => val.replace(/\s+/g, " ")),
  degree: z
    .string()
    .trim()
    .optional()
    .nullable(),
  currentCompany: z
    .string()
    .trim()
    .transform((val) => (val ? val.replace(/\s+/g, " ") : val))
    .optional()
    .nullable(),
  currentPosition: z
    .string()
    .trim()
    .transform((val) => (val ? val.replace(/\s+/g, " ") : val))
    .optional()
    .nullable(),
  skills: z
    .array(z.string().trim().min(1))
    .or(
      z.string().transform((s) =>
        s
          .split(/[,;]/)
          .map((item) => item.trim().replace(/\s+/g, " "))
          .filter(Boolean),
      ),
    )
    .default([]),
  linkedInUrl: z
    .string()
    .trim()
    .transform(sanitizeUrl)
    .pipe(z.string().url("Invalid LinkedIn URL").or(z.literal("")).optional().nullable())
    .optional()
    .nullable(),
  personalWebsiteUrl: z
    .string()
    .trim()
    .transform(sanitizeUrl)
    .pipe(z.string().url("Invalid website URL").or(z.literal("")).optional().nullable())
    .optional()
    .nullable(),
  image: z
    .string()
    .trim()
    .optional()
    .nullable(),
});

export const createAlumniSchema = z.object({ body: alumniCoreSchema });

export const bulkCreateAlumniSchema = z.object({
  body: z.union([
    z
      .array(alumniCoreSchema)
      .min(1, "At least 1 alumni record required")
      .max(500, "Maximum 500 records allowed per bulk import"),
    z
      .object({
        alumni: z
          .array(alumniCoreSchema)
          .min(1, "At least 1 alumni record required")
          .max(500, "Maximum 500 records allowed per bulk import"),
      })
      .transform((val) => val.alumni),
  ]),
});

export const updateAlumniSchema = z.object({
  body: alumniCoreSchema.partial(),
});

export type CreateAlumniPayload = z.infer<typeof createAlumniSchema>["body"];
export type UpdateAlumniPayload = z.infer<typeof updateAlumniSchema>["body"];
