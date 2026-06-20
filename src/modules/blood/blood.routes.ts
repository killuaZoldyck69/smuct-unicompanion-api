import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import { createBloodPostSchema, respondBloodPostSchema } from "./blood.schema";
import {
  createBloodPost,
  getBloodFeed,
  getBloodPostById,
  respondToBloodPost,
  markBloodPostResolved,
  deleteBloodPost,
} from "./blood.controller";

const router = Router();

// POST /api/blood - Create a Blood Request
router.post(
  "/",
  requireAuth,
  validateRequest(createBloodPostSchema),
  createBloodPost,
);

// GET /api/blood - Get All Blood Requests (Feed)
router.get("/", requireAuth, getBloodFeed);

// GET /api/blood/:id - Get Single Blood Request Details
router.get("/:id", requireAuth, getBloodPostById);

// POST /api/blood/:id/respond - Volunteer/Respond to a Request
router.post(
  "/:id/respond",
  requireAuth,
  validateRequest(respondBloodPostSchema),
  respondToBloodPost,
);

// PATCH /api/blood/:id/resolve - Mark Request as Fulfilled
router.patch("/:id/resolve", requireAuth, markBloodPostResolved);

// DELETE /api/blood/:id - Delete Request
router.delete("/:id", requireAuth, deleteBloodPost);

export const bloodRoutes = router;
