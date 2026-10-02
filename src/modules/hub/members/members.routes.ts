import { Router } from "express";
import { requireAuth } from "../../../middleware/auth.middleware";
import { validateRequest } from "../../../middleware/validateRequest";
import {
  memberRouteParamsSchema,
  updateMemberRoleSchema,
} from "./members.schema";
import {
  getHubMembers,
  updateMemberRole,
  removeMember,
} from "./members.controller";

const router = Router();

router.get("/:id/members", requireAuth, getHubMembers);

router.patch(
  "/:id/members/:memberId",
  requireAuth,
  validateRequest(updateMemberRoleSchema),
  updateMemberRole,
);

router.patch(
  "/:id/members/:memberId/role",
  requireAuth,
  validateRequest(updateMemberRoleSchema),
  updateMemberRole,
);

router.delete(
  "/:id/members/:memberId",
  requireAuth,
  validateRequest(memberRouteParamsSchema),
  removeMember,
);

export const memberRoutes = router;
