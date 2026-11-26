import { Router } from "express";
import { requireAuth } from "../../../middleware/auth.middleware";
import {
  createUserKeyGenerator,
  rateLimit,
} from "../../../middleware/rateLimit.middleware";
import { validateRequest } from "../../../middleware/validateRequest";
import {
  deleteReview,
  editReview,
  getReviews,
  submitReview,
  updateReviewSettings,
} from "./reviews.controller";
import {
  editReviewSchema,
  hubIdReviewParamSchema,
  submitReviewSchema,
  updateReviewSettingsSchema,
} from "./reviews.schema";

const router = Router({ mergeParams: true });

// Protects REVIEW_OPEN push notification fan-out & rapid toggling.
export const reviewSettingsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  keyGenerator: createUserKeyGenerator("hub-review-settings"),
  message: {
    success: false,
    message:
      "Too many evaluation settings updates. Please wait a few minutes before trying again.",
  },
});

// Protects review creation, editing, and deletion mutations.
export const reviewWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: createUserKeyGenerator("hub-review-write"),
  message: {
    success: false,
    message:
      "Too many review updates. Please wait a few minutes before trying again.",
  },
});

router.patch(
  "/:id/review-settings",
  requireAuth,
  reviewSettingsLimiter,
  validateRequest(updateReviewSettingsSchema),
  updateReviewSettings,
);
router.post(
  "/:id/reviews",
  requireAuth,
  reviewWriteLimiter,
  validateRequest(submitReviewSchema),
  submitReview,
);
router.patch(
  "/:id/reviews",
  requireAuth,
  reviewWriteLimiter,
  validateRequest(editReviewSchema),
  editReview,
);
router.delete(
  "/:id/reviews",
  requireAuth,
  reviewWriteLimiter,
  validateRequest(hubIdReviewParamSchema),
  deleteReview,
);
router.get(
  "/:id/reviews",
  requireAuth,
  validateRequest(hubIdReviewParamSchema),
  getReviews,
);

export const reviewRoutes = router;
