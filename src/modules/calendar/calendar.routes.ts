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

// ==========================================
// CSV TEMPLATE & VALIDATION (Specific static paths first)
// ==========================================

// GET /api/calendars/template/csv - Download CSV Template
router.get(
  "/template/csv",
  requireAuth,
  requireAdmin,
  calendarCsvLimiter,
  getCsvTemplate,
);

// POST /api/calendars/validate-csv - Dry-run validate CSV content & generate diff
router.post(
  "/validate-csv",
  requireAuth,
  requireAdmin,
  calendarCsvLimiter,
  validateRequest(validateCsvSchema),
  validateCsv,
);

// GET /api/calendars/admin/all - Fetch all calendars for Admin Management
router.get(
  "/admin/all",
  requireAuth,
  requireAdmin,
  calendarReadLimiter,
  validateRequest(calendarListQuerySchema),
  getAdminCalendars,
);

// ==========================================
// STUDENT / TEACHER ACCESSIBLE ENDPOINTS
// ==========================================

// GET /api/calendars/current - Fetch the current active published calendar
router.get("/current", requireAuth, calendarReadLimiter, getCurrentCalendar);

// GET /api/calendars/events/upcoming - Fetch upcoming events
router.get(
  "/events/upcoming",
  requireAuth,
  calendarReadLimiter,
  validateRequest(upcomingEventsQuerySchema),
  getUpcomingEvents,
);

// GET /api/calendars - Fetch relevant published calendars for logged-in user
router.get(
  "/",
  requireAuth,
  calendarReadLimiter,
  validateRequest(calendarListQuerySchema),
  getCalendars,
);

// GET /api/calendars/:id - Fetch single calendar details (Published for students, any for Admin)
router.get(
  "/:id",
  requireAuth,
  calendarReadLimiter,
  validateRequest(calendarIdParamSchema),
  getCalendarById,
);

// ==========================================
// ADMIN CALENDAR CRUD
// ==========================================

// POST /api/calendars - Create Calendar
router.post(
  "/",
  requireAuth,
  requireAdmin,
  calendarWriteLimiter,
  validateRequest(createCalendarSchema),
  createCalendar,
);

// PUT /api/calendars/:id - Update Calendar Metadata
router.put(
  "/:id",
  requireAuth,
  requireAdmin,
  calendarWriteLimiter,
  validateRequest(updateCalendarSchema),
  updateCalendar,
);

// PATCH /api/calendars/:id/status - Update Status (DRAFT, PUBLISHED, ARCHIVED)
router.patch(
  "/:id/status",
  requireAuth,
  requireAdmin,
  calendarWriteLimiter,
  validateRequest(updateCalendarStatusSchema),
  updateCalendarStatus,
);

// POST /api/calendars/:id/duplicate - Duplicate calendar into Draft
router.post(
  "/:id/duplicate",
  requireAuth,
  requireAdmin,
  calendarWriteLimiter,
  validateRequest(duplicateCalendarSchema),
  duplicateCalendar,
);

// DELETE /api/calendars/:id - Delete Calendar
router.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  calendarWriteLimiter,
  validateRequest(calendarIdParamSchema),
  deleteCalendar,
);

// ==========================================
// ADMIN EVENT CRUD
// ==========================================

// POST /api/calendars/:id/events - Add single event
router.post(
  "/:id/events",
  requireAuth,
  requireAdmin,
  calendarWriteLimiter,
  validateRequest(createSingleEventSchema),
  addEvent,
);

// PUT /api/calendars/:id/events/:eventId - Update single event
router.put(
  "/:id/events/:eventId",
  requireAuth,
  requireAdmin,
  calendarWriteLimiter,
  validateRequest(updateSingleEventSchema),
  updateEvent,
);

// DELETE /api/calendars/:id/events/:eventId - Delete single event
router.delete(
  "/:id/events/:eventId",
  requireAuth,
  requireAdmin,
  calendarWriteLimiter,
  validateRequest(calendarEventParamSchema),
  deleteEvent,
);

// ==========================================
// ADMIN CSV IMPORT / EXPORT
// ==========================================

// POST /api/calendars/:id/import-csv - Commit CSV import into calendar
router.post(
  "/:id/import-csv",
  requireAuth,
  requireAdmin,
  calendarCsvLimiter,
  validateRequest(importCsvSchema),
  importCsv,
);

// GET /api/calendars/:id/export-csv - Export calendar events to CSV
router.get(
  "/:id/export-csv",
  requireAuth,
  requireAdmin,
  calendarCsvLimiter,
  validateRequest(calendarIdParamSchema),
  exportCsv,
);

export const calendarRoutes = router;
