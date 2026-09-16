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

// Support both canonical /:id/announcements and legacy /:id/content/announcements
router.post(
  ["/:id/announcements", "/:id/content/announcements"],
  requireAuth,
  validateRequest(createAnnouncementSchema),
  createAnnouncement,
);
router.get(
  ["/:id/announcements", "/:id/content/announcements"],
  requireAuth,
  getAnnouncements,
);

router.post(
  ["/:id/discussions", "/:id/content/discussions"],
  requireAuth,
  validateRequest(createDiscussionSchema),
  createDiscussion,
);
router.get(
  ["/:id/discussions", "/:id/content/discussions"],
  requireAuth,
  getDiscussions,
);

router.post(
  [
    "/:id/discussions/:discussionId/reply",
    "/:id/content/discussions/:discussionId/reply",
  ],
  requireAuth,
  validateRequest(replyDiscussionSchema),
  replyDiscussion,
);

router.post(
  [
    "/:id/announcements/:announcementId/comments",
    "/:id/content/announcements/:announcementId/comments",
  ],
  requireAuth,
  validateRequest(commentAnnouncementSchema),
  commentAnnouncement,
);

export const contentRoutes = router;
