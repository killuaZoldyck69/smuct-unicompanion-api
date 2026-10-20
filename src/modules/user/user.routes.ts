import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/admin.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  singleUpload,
  normalizeSingleFile,
} from "../../middleware/upload.middleware";
import {
  updateRoleSchema,
  getUsersQuerySchema,
  restrictUserSchema,
  updateTeacherPositionSchema,
  adminUpdateStudentProfileSchema,
} from "./user.schema";
import { updateTeacherProfileSchema } from "../teacher/teacher.schema";
import {
  getAllUsers,
  deleteUser,
  restrictUser,
  updateStudentRole,
  updateTeacherPosition,
  adminUpdateTeacherProfile,
  adminUpdateStudentProfile,
  updateUserProfileImage,
  runMaintenanceCleanup,
} from "./user.controller";

const router = Router();

// POST /api/users/maintenance/cleanup - Trigger unverified accounts & expired tokens cleanup (Admin Only)
router.post(
  "/maintenance/cleanup",
  requireAuth,
  requireAdmin,
  runMaintenanceCleanup,
);

// PATCH /api/users/profile/image - Upload and update profile image for current user
router.patch(
  "/profile/image",
  requireAuth,
  singleUpload,
  normalizeSingleFile,
  updateUserProfileImage,
);

// GET /api/users - Get All Users with filtering, pagination, search, and caching (Admin Only)
router.get(
  "/",
  requireAuth,
  requireAdmin,
  validateRequest(getUsersQuerySchema),
  getAllUsers,
);

// DELETE /api/users/:id - Restrict User (Admin Only, soft restriction preventing re-registration)
router.delete("/:id", requireAuth, requireAdmin, deleteUser);

// PATCH /api/users/:id/restrict - Restrict or Unrestrict User (Admin Only)
router.patch(
  "/:id/restrict",
  requireAuth,
  requireAdmin,
  validateRequest(restrictUserSchema),
  restrictUser,
);

// PATCH /api/users/:id/role - Update Student Special Role (Admin Only)
router.patch(
  "/:id/role",
  requireAuth,
  requireAdmin,
  validateRequest(updateRoleSchema),
  updateStudentRole,
);

// PATCH /api/users/:id/teacher-position - Update Teacher Designation & Leadership Role (Admin Only)
router.patch(
  "/:id/teacher-position",
  requireAuth,
  requireAdmin,
  validateRequest(updateTeacherPositionSchema),
  updateTeacherPosition,
);

// PATCH /api/users/:id/teacher-profile - Full Teacher Profile Edit (Admin Only)
router.patch(
  "/:id/teacher-profile",
  requireAuth,
  requireAdmin,
  validateRequest(updateTeacherProfileSchema),
  adminUpdateTeacherProfile,
);

// PATCH /api/users/:id/student-profile - Full Student Profile Edit (Admin Only)
router.patch(
  "/:id/student-profile",
  requireAuth,
  requireAdmin,
  validateRequest(adminUpdateStudentProfileSchema),
  adminUpdateStudentProfile,
);

export const userRoutes = router;

