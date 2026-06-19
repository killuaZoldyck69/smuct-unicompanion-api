import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/admin.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import { createEventSchema } from "./event.schema";
import { createEvent, getEvents, deleteEvent } from "./event.controller";

const router = Router();

// POST /api/events - Create Event (Admin Only)
router.post(
  "/",
  requireAuth,
  requireAdmin,
  validateRequest(createEventSchema),
  createEvent,
);

// GET /api/events - Get Upcoming Events (All Authenticated Users)
router.get("/", requireAuth, getEvents);

// DELETE /api/events/:id - Delete Event (Admin Only)
router.delete("/:id", requireAuth, requireAdmin, deleteEvent);

export const eventRoutes = router;
