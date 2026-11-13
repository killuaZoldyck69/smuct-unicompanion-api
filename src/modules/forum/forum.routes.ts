import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createUserKeyGenerator,
  rateLimit,
} from "../../middleware/rateLimit.middleware";
import {
  createForumReportSchema,
  createPostSchema,
  createResponseSchema,
  forumIdParamSchema,
  getFeedQuerySchema,
  reactResponseSchema,
  resolvePostSchema,
  responseIdParamSchema,
  updatePostSchema,
  updateResponseSchema,
} from "./forum.schema";
import {
  createPost,
  deletePost,
  deleteResponse,
  getFeed,
  getThread,
  markResolved,
  reactToResponse,
  replyToPost,
  reportContent,
  updatePost,
  updateResponse,
} from "./forum.controller";

const router = Router();

// All Forum mutation limiters key by verified req.user.id (API-8 campus-NAT safe)
export const postRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  keyGenerator: createUserKeyGenerator("forum-post"),
  message: {
    success: false,
    message: "Too many posts created. Please try again in 10 minutes.",
  },
});

export const replyRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 25,
  keyGenerator: createUserKeyGenerator("forum-reply"),
  message: {
    success: false,
    message: "Too many replies posted. Please try again in 5 minutes.",
  },
});

export const reactionRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 60,
  keyGenerator: createUserKeyGenerator("forum-reaction"),
  message: {
    success: false,
    message: "Too many reaction updates. Please slow down slightly.",
  },
});

export const reportRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: createUserKeyGenerator("forum-report"),
  message: {
    success: false,
    message: "Too many content reports submitted. Please try again later.",
  },
});

// POST /api/forum/reports - Submit UGC Abuse Report (mounted before :id routes)
router.post(
  "/reports",
  requireAuth,
  reportRateLimiter,
  validateRequest(createForumReportSchema),
  reportContent,
);

// POST /api/forum - Create a Forum Post
router.post(
  "/",
  requireAuth,
  postRateLimiter,
  validateRequest(createPostSchema),
  createPost,
);

// GET /api/forum - Get All Posts / Feed
router.get("/", requireAuth, validateRequest(getFeedQuerySchema), getFeed);

// GET /api/forum/:id - Get Single Thread
router.get("/:id", requireAuth, validateRequest(forumIdParamSchema), getThread);

// POST /api/forum/:id/respond - Reply to a Post
router.post(
  "/:id/respond",
  requireAuth,
  replyRateLimiter,
  validateRequest(createResponseSchema),
  replyToPost,
);

// POST /api/forum/:id/responses - Alias for backward compatibility
router.post(
  "/:id/responses",
  requireAuth,
  replyRateLimiter,
  validateRequest(createResponseSchema),
  replyToPost,
);

// POST /api/forum/:id/responses/:responseId/react - Like / Dislike a Response or Reply
router.post(
  "/:id/responses/:responseId/react",
  requireAuth,
  reactionRateLimiter,
  validateRequest(reactResponseSchema),
  reactToResponse,
);

// PATCH /api/forum/:id/resolve - Mark Post as Resolved or Toggle
router.patch(
  "/:id/resolve",
  requireAuth,
  validateRequest(resolvePostSchema),
  markResolved,
);

// PATCH /api/forum/:id - Edit / Moderate Post
router.patch(
  "/:id",
  requireAuth,
  validateRequest(updatePostSchema),
  updatePost,
);

// DELETE /api/forum/:id - Delete Post
router.delete(
  "/:id",
  requireAuth,
  validateRequest(forumIdParamSchema),
  deletePost,
);

// PATCH /api/forum/:id/responses/:responseId - Edit Response
router.patch(
  "/:id/responses/:responseId",
  requireAuth,
  replyRateLimiter,
  validateRequest(updateResponseSchema),
  updateResponse,
);

// DELETE /api/forum/:id/responses/:responseId - Delete Response
router.delete(
  "/:id/responses/:responseId",
  requireAuth,
  validateRequest(responseIdParamSchema),
  deleteResponse,
);

export const forumRoutes = router;
