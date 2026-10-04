import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/admin.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import { createEventSchema, updateEventSchema, getEventsQuerySchema } from "./event.schema";
import {
  createEvent,
  updateEvent,
  getEvents,
  getEventById,
  toggleInterested,
  getInterestedStatus,
  deleteEvent,
} from "./event.controller";

const router = Router();

// POST /api/events - Create Event (Admin Only)
router.post(
  "/",
  requireAuth,
  requireAdmin,
  validateRequest(createEventSchema),
  createEvent,
);

// GET /api/events - Get Upcoming Events (All Authenticated Users) with pagination, filter, search
router.get("/", requireAuth, validateRequest(getEventsQuerySchema), getEvents);

// POST /api/events/:id/interested - Toggle Interested Status (All Authenticated Users)
router.post("/:id/interested", requireAuth, toggleInterested);

// GET /api/events/:id/interested - Get Interested Status (All Authenticated Users)
router.get("/:id/interested", requireAuth, getInterestedStatus);

// GET /api/events/:id - Get Event by ID (All Authenticated Users)
router.get("/:id", requireAuth, getEventById);

// PATCH /api/events/:id - Update Event (Admin Only)
router.patch(
  "/:id",
  requireAuth,
  requireAdmin,
  validateRequest(updateEventSchema),
  updateEvent,
);

// PUT /api/events/:id - Update Event (Admin Only)
router.put(
  "/:id",
  requireAuth,
  requireAdmin,
  validateRequest(updateEventSchema),
  updateEvent,
);

// DELETE /api/events/:id - Delete Event (Admin Only)
router.delete("/:id", requireAuth, requireAdmin, deleteEvent);

export const eventRoutes = router;

