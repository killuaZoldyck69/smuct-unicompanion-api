import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createMarketplaceCommentSchema,
  createMarketplaceSchema,
  updateMarketplaceStatusSchema,
} from "./marketplace.schema";
import {
  createComment,
  createPost,
  deleteComment,
  deletePost,
  getFeed,
  getPostById,
  updateStatus,
} from "./marketplace.controller";

const router = Router();

router.post(
  "/",
  requireAuth,
  validateRequest(createMarketplaceSchema),
  createPost
);

router.get("/", requireAuth, getFeed);

router.get("/:id", requireAuth, getPostById);

router.patch(
  "/:id/sold",
  requireAuth,
  (req, _res, next) => {
    req.body = { status: "SOLD" };
    next();
  },
  updateStatus
);

router.patch(
  "/:id/status",
  requireAuth,
  validateRequest(updateMarketplaceStatusSchema),
  updateStatus
);

router.delete("/:id", requireAuth, deletePost);

router.post(
  "/:id/comments",
  requireAuth,
  validateRequest(createMarketplaceCommentSchema),
  createComment
);

router.delete("/:id/comments/:commentId", requireAuth, deleteComment);

export const marketplaceRoutes = router;
