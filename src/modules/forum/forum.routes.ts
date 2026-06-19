import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createPostSchema,
  createResponseSchema,
  updatePostSchema, // NEW
} from "./forum.schema";
import {
  createPost,
  getFeed,
  getThread,
  replyToPost,
  markResolved,
  updatePost, // NEW
  deletePost, // NEW
} from "./forum.controller";

const router = Router();

// POST /api/forum - Create a Forum Post
router.post("/", requireAuth, validateRequest(createPostSchema), createPost);

// GET /api/forum - Get All Posts / Feed
router.get("/", requireAuth, getFeed);

// GET /api/forum/:id - Get Single Thread
router.get("/:id", requireAuth, getThread);

// POST /api/forum/:id/respond - Reply to a Post
router.post(
  "/:id/respond",
  requireAuth,
  validateRequest(createResponseSchema),
  replyToPost,
);

// PATCH /api/forum/:id/resolve - Mark Post as Resolved
router.patch("/:id/resolve", requireAuth, markResolved);

// NEW: PATCH /api/forum/:id - Edit Post
router.patch(
  "/:id",
  requireAuth,
  validateRequest(updatePostSchema),
  updatePost,
);

// NEW: DELETE /api/forum/:id - Delete Post
router.delete("/:id", requireAuth, deletePost);

export const forumRoutes = router;
