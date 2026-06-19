import { z } from "zod";

export const updateRoleSchema = z.object({
  body: z.object({
    action: z.enum(["MAKE_CR", "MAKE_TA", "REMOVE_ROLE"], {
      message: "Invalid action. Must be MAKE_CR, MAKE_TA, or REMOVE_ROLE",
    }),
  }),
});

export type UpdateRolePayload = z.infer<typeof updateRoleSchema>["body"];
