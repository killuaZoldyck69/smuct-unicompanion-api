import { z } from "zod";

export const createBloodPostSchema = z.object({
  body: z.object({
    patientName: z.string().min(1, "Patient name is required"),
    patientCondition: z.string().min(1, "Patient condition is required"),
    bloodGroup: z.enum(
      [
        "A_POSITIVE",
        "A_NEGATIVE",
        "B_POSITIVE",
        "B_NEGATIVE",
        "AB_POSITIVE",
        "AB_NEGATIVE",
        "O_POSITIVE",
        "O_NEGATIVE",
      ],
      { message: "Valid blood group is required" },
    ),
    location: z.string().min(1, "Location is required"),
    urgency: z.string().min(1, "Urgency is required"),
    contactPhone: z.string().min(1, "Contact phone is required"),
  }),
});

export const respondBloodPostSchema = z.object({
  body: z.object({
    message: z.string().optional(),
  }),
});

export type CreateBloodPostPayload = z.infer<
  typeof createBloodPostSchema
>["body"];
export type RespondBloodPostPayload = z.infer<
  typeof respondBloodPostSchema
>["body"];
