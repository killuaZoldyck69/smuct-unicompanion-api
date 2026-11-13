import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createUserKeyGenerator,
  rateLimit,
} from "../../middleware/rateLimit.middleware";
import {
  createClaimSchema,
  createLostFoundReportSchema,
  createLostFoundSchema,
  getFeedQuerySchema,
  lostFoundClaimParamSchema,
  lostFoundIdParamSchema,
  updateLostFoundSchema,
  updateLostFoundStatusSchema,
} from "./lost-found.schema";
import {
  acceptClaim,
  createPost,
  deletePost,
  getClaims,
  getFeed,
  getPossibleMatches,
  getPostById,
  rejectClaim,
  reportPost,
  submitClaim,
  updatePost,
  updateStatus,
  withdrawClaim,
} from "./lost-found.controller";

const router = Router();

export const postRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: createUserKeyGenerator("lost-found-post"),
  message: {
    success: false,
    message: "Too many listings created. Please try again in a few minutes.",
  },
});

export const claimRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: createUserKeyGenerator("lost-found-claim"),
  message: {
    success: false,
    message: "Too many claim attempts. Please try again in a few minutes.",
  },
});

export const reportRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: createUserKeyGenerator("lost-found-report"),
  message: {
    success: false,
    message: "Too many reports submitted. Please try again later.",
  },
});

// Post routes
router.post(
  "/",
  requireAuth,
  postRateLimiter,
  validateRequest(createLostFoundSchema),
  createPost,
);

router.get("/", requireAuth, validateRequest(getFeedQuerySchema), getFeed);

router.get(
  "/:id",
  requireAuth,
  validateRequest(lostFoundIdParamSchema),
  getPostById,
);

router.get(
  "/:id/matches",
  requireAuth,
  validateRequest(lostFoundIdParamSchema),
  getPossibleMatches,
);

router.patch(
  "/:id",
  requireAuth,
  validateRequest(updateLostFoundSchema),
  updatePost,
);

router.patch(
  "/:id/status",
  requireAuth,
  validateRequest(updateLostFoundStatusSchema),
  updateStatus,
);

router.delete(
  "/:id",
  requireAuth,
  validateRequest(lostFoundIdParamSchema),
  deletePost,
);

router.post(
  "/:id/reports",
  requireAuth,
  reportRateLimiter,
  validateRequest(createLostFoundReportSchema),
  reportPost,
);

// Claim routes
router.post(
  "/:id/claims",
  requireAuth,
  claimRateLimiter,
  validateRequest(createClaimSchema),
  submitClaim,
);

router.get(
  "/:id/claims",
  requireAuth,
  validateRequest(lostFoundIdParamSchema),
  getClaims,
);

router.patch(
  "/:id/claims/:claimId/accept",
  requireAuth,
  validateRequest(lostFoundClaimParamSchema),
  acceptClaim,
);

router.patch(
  "/:id/claims/:claimId/reject",
  requireAuth,
  validateRequest(lostFoundClaimParamSchema),
  rejectClaim,
);

router.delete(
  "/:id/claims/:claimId",
  requireAuth,
  validateRequest(lostFoundClaimParamSchema),
  withdrawClaim,
);

export const lostFoundRoutes = router;
