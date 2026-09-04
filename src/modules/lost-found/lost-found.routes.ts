import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createLostFoundCommentSchema,
  createLostFoundSchema,
  updateLostFoundStatusSchema,
} from "./lost-found.schema";
import {
  createComment,
  createPost,
  deleteComment,
  deletePost,
  getFeed,
  getPostById,
  updateStatus,
} from "./lost-found.controller";

const router = Router();

router.post(
  "/",
  requireAuth,
  validateRequest(createLostFoundSchema),
  createPost
);

router.get("/", requireAuth, getFeed);

router.get("/:id", requireAuth, getPostById);

router.patch(
  "/:id/claim",
  requireAuth,
  (req, _res, next) => {
    req.body = { status: "CLAIMED" };
    next();
  },
  updateStatus
);

router.patch(
  "/:id/status",
  requireAuth,
  validateRequest(updateLostFoundStatusSchema),
  updateStatus
);

router.delete("/:id", requireAuth, deletePost);

router.post(
  "/:id/comments",
  requireAuth,
  validateRequest(createLostFoundCommentSchema),
  createComment
);

router.delete("/:id/comments/:commentId", requireAuth, deleteComment);

export const lostFoundRoutes = router;
