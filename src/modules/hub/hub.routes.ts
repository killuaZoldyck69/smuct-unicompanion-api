import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createHubSchema,
  joinHubSchema,
  updateMemberRoleSchema,
  archiveHubSchema,
  updateHubSchema,
  toggleLiveClassSchema,
  createClassNoticeSchema,
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
  toggleLiveClass,
  createClassNotice,
  deleteClassNotice,
} from "./hub.controller";

import { resourceRoutes } from "../hub/resources/resources.routes";
import { contentRoutes } from "../hub/content/content.routes";
import { assessmentRoutes } from "./assessments/assessments.routes";
import { reviewRoutes } from "./reviews/reviews.routes";

const router = Router();

// --- Core Hub Routes ---
router.post("/", requireAuth, validateRequest(createHubSchema), createHub);
router.post("/join", requireAuth, validateRequest(joinHubSchema), joinHub);
router.get("/teachers", requireAuth, getAvailableTeachers);
router.get("/available-teachers", requireAuth, getAvailableTeachers);
router.get("/my", requireAuth, getMyHubs);
router.get("/:id", requireAuth, getHubDetails);

router.patch("/:id", requireAuth, validateRequest(updateHubSchema), updateHub);
router.patch(
  "/:id/live-class",
  requireAuth,
  validateRequest(toggleLiveClassSchema),
  toggleLiveClass,
);
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

// --- Class Routine Notices & Alerts ---
router.post(
  "/:id/class-notices",
  requireAuth,
  validateRequest(createClassNoticeSchema),
  createClassNotice,
);
router.delete(
  "/:id/class-notices/:noticeId",
  requireAuth,
  deleteClassNotice,
);

// Mount the Sub-Routes directly onto the Hub Router
router.use("/", resourceRoutes);
router.use("/", contentRoutes);
router.use("/", assessmentRoutes);
router.use("/", reviewRoutes);

export const hubRoutes = router;
