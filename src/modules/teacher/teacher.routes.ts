import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/admin.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  registerTeacherSchema,
  updateTeacherImageSchema,
  updateTeacherProfileSchema,
} from "./teacher.schema";
import {
  getTeacherProfile,
  registerTeacher,
  updateProfile,
  updateTeacherProfileImage,
} from "./teacher.controller";
import { requireTeacher } from "../../middleware/teacher.middleware";

const router = Router();

// POST /api/teachers/register
// Restricted to ADMIN role only
router.post(
  "/register",
  requireAuth,
  requireAdmin,
  validateRequest(registerTeacherSchema),
  registerTeacher,
);

// GET /api/teachers/profile (TEACHER ONLY)
router.get("/profile", requireAuth, requireTeacher, getTeacherProfile);

router.patch(
  "/profile/image",
  requireAuth,
  requireTeacher,
  validateRequest(updateTeacherImageSchema),
  updateTeacherProfileImage,
);

// PATCH /api/teachers/profile (TEACHER ONLY)
router.patch(
  "/profile",
  requireAuth,
  requireTeacher,
  validateRequest(updateTeacherProfileSchema),
  updateProfile,
);
export const teacherRoutes = router;
