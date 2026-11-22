import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/role.middleware";
import {
  createUserKeyGenerator,
  rateLimit,
} from "../../middleware/rateLimit.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  calendarIdParamSchema,
  calendarEventParamSchema,
  createCalendarSchema,
  updateCalendarSchema,
  updateCalendarStatusSchema,
  duplicateCalendarSchema,
  createSingleEventSchema,
  updateSingleEventSchema,
  validateCsvSchema,
  calendarListQuerySchema,
  upcomingEventsQuerySchema,
  importCsvSchema,
} from "./calendar.schema";
import {
  getCalendars,
  getCurrentCalendar,
  getUpcomingEvents,
  getCalendarById,
  getAdminCalendars,
  createCalendar,
  updateCalendar,
  updateCalendarStatus,
  duplicateCalendar,
  deleteCalendar,
  addEvent,
  updateEvent,
  deleteEvent,
  validateCsv,
  importCsv,
  exportCsv,
  getCsvTemplate,
} from "./calendar.controller";

const router = Router();

const calendarReadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 120,
  keyGenerator: createUserKeyGenerator("calendar-read"),
  message: {
    success: false,
    message: "Too many calendar requests. Please slow down and try again shortly.",
  },
});

const calendarWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  keyGenerator: createUserKeyGenerator("calendar-write"),
  message: {
    success: false,
    message: "Too many calendar write actions. Please try again in a few minutes.",
  },
});

const calendarCsvLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: createUserKeyGenerator("calendar-csv"),
  message: {
    success: false,
    message: "Too many CSV calendar operations. Please try again in a few minutes.",
  },
});

// Static paths must precede `/:id` so Express does not treat path segments as UUID params.
router.get("/template/csv", requireAuth, requireAdmin, calendarCsvLimiter, getCsvTemplate);
router.post(
  "/validate-csv",
  requireAuth,
  requireAdmin,
  calendarCsvLimiter,
  validateRequest(validateCsvSchema),
  validateCsv,
);
router.get(
  "/admin/all",
  requireAuth,
  requireAdmin,
  calendarReadLimiter,
  validateRequest(calendarListQuerySchema),
  getAdminCalendars,
);

router.get("/current", requireAuth, calendarReadLimiter, getCurrentCalendar);
router.get(
  "/events/upcoming",
  requireAuth,
  calendarReadLimiter,
  validateRequest(upcomingEventsQuerySchema),
  getUpcomingEvents,
);
router.get(
  "/",
  requireAuth,
  calendarReadLimiter,
  validateRequest(calendarListQuerySchema),
  getCalendars,
);
router.get(
  "/:id",
  requireAuth,
  calendarReadLimiter,
  validateRequest(calendarIdParamSchema),
  getCalendarById,
);

router.post(
  "/",
  requireAuth,
  requireAdmin,
  calendarWriteLimiter,
  validateRequest(createCalendarSchema),
  createCalendar,
);
router.put(
  "/:id",
  requireAuth,
  requireAdmin,
  calendarWriteLimiter,
  validateRequest(updateCalendarSchema),
  updateCalendar,
);
router.patch(
  "/:id/status",
  requireAuth,
  requireAdmin,
  calendarWriteLimiter,
  validateRequest(updateCalendarStatusSchema),
  updateCalendarStatus,
);
router.post(
  "/:id/duplicate",
  requireAuth,
  requireAdmin,
  calendarWriteLimiter,
  validateRequest(duplicateCalendarSchema),
  duplicateCalendar,
);
router.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  calendarWriteLimiter,
  validateRequest(calendarIdParamSchema),
  deleteCalendar,
);

router.post(
  "/:id/events",
  requireAuth,
  requireAdmin,
  calendarWriteLimiter,
  validateRequest(createSingleEventSchema),
  addEvent,
);
router.put(
  "/:id/events/:eventId",
  requireAuth,
  requireAdmin,
  calendarWriteLimiter,
  validateRequest(updateSingleEventSchema),
  updateEvent,
);
router.delete(
  "/:id/events/:eventId",
  requireAuth,
  requireAdmin,
  calendarWriteLimiter,
  validateRequest(calendarEventParamSchema),
  deleteEvent,
);

router.post(
  "/:id/import-csv",
  requireAuth,
  requireAdmin,
  calendarCsvLimiter,
  validateRequest(importCsvSchema),
  importCsv,
);
router.get(
  "/:id/export-csv",
  requireAuth,
  requireAdmin,
  calendarCsvLimiter,
  validateRequest(calendarIdParamSchema),
  exportCsv,
);

export const calendarRoutes = router;
