import { Router } from "express";
import { requireAuth } from "../../../middleware/auth.middleware";
import { validateRequest } from "../../../middleware/validateRequest";
import {
  updateReviewSettingsSchema,
  submitReviewSchema,
} from "./reviews.schema";
import {
  updateReviewSettings,
  submitReview,
  getReviews,
} from "./reviews.controller";

const router = Router({ mergeParams: true });

router.patch(
  "/hubs/:id/review-settings",
  requireAuth,
  validateRequest(updateReviewSettingsSchema),
  updateReviewSettings,
);
router.post(
  "/hubs/:id/reviews",
  requireAuth,
  validateRequest(submitReviewSchema),
  submitReview,
);
router.get("/hubs/:id/reviews", requireAuth, getReviews);

export const reviewRoutes = router;
