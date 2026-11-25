import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import {
  createUserKeyGenerator,
  rateLimit,
} from "../../middleware/rateLimit.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createHubSchema,
  joinHubSchema,
  archiveHubSchema,
  hubIdParamSchema,
  updateHubSchema,
  toggleLiveClassSchema,
  getMyHubsQuerySchema,
  createClassNoticeSchema,
  deleteClassNoticeSchema,
} from "./hub.schema";
import {
  createHub,
  joinHub,
  getMyHubs,
  getHubDetails,
  archiveHub,
  getAvailableTeachers,
  updateHub,
  deleteHub,
  toggleLiveClass,
  createClassNotice,
  deleteClassNotice,
} from "./hub.controller";

import { memberRoutes } from "./members/members.routes";
import { resourceRoutes } from "../hub/resources/resources.routes";
import { contentRoutes } from "../hub/content/content.routes";
import { assessmentRoutes } from "./assessments/assessments.routes";
import { reviewRoutes } from "./reviews/reviews.routes";

const router = Router();

export const hubWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: createUserKeyGenerator("hub-write"),
  message: {
    success: false,
    message:
      "Too many course hub updates. Please wait a few minutes before trying again.",
  },
});

export const classNoticeWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: createUserKeyGenerator("hub-class-notice"),
  message: {
    success: false,
    message:
      "Too many class notice updates. Please wait a few minutes before trying again.",
  },
});

// --- Core Hub Routes ---
router.post("/", requireAuth, validateRequest(createHubSchema), createHub);
router.post("/join", requireAuth, validateRequest(joinHubSchema), joinHub);
router.get("/teachers", requireAuth, getAvailableTeachers);
router.get("/available-teachers", requireAuth, getAvailableTeachers);
router.get(
  "/my",
  requireAuth,
  validateRequest(getMyHubsQuerySchema),
  getMyHubs,
);
router.get(
  "/:id",
  requireAuth,
  validateRequest(hubIdParamSchema),
  getHubDetails,
);

router.patch(
  "/:id",
  requireAuth,
  hubWriteLimiter,
  validateRequest(updateHubSchema),
  updateHub,
);
router.patch(
  "/:id/live-class",
  requireAuth,
  validateRequest(toggleLiveClassSchema),
  toggleLiveClass,
);
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
  classNoticeWriteLimiter,
  validateRequest(createClassNoticeSchema),
  createClassNotice,
);
router.delete(
  "/:id/class-notices/:noticeId",
  requireAuth,
  classNoticeWriteLimiter,
  validateRequest(deleteClassNoticeSchema),
  deleteClassNotice,
);

// Mount the Sub-Routes directly onto the Hub Router
router.use("/", memberRoutes);
router.use("/", resourceRoutes);
router.use("/", contentRoutes);
router.use("/", assessmentRoutes);
router.use("/", reviewRoutes);

export const hubRoutes = router;
