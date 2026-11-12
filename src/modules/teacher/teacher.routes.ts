import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireAdmin, requireTeacher } from "../../middleware/role.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  profileImageUpload,
  normalizeSingleFile,
} from "../../middleware/upload.middleware";
import { profileImageBodySchema } from "../user/user.schema";
import {
  registerTeacherSchema,
  updateTeacherProfileSchema,
} from "./teacher.schema";
import {
  getTeacherProfile,
  registerTeacher,
  updateProfile,
  updateTeacherProfileImage,
} from "./teacher.controller";

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
  profileImageUpload,
  normalizeSingleFile,
  validateRequest(profileImageBodySchema),
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
