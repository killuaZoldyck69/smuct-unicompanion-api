import { Router } from "express";
import { requireAuth } from "../../../middleware/auth.middleware";
import { validateRequest } from "../../../middleware/validateRequest";
import {
  commentAnnouncementSchema,
  createAnnouncementSchema,
  createDiscussionSchema,
  replyDiscussionSchema,
} from "./content.schema";
import {
  createAnnouncement,
  getAnnouncements,
  createDiscussion,
  replyDiscussion,
  getDiscussions,
  commentAnnouncement,
} from "./content.controller";

const router = Router({ mergeParams: true });

// 👇 REMOVED "/hubs" from all paths!
router.post(
  "/:id/announcements",
  requireAuth,
  validateRequest(createAnnouncementSchema),
  createAnnouncement,
);
router.get("/:id/announcements", requireAuth, getAnnouncements);

router.post(
  "/:id/discussions",
  requireAuth,
  validateRequest(createDiscussionSchema),
  createDiscussion,
);
router.get("/:id/discussions", requireAuth, getDiscussions);

router.post(
  "/:id/discussions/:discussionId/reply",
  requireAuth,
  validateRequest(replyDiscussionSchema),
  replyDiscussion,
);

router.post(
  "/:id/announcements/:announcementId/comments",
  requireAuth,
  validateRequest(commentAnnouncementSchema),
  commentAnnouncement,
);

export const contentRoutes = router;
