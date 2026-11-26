import { Router } from "express";
import { requireAuth } from "../../../middleware/auth.middleware";
import {
  createUserKeyGenerator,
  rateLimit,
} from "../../../middleware/rateLimit.middleware";
import { validateRequest } from "../../../middleware/validateRequest";
import {
  announcementParamSchema,
  commentAnnouncementSchema,
  commentParamSchema,
  createAnnouncementSchema,
  createDiscussionSchema,
  getAnnouncementsQuerySchema,
  hubContentParamSchema,
  replyDiscussionSchema,
  updateAnnouncementCommentSchema,
  updateAnnouncementSchema,
} from "./content.schema";
import {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getAnnouncements,
  createDiscussion,
  replyDiscussion,
  getDiscussions,
  commentAnnouncement,
  updateAnnouncementComment,
  deleteAnnouncementComment,
} from "./content.controller";

const router = Router({ mergeParams: true });

// Dedicated per-user limiters protect notification fan-out & prevent spam.
export const announcementWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: createUserKeyGenerator("hub-announcement-write"),
  message: {
    success: false,
    message:
      "Too many announcement updates. Please wait a few minutes before trying again.",
  },
});

export const contentInteractionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  keyGenerator: createUserKeyGenerator("hub-content-interaction"),
  message: {
    success: false,
    message:
      "Too many comments or discussion posts. Please wait a few minutes before trying again.",
  },
});

router.post(
  "/:id/announcements",
  requireAuth,
  announcementWriteLimiter,
  validateRequest(createAnnouncementSchema),
  createAnnouncement,
);
router.patch(
  "/:id/announcements/:announcementId",
  requireAuth,
  announcementWriteLimiter,
  validateRequest(updateAnnouncementSchema),
  updateAnnouncement,
);
router.delete(
  "/:id/announcements/:announcementId",
  requireAuth,
  announcementWriteLimiter,
  validateRequest(announcementParamSchema),
  deleteAnnouncement,
);
router.get(
  "/:id/announcements",
  requireAuth,
  validateRequest(getAnnouncementsQuerySchema),
  getAnnouncements,
);

router.post(
  "/:id/announcements/:announcementId/comments",
  requireAuth,
  contentInteractionLimiter,
  validateRequest(commentAnnouncementSchema),
  commentAnnouncement,
);
router.patch(
  "/:id/announcements/:announcementId/comments/:commentId",
  requireAuth,
  contentInteractionLimiter,
  validateRequest(updateAnnouncementCommentSchema),
  updateAnnouncementComment,
);
router.delete(
  "/:id/announcements/:announcementId/comments/:commentId",
  requireAuth,
  contentInteractionLimiter,
  validateRequest(commentParamSchema),
  deleteAnnouncementComment,
);

router.post(
  "/:id/discussions",
  requireAuth,
  contentInteractionLimiter,
  validateRequest(createDiscussionSchema),
  createDiscussion,
);
router.get(
  "/:id/discussions",
  requireAuth,
  validateRequest(hubContentParamSchema),
  getDiscussions,
);
router.post(
  "/:id/discussions/:discussionId/reply",
  requireAuth,
  contentInteractionLimiter,
  validateRequest(replyDiscussionSchema),
  replyDiscussion,
);

export const contentRoutes = router;
