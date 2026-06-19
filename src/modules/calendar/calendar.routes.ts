import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/admin.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import { createCalendarSchema } from "./calendar.schema";
import { createCalendar, getCalendars } from "./calendar.controller";

const router = Router();

// POST /api/calendars - Create Calendar (Admin Only)
router.post(
  "/",
  requireAuth,
  requireAdmin,
  validateRequest(createCalendarSchema),
  createCalendar,
);

// GET /api/calendars - Fetch Relevant Calendars for the logged-in User
router.get("/", requireAuth, getCalendars);

export const calendarRoutes = router;
