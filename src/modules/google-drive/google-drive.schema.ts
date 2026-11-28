import { z } from "zod";

export const createDriveAuthUrlSchema = z.object({
  body: z.object({
    returnUrl: z
      .string()
      .trim()
      .min(1, "Return URL is required.")
      .max(500, "Return URL is too long."),
  }),
});
