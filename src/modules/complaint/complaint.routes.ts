import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/admin.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createComplaintSchema,
  updateComplaintSchema,
  updateComplaintStatusSchema,
} from "./complaint.schema";
import {
  createComplaint,
  getMyComplaints,
  getMyComplaintStats,
  getAllComplaints,
  updateComplaint,
  updateComplaintStatus,
  deleteComplaint,
} from "./complaint.controller";

const router = Router();

router.post(
  "/",
  requireAuth,
  validateRequest(createComplaintSchema),
  createComplaint,
);

router.get("/my", requireAuth, getMyComplaints);
router.get("/my/stats", requireAuth, getMyComplaintStats);

router.patch(
  "/:id",
  requireAuth,
  validateRequest(updateComplaintSchema),
  updateComplaint,
);

router.delete("/:id", requireAuth, deleteComplaint);

// Admin-only routes
router.get("/", requireAuth, requireAdmin, getAllComplaints);
router.patch(
  "/:id/status",
  requireAuth,
  requireAdmin,
  validateRequest(updateComplaintStatusSchema),
  updateComplaintStatus,
);

export const complaintRoutes = router;
