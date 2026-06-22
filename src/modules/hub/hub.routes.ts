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
  removeMember, // 👈 Import new controller
  archiveHub,
  getAvailableTeachers,
  updateHub,
  deleteHub,
} from "./hub.controller";

import { resourceRoutes } from "../hub/resources/resources.routes";
import { contentRoutes } from "../hub/content/content.routes";
import { assessmentRoutes } from "./assessments/assessments.routes";

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

// 👈 NEW: Add DELETE route for members
router.delete("/:id/members/:memberId", requireAuth, removeMember);
router.delete("/:id", requireAuth, deleteHub);

router.patch(
  "/:id/archive",
  requireAuth,
  validateRequest(archiveHubSchema),
  archiveHub,
);

// Mount the Sub-Routes directly onto the Hub Router
router.use("/", resourceRoutes);
router.use("/", contentRoutes);
router.use("/", assessmentRoutes);

export const hubRoutes = router;
