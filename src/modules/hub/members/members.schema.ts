import { z } from "zod";
import { HUB_ROLE_VALUES } from "../../../constants/enums";

export const memberRouteParamsSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Hub ID is required"),
    memberId: z.string().min(1, "Member ID is required"),
  }),
});

export const updateMemberRoleSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Hub ID is required"),
    memberId: z.string().min(1, "Member ID is required"),
  }),
  body: z.object({
    role: z.enum(HUB_ROLE_VALUES, {
      message: "Invalid hub role specified",
    }),
  }),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>["body"];
