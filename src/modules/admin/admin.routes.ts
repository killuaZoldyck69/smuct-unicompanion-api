import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/admin.middleware";
import { getDashboardStats } from "./admin.controller";

const router = Router();

// GET /api/admin/dashboard-stats - Live aggregate dashboard metrics & activity feed (Admin Only)
router.get("/dashboard-stats", requireAuth, requireAdmin, getDashboardStats);

export const adminRoutes = router;
