import { Router } from "express";
import { requireAuth } from "../../../middleware/auth.middleware";
import { validateRequest } from "../../../middleware/validateRequest";
import {
  updateReviewSettingsSchema,
  submitReviewSchema,
  editReviewSchema,
} from "./reviews.schema";
import {
  updateReviewSettings,
  submitReview,
  editReview,
  deleteReview,
  getReviews,
} from "./reviews.controller";

const router = Router({ mergeParams: true });

router.patch(
  "/:id/review-settings",
  requireAuth,
  validateRequest(updateReviewSettingsSchema),
  updateReviewSettings,
);
router.post(
  "/:id/reviews",
  requireAuth,
  validateRequest(submitReviewSchema),
  submitReview,
);
router.patch(
  "/:id/reviews",
  requireAuth,
  validateRequest(editReviewSchema),
  editReview,
);
router.delete("/:id/reviews", requireAuth, deleteReview);
router.get("/:id/reviews", requireAuth, getReviews);

export const reviewRoutes = router;

