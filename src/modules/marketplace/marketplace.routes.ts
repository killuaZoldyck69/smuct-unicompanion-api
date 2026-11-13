import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createUserKeyGenerator,
  rateLimit,
} from "../../middleware/rateLimit.middleware";
import {
  createMarketplaceCommentSchema,
  createMarketplaceReportSchema,
  createMarketplaceSchema,
  getMarketplaceFeedQuerySchema,
  marketplaceCommentParamSchema,
  marketplaceIdParamSchema,
  updateMarketplaceCommentSchema,
  updateMarketplaceSchema,
  updateMarketplaceStatusSchema,
} from "./marketplace.schema";
import {
  createComment,
  createPost,
  deleteComment,
  deletePost,
  getFeed,
  getPostById,
  markAsSold,
  reportMarketplaceContent,
  updateComment,
  updatePost,
  updateStatus,
} from "./marketplace.controller";

const router = Router();

export const marketplacePostRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: createUserKeyGenerator("marketplace-post"),
  message: {
    success: false,
    message: "Too many listings created. Please try again in a few minutes.",
  },
});

export const marketplaceCommentRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 25,
  keyGenerator: createUserKeyGenerator("marketplace-comment"),
  message: {
    success: false,
    message: "Too many comments posted. Please try again in 5 minutes.",
  },
});

export const marketplaceReportRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: createUserKeyGenerator("marketplace-report"),
  message: {
    success: false,
    message: "Too many content reports submitted. Please try again later.",
  },
});

// UGC report endpoint (must be declared before `/:id`)
router.post(
  "/reports",
  requireAuth,
  marketplaceReportRateLimiter,
  validateRequest(createMarketplaceReportSchema),
  reportMarketplaceContent,
);

router.post(
  "/",
  requireAuth,
  marketplacePostRateLimiter,
  validateRequest(createMarketplaceSchema),
  createPost,
);

router.get(
  "/",
  requireAuth,
  validateRequest(getMarketplaceFeedQuerySchema),
  getFeed,
);

router.get(
  "/:id",
  requireAuth,
  validateRequest(marketplaceIdParamSchema),
  getPostById,
);

router.patch(
  "/:id",
  requireAuth,
  validateRequest(updateMarketplaceSchema),
  updatePost,
);

router.patch(
  "/:id/sold",
  requireAuth,
  validateRequest(marketplaceIdParamSchema),
  markAsSold,
);

router.patch(
  "/:id/status",
  requireAuth,
  validateRequest(updateMarketplaceStatusSchema),
  updateStatus,
);

router.delete(
  "/:id",
  requireAuth,
  validateRequest(marketplaceIdParamSchema),
  deletePost,
);

router.post(
  "/:id/comments",
  requireAuth,
  marketplaceCommentRateLimiter,
  validateRequest(createMarketplaceCommentSchema),
  createComment,
);

router.patch(
  "/:id/comments/:commentId",
  requireAuth,
  validateRequest(updateMarketplaceCommentSchema),
  updateComment,
);

router.delete(
  "/:id/comments/:commentId",
  requireAuth,
  validateRequest(marketplaceCommentParamSchema),
  deleteComment,
);

export const marketplaceRoutes = router;
