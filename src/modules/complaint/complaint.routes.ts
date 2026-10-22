import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/admin.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createComplaintSchema,
  updateComplaintSchema,
  updateComplaintStatusSchema,
  adminComplaintsQuerySchema,
} from "./complaint.schema";
import {
  createComplaint,
  getMyComplaints,
  getMyComplaintStats,
  getAdminComplaintStats,
  getAllComplaints,
  getComplaintById,
  updateComplaint,
  updateComplaintStatus,
  deleteComplaint,
} from "./complaint.controller";

const router = Router();

// Student/Teacher routes
router.post(
  "/",
  requireAuth,
  validateRequest(createComplaintSchema),
  createComplaint,
);

router.get("/my", requireAuth, getMyComplaints);
router.get("/my/stats", requireAuth, getMyComplaintStats);

// Admin-only endpoints (must come before generic /:id parameter)
router.get("/admin/stats", requireAuth, requireAdmin, getAdminComplaintStats);
router.get(
  "/",
  requireAuth,
  requireAdmin,
  validateRequest(adminComplaintsQuerySchema),
  getAllComplaints,
);
router.patch(
  "/:id/status",
  requireAuth,
  requireAdmin,
  validateRequest(updateComplaintStatusSchema),
  updateComplaintStatus,
);

// Individual complaint operations
router.get("/:id", requireAuth, getComplaintById);
router.patch(
  "/:id",
  requireAuth,
  validateRequest(updateComplaintSchema),
  updateComplaint,
);
router.delete("/:id", requireAuth, deleteComplaint);

export const complaintRoutes = router;
