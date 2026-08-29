import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/admin.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createCalendarSchema,
  updateCalendarSchema,
  updateCalendarStatusSchema,
  createSingleEventSchema,
  updateSingleEventSchema,
  validateCsvSchema,
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

// ==========================================
// CSV TEMPLATE & VALIDATION (Specific static paths first)
// ==========================================

// GET /api/calendars/template/csv - Download CSV Template
router.get("/template/csv", requireAuth, requireAdmin, getCsvTemplate);

// POST /api/calendars/validate-csv - Dry-run validate CSV content & generate diff
router.post(
  "/validate-csv",
  requireAuth,
  requireAdmin,
  validateRequest(validateCsvSchema),
  validateCsv,
);

// GET /api/calendars/admin/all - Fetch all calendars for Admin Management
router.get("/admin/all", requireAuth, requireAdmin, getAdminCalendars);

// ==========================================
// STUDENT / TEACHER ACCESSIBLE ENDPOINTS
// ==========================================

// GET /api/calendars/current - Fetch the current active published calendar
router.get("/current", requireAuth, getCurrentCalendar);

// GET /api/calendars/events/upcoming - Fetch upcoming events
router.get("/events/upcoming", requireAuth, getUpcomingEvents);

// GET /api/calendars - Fetch relevant published calendars for logged-in user
router.get("/", requireAuth, getCalendars);

// GET /api/calendars/:id - Fetch single calendar details (Published for students, any for Admin)
router.get("/:id", requireAuth, getCalendarById);

// ==========================================
// ADMIN CALENDAR CRUD
// ==========================================

// POST /api/calendars - Create Calendar
router.post(
  "/",
  requireAuth,
  requireAdmin,
  validateRequest(createCalendarSchema),
  createCalendar,
);

// PUT /api/calendars/:id - Update Calendar Metadata
router.put(
  "/:id",
  requireAuth,
  requireAdmin,
  validateRequest(updateCalendarSchema),
  updateCalendar,
);

// PATCH /api/calendars/:id/status - Update Status (DRAFT, PUBLISHED, ARCHIVED)
router.patch(
  "/:id/status",
  requireAuth,
  requireAdmin,
  validateRequest(updateCalendarStatusSchema),
  updateCalendarStatus,
);

// POST /api/calendars/:id/duplicate - Duplicate calendar into Draft
router.post("/:id/duplicate", requireAuth, requireAdmin, duplicateCalendar);

// DELETE /api/calendars/:id - Delete Calendar
router.delete("/:id", requireAuth, requireAdmin, deleteCalendar);

// ==========================================
// ADMIN EVENT CRUD
// ==========================================

// POST /api/calendars/:id/events - Add single event
router.post(
  "/:id/events",
  requireAuth,
  requireAdmin,
  validateRequest(createSingleEventSchema),
  addEvent,
);

// PUT /api/calendars/:id/events/:eventId - Update single event
router.put(
  "/:id/events/:eventId",
  requireAuth,
  requireAdmin,
  validateRequest(updateSingleEventSchema),
  updateEvent,
);

// DELETE /api/calendars/:id/events/:eventId - Delete single event
router.delete("/:id/events/:eventId", requireAuth, requireAdmin, deleteEvent);

// ==========================================
// ADMIN CSV IMPORT / EXPORT
// ==========================================

// POST /api/calendars/:id/import-csv - Commit CSV import into calendar
router.post(
  "/:id/import-csv",
  requireAuth,
  requireAdmin,
  validateRequest(importCsvSchema),
  importCsv,
);

// GET /api/calendars/:id/export-csv - Export calendar events to CSV
router.get("/:id/export-csv", requireAuth, requireAdmin, exportCsv);

export const calendarRoutes = router;
