import { Router } from "express";
import { requireAuth } from "../../../middleware/auth.middleware";
import {
  createUserKeyGenerator,
  rateLimit,
} from "../../../middleware/rateLimit.middleware";
import { validateRequest } from "../../../middleware/validateRequest";
import {
  hubMembersParamSchema,
  memberRouteParamsSchema,
  updateMemberRoleSchema,
} from "./members.schema";
import {
  getHubMembers,
  updateMemberRole,
  removeMember,
} from "./members.controller";

const router = Router();

export const memberWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: createUserKeyGenerator("hub-member-write"),
  message: {
    success: false,
    message:
      "Too many membership updates. Please wait a few minutes before trying again.",
  },
});

router.get(
  "/:id/members",
  requireAuth,
  validateRequest(hubMembersParamSchema),
  getHubMembers,
);

router.patch(
  "/:id/members/:memberId/role",
  requireAuth,
  memberWriteLimiter,
  validateRequest(updateMemberRoleSchema),
  updateMemberRole,
);

router.delete(
  "/:id/members/:memberId",
  requireAuth,
  memberWriteLimiter,
  validateRequest(memberRouteParamsSchema),
  removeMember,
);

export const memberRoutes = router;
