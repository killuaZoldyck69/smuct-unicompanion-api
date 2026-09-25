import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import { rateLimit } from "../../middleware/rateLimit.middleware";
import {
  createClaimSchema,
  createLostFoundSchema,
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
  submitClaim,
  updatePost,
  updateStatus,
  withdrawClaim,
} from "./lost-found.controller";

const router = Router();

const claimRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
  message: "Too many claim attempts. Please try again in a few minutes.",
});

// Post routes
router.post(
  "/",
  requireAuth,
  validateRequest(createLostFoundSchema),
  createPost
);

router.get("/", requireAuth, getFeed);

router.get("/:id", requireAuth, getPostById);

router.get("/:id/matches", requireAuth, getPossibleMatches);

router.patch(
  "/:id",
  requireAuth,
  validateRequest(updateLostFoundSchema),
  updatePost
);

router.patch(
  "/:id/status",
  requireAuth,
  validateRequest(updateLostFoundStatusSchema),
  updateStatus
);

router.delete("/:id", requireAuth, deletePost);

// Claim routes
router.post(
  "/:id/claims",
  requireAuth,
  claimRateLimiter,
  validateRequest(createClaimSchema),
  submitClaim
);

router.get("/:id/claims", requireAuth, getClaims);

router.patch("/:id/claims/:claimId/accept", requireAuth, acceptClaim);

router.patch("/:id/claims/:claimId/reject", requireAuth, rejectClaim);

router.delete("/:id/claims/:claimId", requireAuth, withdrawClaim);

export const lostFoundRoutes = router;

