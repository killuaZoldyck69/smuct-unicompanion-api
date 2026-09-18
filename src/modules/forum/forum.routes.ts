import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import { rateLimit } from "../../middleware/rateLimit.middleware";
import {
  createPostSchema,
  createResponseSchema,
  updateResponseSchema,
  responseIdParamSchema,
  updatePostSchema,
  forumIdParamSchema,
  getFeedQuerySchema,
} from "./forum.schema";
import {
  createPost,
  getFeed,
  getThread,
  replyToPost,
  markResolved,
  updatePost,
  deletePost,
  updateResponse,
  deleteResponse,
} from "./forum.controller";

const router = Router();

const postRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  message: "Too many posts created. Please try again in 10 minutes.",
});

const replyRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 15,
  message: "Too many replies posted. Please try again in 5 minutes.",
});

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

// PATCH /api/forum/:id/resolve - Mark Post as Resolved
router.patch(
  "/:id/resolve",
  requireAuth,
  validateRequest(forumIdParamSchema),
  markResolved,
);

// PATCH /api/forum/:id - Edit Post
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
