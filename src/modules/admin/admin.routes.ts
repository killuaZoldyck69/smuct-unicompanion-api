import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/admin.middleware";
import {
  getDashboardStats,
  getSystemDiagnostics,
  getAdminCourseHubs,
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

export const adminRoutes = router;
