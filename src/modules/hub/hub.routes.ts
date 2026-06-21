import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createHubSchema,
  joinHubSchema,
  updateMemberRoleSchema,
  archiveHubSchema,
  updateHubSchema,
} from "./hub.schema";
import {
  createHub,
  joinHub,
  getMyHubs,
  getHubDetails,
  updateMemberRole,
  archiveHub,
  getAvailableTeachers,
  updateHub,
} from "./hub.controller";

// 👇 1. Import the sub-routes (Check these paths match your folder structure!)
import { resourceRoutes } from "../hub/resources/resources.routes";
import { contentRoutes } from "../hub/content/content.routes";

const router = Router();

// --- Core Hub Routes ---
router.post("/", requireAuth, validateRequest(createHubSchema), createHub);
router.post("/join", requireAuth, validateRequest(joinHubSchema), joinHub);
router.get("/teachers", requireAuth, getAvailableTeachers);
router.get("/my", requireAuth, getMyHubs);
router.get("/:id", requireAuth, getHubDetails);

router.patch("/:id", requireAuth, validateRequest(updateHubSchema), updateHub);
router.patch(
  "/:id/members/:memberId/role",
  requireAuth,
  validateRequest(updateMemberRoleSchema),
  updateMemberRole,
);
router.patch(
  "/:id/archive",
  requireAuth,
  validateRequest(archiveHubSchema),
  archiveHub,
);

// 👇 2. Mount the Sub-Routes directly onto the Hub Router
// This ensures /api/hubs/:id/resources perfectly triggers the resource routes!
router.use("/", resourceRoutes);
router.use("/", contentRoutes);

export const hubRoutes = router;
