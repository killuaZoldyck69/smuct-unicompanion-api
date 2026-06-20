import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/admin.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  updateFieldSettingsSchema,
  bookFieldSchema,
  updateBookingStatusSchema,
} from "./field.schema";
import {
  getFieldSettings,
  updateFieldSettings,
  bookField,
  getMyBookings,
  getAllBookings,
  getApprovedSchedule, // NEW
  updateBookingStatus,
} from "./field.controller";

const router = Router();

router.get("/settings", requireAuth, getFieldSettings);
router.patch(
  "/settings",
  requireAuth,
  requireAdmin,
  validateRequest(updateFieldSettingsSchema),
  updateFieldSettings,
);

// NEW: Public Schedule Route
router.get("/schedule", requireAuth, getApprovedSchedule);

router.post("/book", requireAuth, validateRequest(bookFieldSchema), bookField);
router.get("/my-bookings", requireAuth, getMyBookings);

router.get("/bookings", requireAuth, requireAdmin, getAllBookings);
router.patch(
  "/bookings/:id/status",
  requireAuth,
  requireAdmin,
  validateRequest(updateBookingStatusSchema),
  updateBookingStatus,
);

export const fieldRoutes = router;
