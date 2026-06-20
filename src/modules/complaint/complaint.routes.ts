import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/admin.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createComplaintSchema,
  updateComplaintStatusSchema,
} from "./complaint.schema";
import {
  createComplaint,
  getMyComplaints,
  getAllComplaints,
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
router.get("/", requireAuth, requireAdmin, getAllComplaints);
router.patch(
  "/:id/status",
  requireAuth,
  requireAdmin,
  validateRequest(updateComplaintStatusSchema),
  updateComplaintStatus,
);
router.delete("/:id", requireAuth, requireAdmin, deleteComplaint);

export const complaintRoutes = router;
