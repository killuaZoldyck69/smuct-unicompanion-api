import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/role.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  adminForumReportsQuerySchema,
  adminResolveReportSchema,
} from "./admin.schema";
import {
  getDashboardStats,
  getSystemDiagnostics,
  getAdminCourseHubs,
  getForumReportsQueue,
  resolveForumReport,
} from "./admin.controller";

const router = Router();

// GET /api/admin/dashboard-stats - Live aggregate dashboard metrics & activity feed (Admin Only)
router.get("/dashboard-stats", requireAuth, requireAdmin, getDashboardStats);

// GET /api/admin/system-diagnostics - Full infrastructure diagnostics (Postgres, Cloudinary, Brevo, Node)
router.get(
  "/system-diagnostics",
  requireAuth,
  requireAdmin,
  getSystemDiagnostics,
);

// GET /api/admin/course-hubs - Paginated, searchable, filterable directory of all course hubs (Admin Only)
router.get("/course-hubs", requireAuth, requireAdmin, getAdminCourseHubs);

// GET /api/admin/forum/reports - Paginated Forum UGC Moderation Queue (Admin Only)
router.get(
  "/forum/reports",
  requireAuth,
  requireAdmin,
  validateRequest(adminForumReportsQuerySchema),
  getForumReportsQueue,
);

// PATCH /api/admin/forum/reports/:reportId - Dismiss / Hide / Delete / Restrict Author (Admin Only)
router.patch(
  "/forum/reports/:reportId",
  requireAuth,
  requireAdmin,
  validateRequest(adminResolveReportSchema),
  resolveForumReport,
);

export const adminRoutes = router;
