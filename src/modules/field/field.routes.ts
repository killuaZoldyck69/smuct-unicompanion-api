import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/admin.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  updateFieldSettingsSchema,
  bookFieldSchema,
  updateBookingStatusSchema,
  getAllBookingsQuerySchema,
  getMyBookingsQuerySchema,
  getScheduleQuerySchema,
} from "./field.schema";
import {
  getFieldSettings,
  updateFieldSettings,
  bookField,
  getMyBookings,
  getAllBookings,
  getApprovedSchedule, // NEW
  updateBookingStatus,
  deleteBooking,
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

// Public Schedule Route
router.get(
  "/schedule",
  requireAuth,
  validateRequest(getScheduleQuerySchema),
  getApprovedSchedule,
);

router.post("/book", requireAuth, validateRequest(bookFieldSchema), bookField);
router.get(
  "/my-bookings",
  requireAuth,
  validateRequest(getMyBookingsQuerySchema),
  getMyBookings,
);

router.delete("/bookings/:id", requireAuth, deleteBooking);

router.get(
  "/bookings",
  requireAuth,
  requireAdmin,
  validateRequest(getAllBookingsQuerySchema),
  getAllBookings,
);
router.patch(
  "/bookings/:id/status",
  requireAuth,
  requireAdmin,
  validateRequest(updateBookingStatusSchema),
  updateBookingStatus,
);

export const fieldRoutes = router;
