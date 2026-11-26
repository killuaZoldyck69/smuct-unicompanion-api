import { z } from "zod";
import { HUB_ROLE_VALUES } from "../../../constants/enums";

export const hubMembersParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Course Hub ID."),
  }),
});

export const memberRouteParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Course Hub ID."),
    memberId: z.string().uuid("Invalid Member ID."),
  }),
});

export const updateMemberRoleSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Course Hub ID."),
    memberId: z.string().uuid("Invalid Member ID."),
  }),
  body: z.object({
    role: z.enum(HUB_ROLE_VALUES, {
      message: "Invalid hub role specified",
    }),
  }),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>["body"];
